"""Run smoke evaluations using the GitHub Copilot API as the model backend.

Use this script whenever Ollama is unavailable.  The most common scenario is
the Copilot agent sandbox: the host has Python 3.12 and no Ollama daemon, and
the Docker network inside the DevContainer blocks outbound traffic to
``api.githubcopilot.com``.  In that case run this script **from the sandbox
host** (not inside the DevContainer).

The GitHub Copilot chat-completions endpoint is OpenAI-compatible but omits
``"object": "chat.completion"`` from its responses.  ``CopilotTransport``
patches that field transparently before pydantic-ai deserialises the response.

Network requirements
--------------------
``api.githubcopilot.com`` must be reachable.  This is true on the sandbox host
but **not** inside the DevContainer (Docker blocks outbound traffic to that
host from within the container network).

Requirements
------------
- Package installed:  ``pip install -e ".[dev]" --ignore-requires-python``
- Token exported:     ``export GITHUB_COPILOT_API_TOKEN=<token>``

The token is already available as ``GITHUB_COPILOT_API_TOKEN`` in the Copilot
agent sandbox.

Usage
-----
::

    # Run from the sandbox host (not inside the DevContainer)
    GITHUB_COPILOT_API_TOKEN=$GITHUB_COPILOT_API_TOKEN \\
      python evals/copilot_runner.py

    # Different model
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
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from agents.edge import _SYSTEM, AgentOutput
from evals.smoke import _BASELINE_FILE, _read_baseline, smoke_dataset

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


# ── Agent factory ──────────────────────────────────────────────────────────────


def build_copilot_agent(model_name: str = _DEFAULT_MODEL) -> Agent[None, AgentOutput]:
    """Return an edge agent that uses the GitHub Copilot API as its backend.

    Reads ``GITHUB_COPILOT_API_TOKEN`` from the environment.
    """
    token = os.environ["GITHUB_COPILOT_API_TOKEN"]
    openai_client = AsyncOpenAI(
        base_url=_COPILOT_BASE_URL,
        api_key=token,
        http_client=httpx.AsyncClient(transport=CopilotTransport()),
    )
    provider = OpenAIProvider(openai_client=openai_client)
    model = OpenAIChatModel(model_name, provider=provider)
    return Agent(model, output_type=AgentOutput, system_prompt=_SYSTEM)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    _parser = argparse.ArgumentParser(
        description="Smoke evals via GitHub Copilot API (fallback when Ollama is unavailable)."
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

    _agent = build_copilot_agent(_args.model)

    async def _run(prompt: str) -> AgentOutput:
        result = await _agent.run(prompt)
        return result.output

    _report = smoke_dataset.evaluate_sync(_run)
    _report.print(include_input=True, include_output=True)

    _avg = _report.averages()
    _score = float(_avg.assertions) if _avg and _avg.assertions is not None else 0.0
    _baseline, _baseline_data = _read_baseline()
    print(f"\nCI score: {_score:.4f}  (baseline: {_baseline})", flush=True)

    if _args.update_baseline:
        if _score > _baseline:
            _baseline_data["score"] = round(_score, 4)
            _BASELINE_FILE.write_text(json.dumps(_baseline_data, indent=2) + "\n")
            print(f"Baseline updated: {_baseline} → {_score:.4f}", flush=True)
        elif _score == _baseline:
            print(f"Baseline unchanged: {_baseline} (score equal)", flush=True)
        else:
            print(f"Baseline NOT updated: score {_score:.4f} < baseline {_baseline}", flush=True)

    if _args.score_file:
        Path(_args.score_file).write_text(
            json.dumps(
                {
                    "score": round(_score, 4),
                    "baseline": _baseline,
                    "passed": _score >= _baseline,
                    "cases_total": len(smoke_dataset.cases),
                    "model": _args.model,
                    "provider": "github-copilot",
                },
                indent=2,
            )
        )
