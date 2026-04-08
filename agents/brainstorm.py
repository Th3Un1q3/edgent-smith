"""Copilot Brainstorm Agent – generates experiment ideas and creates GitHub issues.

This is a GitHub Copilot custom agent (NOT a pydantic-ai agent).
It uses the GitHub CLI (`gh`) and GitHub REST API to create issues.
The Copilot CLI (`gh copilot`) is used for AI-assisted idea generation.

Responsibilities:
- Inspect the current edge agent implementation for improvement opportunities.
- Generate concrete, testable experiment hypotheses.
- Create a GitHub issue for each hypothesis, labeled 'experiment'.

Usage:
    python agents/brainstorm.py [--count N] [--repo OWNER/REPO]
"""

from __future__ import annotations

import json
import subprocess
import sys
from argparse import ArgumentParser
from pathlib import Path

# ── Experiment templates ───────────────────────────────────────────────────────
# Each template describes a class of experiment. The brainstorm agent expands
# these into concrete issues informed by the current agent state.

_ISSUE_BODY_TEMPLATE = """\
## Experiment hypothesis

{hypothesis}

## Mutation surface

{surface}

## Expected improvement

{improvement}

## Acceptance criteria

- Smoke eval: 100 % pass rate
- Benchmark eval: ≥ 80 % pass rate
- Latency regression: < 20 % vs baseline

## Instructions for the Copilot Implementation Agent

1. Read `.github/prompts/implement_candidate.prompt.md` for implementation guidelines.
2. Apply the minimal change described above to the mutation surface.
3. Run `python -m pytest tests/ -q` to confirm tests pass.
4. Run `python -m ruff check agents/ evals/ tests/` to confirm lint passes.
5. Commit, push a new branch, open a PR, and comment back on this issue.
"""


def _run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a shell command and return the result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def _gh_available() -> bool:
    result = _run(["gh", "--version"], check=False)
    return result.returncode == 0


def _copilot_suggest(prompt: str) -> str:
    """Ask the GitHub Copilot CLI for a suggestion and return the text."""
    result = _run(
        ["gh", "copilot", "suggest", "-t", "shell", prompt],
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def _create_issue(title: str, body: str, repo: str | None) -> str:
    """Create a GitHub issue and return its URL."""
    cmd = ["gh", "issue", "create", "--title", title, "--body", body, "--label", "experiment"]
    if repo:
        cmd += ["--repo", repo]
    result = _run(cmd)
    return result.stdout.strip()


def _read_agent_source() -> str:
    """Return the current edge agent source for context."""
    src = Path(__file__).parent / "edge.py"
    return src.read_text(encoding="utf-8") if src.exists() else ""


def brainstorm(count: int = 3, repo: str | None = None) -> list[str]:
    """Generate *count* experiment ideas and create GitHub issues for each.

    Returns the list of created issue URLs.
    """
    if not _gh_available():
        print("ERROR: `gh` CLI is not available. Install it and authenticate.", file=sys.stderr)
        sys.exit(1)

    agent_src = _read_agent_source()

    # Ask Copilot CLI to suggest experiment ideas based on the current agent
    prompt = (
        "Given this edge AI agent implementation, suggest "
        f"{count} concrete experiment hypotheses to improve it. "
        "For each, output a JSON object with keys: title, hypothesis, surface, improvement. "
        f"Agent source:\n\n{agent_src[:2000]}"
    )
    suggestion = _copilot_suggest(prompt)

    # Parse suggestions or fall back to defaults
    experiments: list[dict[str, str]] = []
    try:
        # Copilot CLI may wrap JSON in markdown code fences
        json_str = suggestion.strip().removeprefix("```json").removesuffix("```").strip()
        parsed = json.loads(json_str)
        experiments = parsed if isinstance(parsed, list) else [parsed]
    except (json.JSONDecodeError, ValueError):
        # Fallback: generic system-prompt experiment
        experiments = [
            {
                "title": "experiment: shorten system prompt",
                "hypothesis": "A shorter system prompt reduces latency without quality loss.",
                "surface": "agents/edge.py (_SYSTEM constant)",
                "improvement": "Reduced avg latency on smoke eval",
            }
        ]

    urls: list[str] = []
    for exp in experiments[:count]:
        body = _ISSUE_BODY_TEMPLATE.format(
            hypothesis=exp.get("hypothesis", ""),
            surface=exp.get("surface", "agents/edge.py"),
            improvement=exp.get("improvement", ""),
        )
        url = _create_issue(exp.get("title", "experiment: untitled"), body, repo)
        print(f"Created issue: {url}")
        urls.append(url)

    return urls


if __name__ == "__main__":
    parser = ArgumentParser(description="Brainstorm experiment ideas and create GitHub issues.")
    parser.add_argument("--count", type=int, default=3, help="Number of ideas to generate")
    parser.add_argument("--repo", type=str, default=None, help="OWNER/REPO (default: current)")
    args = parser.parse_args()
    brainstorm(count=args.count, repo=args.repo)
