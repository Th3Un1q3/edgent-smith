"""Run smoke evaluations against the edge agent using the GitHub Copilot API.

Use this script whenever Ollama is unavailable (e.g. the Ollama registry is
blocked in the sandbox).  It runs the *same* smoke dataset and the *same*
edge agent that ``evals/smoke.py`` targets — the only difference is the model
backend: instead of Ollama, the agent is driven by the GitHub Copilot API.

The GitHub Copilot chat-completions endpoint is OpenAI-compatible but omits
``"object": "chat.completion"`` from its responses.  ``CopilotTransport``
patches that field transparently before pydantic-ai deserialises the response.

Requirements
------------
Run **inside the DevContainer** (``devcontainer up --workspace-folder .``).
The devcontainer forwards ``GITHUB_COPILOT_API_TOKEN`` and sets
``SSL_CERT_FILE`` automatically via ``docker-compose.yml``.

If starting the container manually (e.g. with ``docker exec``), pass the
token explicitly::

    docker exec \\
      -e GITHUB_COPILOT_API_TOKEN="$GITHUB_COPILOT_API_TOKEN" \\
      -e SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \\
      devcontainer-devcontainer-1 \\
      bash -c "cd /workspace && python evals/copilot_runner.py"

Usage
-----
::

    # Inside the DevContainer
    python evals/copilot_runner.py

    # Choose a different model
    python evals/copilot_runner.py --model gpt-4o-2024-11-20

    # Write a JSON score report (same format as evals/smoke.py --score-file)
    python evals/copilot_runner.py --score-file /tmp/score.json

    # Update evals/baseline.json when the new score beats the current one
    python evals/copilot_runner.py --update-baseline
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from agents.edge import AgentOutput
from agents.edge import agent as edge_agent
from evals.smoke import _BASELINE_FILE, _read_baseline, case_pass_results, smoke_dataset

# ── Constants ──────────────────────────────────────────────────────────────────

_COPILOT_BASE_URL = "https://api.githubcopilot.com"
_DEFAULT_MODEL = "gpt-4o-mini-2024-07-18"


# ── Transport patch ────────────────────────────────────────────────────────────


class CopilotTransport(httpx.AsyncHTTPTransport):
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
                    response = httpx.Response(
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        content=patched,
                        request=request,
                    )
            except (json.JSONDecodeError, KeyError):
                pass
        return response


# ── Model factory ──────────────────────────────────────────────────────────────


def build_copilot_model(model_name: str = _DEFAULT_MODEL) -> OpenAIChatModel:
    """Return an OpenAIChatModel backed by the GitHub Copilot API.

    Reads ``GITHUB_COPILOT_API_TOKEN`` from the environment.
    """
    token = os.environ["GITHUB_COPILOT_API_TOKEN"]
    openai_client = AsyncOpenAI(
        base_url=_COPILOT_BASE_URL,
        api_key=token,
        http_client=httpx.AsyncClient(transport=CopilotTransport()),
    )
    provider = OpenAIProvider(openai_client=openai_client)
    return OpenAIChatModel(model_name, provider=provider)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    _parser = argparse.ArgumentParser(
        description=(
            "Run smoke evals against the edge agent using the GitHub Copilot API "
            "(fallback when Ollama is unavailable)."
        )
    )
    _parser.add_argument(
        "--model",
        default=_DEFAULT_MODEL,
        metavar="NAME",
        help=f"Copilot model name (default: {_DEFAULT_MODEL})",
    )
    _parser.add_argument(
        "--score-file",
        metavar="PATH",
        help="Write JSON score report to this file (for CI use).",
    )
    _parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="Overwrite evals/baseline.json when the new score exceeds the current baseline.",
    )
    _args = _parser.parse_args()

    _model = build_copilot_model(_args.model)

    async def _run(prompt: str) -> AgentOutput:
        result = await edge_agent.run(prompt, model=_model)
        return result.output

    _report = smoke_dataset.evaluate_sync(_run)
    _report.print(include_input=True, include_output=True)

    _pass_results = case_pass_results(_report)
    _passing_now = [name for name, passed in _pass_results.items() if passed]
    _score = len(_passing_now)
    _baseline_score, _baseline_passing, _baseline_data = _read_baseline()
    _regressions = [name for name in _baseline_passing if not _pass_results.get(name, False)]

    print(f"\nCI score: {_score}  (baseline: {_baseline_score})", flush=True)
    if _regressions:
        print(f"REGRESSIONS detected: {_regressions}", flush=True)

    _ci_passed = _score >= _baseline_score and not _regressions

    if _args.update_baseline:
        if _score > _baseline_score:
            _baseline_data["score"] = _score
            _baseline_data["passing_cases"] = _passing_now
            _BASELINE_FILE.write_text(json.dumps(_baseline_data, indent=2) + "\n")
            print(f"Baseline updated: {_baseline_score} → {_score}", flush=True)
        elif _score == _baseline_score:
            print(f"Baseline unchanged: {_baseline_score} (score equal)", flush=True)
        else:
            print(f"Baseline NOT updated: score {_score} < baseline {_baseline_score}", flush=True)

    if _args.score_file:
        Path(_args.score_file).write_text(
            json.dumps(
                {
                    "score": _score,
                    "baseline": _baseline_score,
                    "passed": _ci_passed,
                    "cases_total": len(smoke_dataset.cases),
                    "passing_cases": _passing_now,
                    "regressions": _regressions,
                    "model": _args.model,
                    "provider": "github-copilot",
                },
                indent=2,
            )
        )

