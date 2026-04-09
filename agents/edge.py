"""Edge-optimized agent – single-file implementation with inline tools.

All tools are defined inline.  The agent is model-agnostic: the default model
is a string resolved from environment variables and may be overridden at
call-time via ``agent.run(prompt, model=...)``.  Provider-specific setup
(Ollama, GitHub Copilot, …) belongs in the eval runner, not here.

Usage (programmatic):
    from agents.edge import agent, run_agent

Usage (CLI):
    python agents/edge.py "What is 2+2?"
"""

from __future__ import annotations

import asyncio
import math
import os
import re
import sys
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from pydantic_ai import Agent

# ── Model ──────────────────────────────────────────────────────────────────────
# Resolved from EDGENT_MODEL (full override) or EDGENT_MODEL_PROVIDER + EDGENT_MODEL_NAME.
# Provider-specific setup (base-URL, structured-output profile, etc.) is handled
# by the eval runner (evals/runner.py), not here.
_provider = os.getenv("EDGENT_MODEL_PROVIDER", "ollama")
_model_name = os.getenv("EDGENT_MODEL_NAME", "gemma4:e2b")
_MODEL = os.getenv("EDGENT_MODEL", f"{_provider}:{_model_name}")

# ── I/O schemas ────────────────────────────────────────────────────────────────


class AgentOutput(BaseModel):
    """Structured output returned by the edge agent."""

    answer: str = Field(description="The agent's direct response")
    confidence: str = Field(
        default="medium",
        description="Self-reported confidence: high | medium | low | abstain",
    )
    tool_calls_used: int = Field(default=0, description="Number of tools invoked")


# ── System prompt ──────────────────────────────────────────────────────────────
_SYSTEM = """\
You are a precise, efficient assistant designed for edge deployment on constrained hardware.
- Keep responses concise and factual. Avoid verbosity.
- Use tools only when necessary. Prefer reasoning from context.
- If uncertain or the task is outside your knowledge, say so (confidence: abstain).
- Never fabricate facts. Accuracy over completeness.
- Respect the token budget: prefer shorter, correct answers.
"""

# ── Agent ──────────────────────────────────────────────────────────────────────
# defer_model_check=True: model is validated lazily on first run, not at import.
# This lets tests override with TestModel without needing a real provider.
agent: Agent[None, AgentOutput] = Agent(
    _MODEL,
    output_type=AgentOutput,
    system_prompt=_SYSTEM,
    defer_model_check=True,
)

# ── Inline tools ───────────────────────────────────────────────────────────────

_MATH_NS: dict[str, object] = {
    name: getattr(math, name) for name in dir(math) if not name.startswith("_")
}
_SAFE_EXPR = re.compile(r"[\d\s\+\-\*\/\.\(\)]+$")


@agent.tool_plain
def current_datetime() -> str:
    """Return the current UTC date and time as an ISO 8601 string."""
    return datetime.now(tz=UTC).isoformat()


@agent.tool_plain
def calculator(expression: str) -> str:
    """Evaluate a simple arithmetic expression.

    Supports: +, -, *, /, ** (power), (, ), digits, decimals.
    Returns an error message if the expression is invalid or unsafe.
    """
    if not _SAFE_EXPR.match(expression):
        return "Error: expression contains invalid characters"
    try:
        result = eval(expression, {"__builtins__": {}}, _MATH_NS)  # noqa: S307
        return str(result)
    except Exception as exc:
        return f"Error: {exc}"


@agent.tool_plain
def web_search_stub(query: str) -> str:
    """Stub web-search tool for offline/edge environments.

    Replace the body with a real search backend when one is available.
    """
    return (
        f"[web_search_stub] query='{query}' – "
        "no external search backend is configured in this deployment. "
        "Answer from context only."
    )


# ── Convenience runner ─────────────────────────────────────────────────────────


async def run_agent(prompt: str) -> AgentOutput:
    """Run the agent with *prompt* and return structured output."""
    result = await agent.run(prompt)
    return result.output


# ── Issue-monitoring mode (called by experiment.yml workflow) ──────────────────


def _handle_issue_comment(issue_number: str, comment_body: str) -> None:
    """React to a success or failure comment posted on an experiment issue.

    This is the Edge Agent's continuation logic (step 6 in the workflow):
    - Success (✅): log and optionally trigger the next experiment.
    - Failure (❌): log and optionally re-label the issue for retry.
    """
    import subprocess

    body_lower = comment_body.lower()
    if "✅" in comment_body or "experiment implemented" in body_lower:
        print(f"Issue #{issue_number}: experiment succeeded – nothing more to do.")
    elif "❌" in comment_body or "implementation failed" in body_lower:
        print(f"Issue #{issue_number}: experiment failed – posting triage note.")
        triage = (
            "🔄 The Edge Agent has detected a failure. "
            "Please review the error details above and update the issue body "
            "with a revised hypothesis or contact the maintainer."
        )
        subprocess.run(  # noqa: S603
            ["gh", "issue", "comment", issue_number, "--body", triage],
            check=False,
        )
    else:
        print(f"Issue #{issue_number}: unrecognised comment; no action taken.")


# ── CLI entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from argparse import ArgumentParser

    parser = ArgumentParser(description="Edge agent – run a prompt or process an issue comment.")
    parser.add_argument("prompt", nargs="?", help="Prompt to run (interactive mode)")
    parser.add_argument("--issue-number", help="Issue number (workflow mode)")
    parser.add_argument("--comment-body", help="Comment body to react to (workflow mode)")
    args = parser.parse_args()

    if args.issue_number and args.comment_body is not None:
        _handle_issue_comment(args.issue_number, args.comment_body)
    elif args.prompt:
        output = asyncio.run(run_agent(args.prompt))
        print(f"answer:     {output.answer}")
        print(f"confidence: {output.confidence}")
        print(f"tool_calls: {output.tool_calls_used}")
    else:
        parser.print_help(sys.stderr)
        sys.exit(1)

