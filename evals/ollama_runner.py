"""Run smoke evaluations against the edge agent using a local Ollama instance.

This is the canonical runner for Ollama-backed evals.  It mirrors
``evals/copilot_runner.py`` in structure: it builds the model, injects it into
the agent at call-time, and then runs the shared smoke dataset.

The model is constructed with pydantic-ai's built-in ``OllamaProvider``.
Small local models (e.g. ``gemma4:e2b``) work best with Ollama's native
``response_format/json_schema`` structured-output mode instead of the default
tool-call mode, so the profile is configured accordingly.

Requirements
------------
Run **inside the DevContainer** (``devcontainer up --workspace-folder .``).
The devcontainer sets ``EDGENT_OLLAMA_BASE_URL`` automatically.

If the variable is already set to the correct ``/v1`` URL (e.g. by the host
environment), ``OLLAMA_BASE_URL`` takes precedence and no bridging occurs.

Usage
-----
::

    # Inside the DevContainer
    python evals/ollama_runner.py

    # Choose a different model
    python evals/ollama_runner.py --model llama3.2:3b

    # Write a JSON score report (same format as copilot_runner.py --score-file)
    python evals/ollama_runner.py --score-file /tmp/score.json

    # Update evals/{model}.baseline.json when the new score beats the current one
    python evals/ollama_runner.py --update-baseline
"""

from __future__ import annotations

import os

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.profiles.openai import OpenAIModelProfile
from pydantic_ai.providers.ollama import OllamaProvider

# ── Constants ──────────────────────────────────────────────────────────────────

_DEFAULT_MODEL = "gemma4:e2b"
_DEFAULT_BASE_URL = "http://localhost:11434"


# ── Model factory ──────────────────────────────────────────────────────────────


def _resolve_base_url() -> str:
    """Return the Ollama base URL with the required ``/v1`` suffix.

    Priority:
    1. ``OLLAMA_BASE_URL`` – used as-is (caller's responsibility to include ``/v1``).
    2. ``EDGENT_OLLAMA_BASE_URL`` – normalised to include ``/v1``.
    3. ``_DEFAULT_BASE_URL`` – the standard local Ollama address.
    """
    if url := os.getenv("OLLAMA_BASE_URL"):
        return url
    raw = os.getenv("EDGENT_OLLAMA_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")
    return raw if raw.endswith("/v1") else f"{raw}/v1"


def build_ollama_model(
    model_name: str = _DEFAULT_MODEL,
    base_url: str | None = None,
) -> OpenAIChatModel:
    """Return an ``OpenAIChatModel`` backed by a local Ollama instance.

    Small local models reliably produce structured output via Ollama's native
    ``response_format/json_schema`` endpoint.  The ``native`` structured-output
    mode instructs pydantic-ai to use that endpoint instead of tool-call JSON.

    Args:
        model_name: Ollama model tag (e.g. ``"gemma4:e2b"``).
        base_url: Ollama base URL including ``/v1`` suffix.  Defaults to the
            value resolved from ``OLLAMA_BASE_URL`` / ``EDGENT_OLLAMA_BASE_URL``.
    """
    resolved_url = base_url or _resolve_base_url()
    profile = OpenAIModelProfile(
        default_structured_output_mode="native",
        supports_json_schema_output=True,
    )
    return OpenAIChatModel(
        model_name,
        provider=OllamaProvider(base_url=resolved_url),
        profile=profile,
    )


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    from evals.runner import run_eval

    _parser = argparse.ArgumentParser(
        description="Run smoke evals against the edge agent using a local Ollama instance."
    )
    _parser.add_argument(
        "--model",
        default=_DEFAULT_MODEL,
        metavar="NAME",
        help=f"Ollama model tag (default: {_DEFAULT_MODEL})",
    )
    _parser.add_argument(
        "--base-url",
        default=None,
        metavar="URL",
        help="Ollama base URL including /v1 (default: resolved from env vars)",
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

    _model = build_ollama_model(_args.model, _args.base_url)
    run_eval(
        _model,
        baseline_key=f"ollama:{_args.model}",
        provider="ollama",
        model_label=f"ollama:{_args.model}",
        score_file=_args.score_file,
        update_baseline=_args.update_baseline,
    )
