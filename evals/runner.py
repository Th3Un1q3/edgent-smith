"""Unified eval runner for the edge agent.

Builds the right model (Ollama or GitHub Copilot) based on ``--provider`` and
then runs the shared smoke-eval loop.  Provider is auto-detected when omitted:
Copilot is used when ``GITHUB_COPILOT_API_TOKEN`` is present in the environment;
Ollama is used otherwise.

Usage
-----
::

    # Auto-detect provider and run with defaults
    python evals/runner.py

    # Explicit provider
    python evals/runner.py --provider ollama --model gemma4:e2b
    python evals/runner.py --provider copilot --model gpt-4o-mini-2024-07-18

    # Extra options
    python evals/runner.py --score-file /tmp/score.json
    python evals/runner.py --update-baseline
    python evals/runner.py --provider ollama --base-url http://localhost:11434/v1
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import httpx
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.profiles.openai import OpenAIModelProfile
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from agents.edge import AgentOutput
from agents.edge import agent as edge_agent
from evals.smoke import _read_baseline, baseline_file, case_pass_results, smoke_dataset

# ── Constants ──────────────────────────────────────────────────────────────────

_OLLAMA_DEFAULT_MODEL = "gemma4:e2b"
_OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434"
_COPILOT_BASE_URL = "https://api.githubcopilot.com"
_COPILOT_DEFAULT_MODEL = "gpt-4o-mini-2024-07-18"


# ── Ollama model factory ───────────────────────────────────────────────────────


def _ensure_ollama_v1_base_url(url: str) -> str:
    """Return ``url`` normalised to an Ollama OpenAI-compatible ``/v1`` base URL."""
    raw = url.rstrip("/")
    return raw if raw.endswith("/v1") else f"{raw}/v1"


def _resolve_ollama_base_url() -> str:
    """Return the Ollama base URL with the required ``/v1`` suffix."""
    if url := os.getenv("OLLAMA_BASE_URL"):
        return _ensure_ollama_v1_base_url(url)
    raw = os.getenv("EDGENT_OLLAMA_BASE_URL", _OLLAMA_DEFAULT_BASE_URL)
    return _ensure_ollama_v1_base_url(raw)


def build_ollama_model(
    model_name: str = _OLLAMA_DEFAULT_MODEL,
    base_url: str | None = None,
) -> OpenAIChatModel:
    """Return an ``OpenAIChatModel`` backed by a local Ollama instance."""
    resolved_url = base_url or _resolve_ollama_base_url()
    profile = OpenAIModelProfile(
        default_structured_output_mode="native",
        supports_json_schema_output=True,
    )
    return OpenAIChatModel(
        model_name,
        provider=OllamaProvider(base_url=resolved_url),
        profile=profile,
    )


# ── Copilot model factory ──────────────────────────────────────────────────────


class _CopilotTransport(httpx.AsyncHTTPTransport):
    """Inject the missing ``"object": "chat.completion"`` field.

    The Copilot endpoint omits this field; pydantic-ai requires it when
    parsing OpenAI chat completion responses.
    """

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        response = await super().handle_async_request(request)
        if response.status_code == 200:
            await response.aread()
            try:
                data = json.loads(response.content)
                if isinstance(data, dict) and "choices" in data and "object" not in data:
                    data["object"] = "chat.completion"
                    patched = json.dumps(data).encode()
                    patched_headers = dict(response.headers)
                    for _hdr in ("content-length", "content-encoding", "transfer-encoding"):
                        patched_headers.pop(_hdr, None)
                    response = httpx.Response(
                        status_code=response.status_code,
                        headers=patched_headers,
                        content=patched,
                        request=request,
                    )
            except (json.JSONDecodeError, KeyError):
                pass
        return response


def build_copilot_model(
    model_name: str = _COPILOT_DEFAULT_MODEL,
    http_client: httpx.AsyncClient | None = None,
) -> OpenAIChatModel:
    """Return an ``OpenAIChatModel`` backed by the GitHub Copilot API.

    Reads ``GITHUB_COPILOT_API_TOKEN`` from the environment.

    Args:
        model_name: Copilot model identifier.
        http_client: Optional pre-constructed ``httpx.AsyncClient`` with the
            required transport.  When provided the caller is responsible for
            closing it after the run.  When omitted a new client is created
            with :class:`_CopilotTransport` — callers should close it via
            ``asyncio.run(client.aclose())`` when they are done.
    """
    token = os.getenv("GITHUB_COPILOT_API_TOKEN")
    if not token:
        raise ValueError(
            "GitHub Copilot API token is required for the 'copilot' provider. "
            "Set the GITHUB_COPILOT_API_TOKEN environment variable before running."
        )
    client = http_client or httpx.AsyncClient(transport=_CopilotTransport())
    openai_client = AsyncOpenAI(
        base_url=_COPILOT_BASE_URL,
        api_key=token,
        http_client=client,
    )
    return OpenAIChatModel(model_name, provider=OpenAIProvider(openai_client=openai_client))


# ── Shared eval loop ───────────────────────────────────────────────────────────


def run_eval(
    model: OpenAIChatModel,
    *,
    baseline_key: str,
    provider: str,
    model_label: str | None = None,
    score_file: str | Path | None = None,
    update_baseline: bool = False,
) -> bool:
    """Run the smoke dataset with *model*; print results; return True if CI passed.

    Args:
        model: Constructed model injected into the agent at call-time.
        baseline_key: Key used to look up / store the baseline file (e.g.
            ``"ollama:gemma4:e2b"`` or ``"gpt-4o-mini-2024-07-18"``).
        provider: Provider label written to the score-file JSON.
        model_label: Human-readable label printed in the summary line.
            Defaults to *baseline_key*.
        score_file: Optional path; when given, a JSON score report is written.
        update_baseline: When ``True``, overwrites the baseline if score improved.

    Returns:
        ``True`` if the score meets or exceeds the baseline and no regressions
        were detected; ``False`` otherwise.
    """
    label = model_label or baseline_key
    baseline_path = baseline_file(baseline_key)

    async def _run(prompt: str) -> AgentOutput:
        result = await edge_agent.run(prompt, model=model)
        return result.output

    report = smoke_dataset.evaluate_sync(_run)
    report.print(include_input=True, include_output=True)

    pass_results = case_pass_results(report)
    passing_now = [name for name, passed in pass_results.items() if passed]
    score = len(passing_now)
    baseline_score, baseline_passing, baseline_data = _read_baseline(baseline_path)
    regressions = [name for name in baseline_passing if not pass_results.get(name, False)]

    print(f"\nModel: {label}", flush=True)
    print(f"CI score: {score}  (baseline: {baseline_score})", flush=True)
    if regressions:
        print(f"REGRESSIONS detected: {regressions}", flush=True)

    ci_passed = score >= baseline_score and not regressions

    if update_baseline:
        if score > baseline_score:
            baseline_data["score"] = score
            baseline_data["passing_cases"] = passing_now
            baseline_path.write_text(json.dumps(baseline_data, indent=2) + "\n")
            print(f"Baseline updated: {baseline_score} → {score}", flush=True)
        elif score == baseline_score:
            print(f"Baseline unchanged: {baseline_score} (score equal)", flush=True)
        else:
            print(f"Baseline NOT updated: score {score} < baseline {baseline_score}", flush=True)

    if score_file:
        result_data: dict[str, Any] = {
            "score": score,
            "baseline": baseline_score,
            "passed": ci_passed,
            "cases_total": len(smoke_dataset.cases),
            "passing_cases": passing_now,
            "regressions": regressions,
            "model": baseline_key,
            "provider": provider,
        }
        Path(score_file).write_text(json.dumps(result_data, indent=2))

    return ci_passed


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    _auto_provider = "copilot" if os.getenv("GITHUB_COPILOT_API_TOKEN") else "ollama"

    _parser = argparse.ArgumentParser(
        description="Run smoke evals against the edge agent."
    )
    _parser.add_argument(
        "--provider",
        choices=["ollama", "copilot"],
        default=_auto_provider,
        help=(
            f"Model provider (default: auto-detected as '{_auto_provider}' "
            "based on GITHUB_COPILOT_API_TOKEN presence)"
        ),
    )
    _parser.add_argument(
        "--model",
        default=None,
        metavar="NAME",
        help=(
            f"Model name/tag (default: {_OLLAMA_DEFAULT_MODEL!r} for ollama, "
            f"{_COPILOT_DEFAULT_MODEL!r} for copilot)"
        ),
    )
    _parser.add_argument(
        "--base-url",
        default=None,
        metavar="URL",
        help="Ollama base URL including /v1 (ollama provider only; default: from env)",
    )
    _parser.add_argument(
        "--score-file",
        metavar="PATH",
        help="Write JSON score report to this file (for CI use).",
    )
    _parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="Overwrite the model-specific baseline when the new score exceeds it.",
    )
    _args = _parser.parse_args()

    if _args.provider == "ollama":
        _model_name = _args.model or _OLLAMA_DEFAULT_MODEL
        _model = build_ollama_model(_model_name, _args.base_url)
        _baseline_key = f"ollama:{_model_name}"
        _provider_label = "ollama"
        _http_client = None
    else:
        _model_name = _args.model or _COPILOT_DEFAULT_MODEL
        _http_client = httpx.AsyncClient(transport=_CopilotTransport())
        _model = build_copilot_model(_model_name, http_client=_http_client)
        _baseline_key = _model_name
        _provider_label = "github-copilot"

    try:
        run_eval(
            _model,
            baseline_key=_baseline_key,
            provider=_provider_label,
            score_file=_args.score_file,
            update_baseline=_args.update_baseline,
        )
    finally:
        if _http_client is not None:
            asyncio.run(_http_client.aclose())

