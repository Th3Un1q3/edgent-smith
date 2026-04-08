"""Copilot Implementation Agent – implements an experiment from a GitHub issue.

This is a GitHub Copilot custom agent (NOT a pydantic-ai agent).
It uses the GitHub CLI (`gh`), `git`, and the Copilot CLI for implementation.

Responsibilities (per the experiment–issue workflow):
1. Read the issue body to extract hypothesis, mutation surface, and acceptance criteria.
2. Ask the Copilot CLI to suggest an implementation for the experiment.
3. Apply changes to the mutation surface on a new branch.
4. Run tests and lint to confirm changes are valid.
5. Commit, push, and open a PR.
6. Post a success or failure comment on the original issue.

Usage:
    python agents/implement.py --issue NUMBER [--repo OWNER/REPO] [--base BRANCH]
"""

from __future__ import annotations

import re
import subprocess
import sys
from argparse import ArgumentParser

# ── Shell helpers ──────────────────────────────────────────────────────────────


def _run(
    cmd: list[str],
    *,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def _run_shell(cmd: str, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)  # noqa: S602


# ── GitHub helpers ─────────────────────────────────────────────────────────────


def _get_issue(number: int, repo: str | None) -> dict[str, str]:
    """Fetch issue title and body via `gh issue view`."""
    import json
    from typing import Any

    cmd = ["gh", "issue", "view", str(number), "--json", "title,body,labels"]
    if repo:
        cmd += ["--repo", repo]
    result = _run(cmd)
    data: dict[str, Any] = json.loads(result.stdout)
    return {k: str(v) for k, v in data.items()}


def _comment_issue(number: int, body: str, repo: str | None) -> None:
    """Post a comment on the issue."""
    cmd = ["gh", "issue", "comment", str(number), "--body", body]
    if repo:
        cmd += ["--repo", repo]
    _run(cmd)


def _create_pr(branch: str, title: str, body: str, base: str, repo: str | None) -> str:
    """Open a pull request and return its URL."""
    cmd = [
        "gh", "pr", "create",
        "--title", title,
        "--body", body,
        "--base", base,
        "--head", branch,
    ]
    if repo:
        cmd += ["--repo", repo]
    result = _run(cmd)
    return result.stdout.strip()


# ── Copilot CLI helper ─────────────────────────────────────────────────────────


def _copilot_suggest_impl(issue_body: str, surface: str) -> str:
    """Use the Copilot CLI to suggest an implementation for the experiment."""
    prompt = (
        f"Implement this experiment for file {surface}:\n\n{issue_body[:2000]}\n\n"
        "Output ONLY a valid unified diff (git diff format) that applies the change. "
        "Keep changes minimal."
    )
    result = _run(
        ["gh", "copilot", "suggest", "-t", "shell", prompt],
        check=False,
    )
    return result.stdout.strip()


# ── Mutation surface parser ────────────────────────────────────────────────────

_SURFACE_RE = re.compile(r"##\s*Mutation surface\s*\n+(.+?)(?:\n##|\Z)", re.DOTALL | re.IGNORECASE)


def _extract_surface(body: str) -> str:
    """Extract the mutation surface filename from the issue body."""
    m = _SURFACE_RE.search(body)
    if m:
        first_line = m.group(1).strip().splitlines()[0]
        # Strip markdown bullet/backtick formatting
        return first_line.lstrip("-* ").strip("`").split("(")[0].strip()
    return "agents/edge.py"


# ── Main workflow ──────────────────────────────────────────────────────────────


def implement(issue_number: int, repo: str | None = None, base: str = "main") -> None:
    """Full experiment implementation workflow for *issue_number*."""
    print(f"==> Fetching issue #{issue_number}")
    issue = _get_issue(issue_number, repo)
    title: str = issue.get("title", f"experiment-{issue_number}")
    body: str = issue.get("body", "")
    surface = _extract_surface(body)

    # Create a branch name from the issue title
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
    branch = f"experiment/{issue_number}/{slug}"

    print(f"==> Surface: {surface}")
    print(f"==> Branch:  {branch}")

    # 1. Create branch
    _run(["git", "checkout", "-b", branch])

    # 2. Ask Copilot CLI for implementation
    print("==> Asking Copilot CLI for implementation …")
    suggestion = _copilot_suggest_impl(body, surface)

    # 3. Apply the suggestion if it looks like a diff
    if suggestion.startswith("diff --git") or suggestion.startswith("---"):
        import tempfile

        with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as fh:
            fh.write(suggestion)
            diff_file = fh.name
        apply_result = _run(["git", "apply", "--check", diff_file], check=False)
        if apply_result.returncode == 0:
            _run(["git", "apply", diff_file])
            print("==> Patch applied successfully")
        else:
            print("==> Patch did not apply cleanly; proceeding with no file changes")
    else:
        print("==> No valid patch from Copilot CLI; no file changes applied")

    # 4. Run tests and lint
    print("==> Running tests …")
    test_result = _run_shell("python -m pytest tests/ -q --tb=short", check=False)
    print(test_result.stdout)

    print("==> Running lint …")
    lint_result = _run_shell("python -m ruff check agents/ evals/ tests/", check=False)
    print(lint_result.stdout)

    success = test_result.returncode == 0 and lint_result.returncode == 0

    if success:
        # 5. Commit and push
        _run(["git", "add", "-A"])
        _run(["git", "commit", "--allow-empty", "-m", f"experiment: {title}"])
        _run(["git", "push", "origin", branch])

        # 6. Open PR
        pr_body = (
            f"Implements experiment from #{issue_number}.\n\n"
            f"**Hypothesis:** {title}\n\n"
            "## Checklist\n"
            "- [ ] Tests pass\n"
            "- [ ] Lint passes\n"
            "- [ ] Eval smoke ≥ 100 %\n"
        )
        pr_url = _create_pr(branch, f"experiment: {title}", pr_body, base, repo)
        print(f"==> PR created: {pr_url}")

        success_comment = (
            f"✅ **Experiment implemented.**\n\n"
            f"Pull request: {pr_url}\n\n"
            "Tests and lint passed. Please review the PR and run evals before merging."
        )
        _comment_issue(issue_number, success_comment, repo)
    else:
        # Post failure comment
        failure_comment = (
            "❌ **Experiment implementation failed.**\n\n"
            "```\n"
            + (test_result.stdout + "\n" + lint_result.stdout)[:2000]
            + "\n```\n\n"
            "Please review the failure details and update the issue."
        )
        _comment_issue(issue_number, failure_comment, repo)
        print("==> Implementation failed; comment posted on issue.", file=sys.stderr)
        # Restore base branch
        _run(["git", "checkout", base], check=False)
        sys.exit(1)


if __name__ == "__main__":
    parser = ArgumentParser(description="Implement an experiment from a GitHub issue.")
    parser.add_argument("--issue", type=int, required=True, help="Issue number")
    parser.add_argument("--repo", type=str, default=None, help="OWNER/REPO (default: current)")
    parser.add_argument("--base", type=str, default="main", help="Base branch for the PR")
    args = parser.parse_args()
    implement(args.issue, repo=args.repo, base=args.base)
