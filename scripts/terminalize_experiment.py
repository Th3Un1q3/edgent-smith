#!/usr/bin/env python3
"""Terminalize the experiment issue and update shared state.

Receives all outcome variables as CLI arguments, selects the right comment
body, calls gh CLI for labels/comment, and persists the terminal state.

Usage (all args required):
    python3 scripts/terminalize_experiment.py \\
        --issue-number N \\
        --repo OWNER/REPO \\
        --run-url URL \\
        --state-path PATH \\
        --job-cancelled true|false \\
        --experiment-status STATUS \\
        --baseline-score N \\
        --candidate-score N \\
        --score-delta N \\
        --promotion-outcome success|failure|skipped|cancelled \\
        --commit-push-outcome success|failure|skipped|cancelled
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd: list[str]) -> str:
    """Run a command and return stdout. Raises on non-zero exit."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"::error::{' '.join(cmd)} failed: {result.stderr.strip()}", file=sys.stderr)
        raise subprocess.CalledProcessError(result.returncode, cmd)
    return result.stdout.strip()


def build_comment(
    *,
    final_status: str,
    run_url: str,
    baseline_score: str,
    candidate_score: str,
    score_delta: str,
) -> str:
    if final_status == "cancelled":
        return (
            "⏹ **Experiment was cancelled.**\n\n"
            "| Metric | Value |\n|--------|-------|\n"
            f"| Reason | Workflow run was cancelled before completion |\n"
            f"| Run    | {run_url} |"
        )
    if final_status == "timed_out":
        return (
            "⏱ **Experiment timed out.**\n\n"
            "| Metric | Value |\n|--------|-------|\n"
            "| Reason | Experiment runner exceeded the 25 minute step budget |\n"
            f"| Run    | {run_url} |"
        )
    if final_status == "succeeded":
        return (
            "✅ **Experiment passed baseline.**\n\n"
            "| Metric   | Value |\n|----------|-------|\n"
            f"| Score    | `{candidate_score}` |\n"
            f"| Baseline | `{baseline_score}` |\n"
            f"| Delta    | `{score_delta}` |\n"
            "| Branch   | `auto_research` |\n"
            f"| Run      | {run_url} |\n\n"
            "The changes have been committed and pushed to the existing auto_research branch."
        )
    if final_status == "promotion_failed":
        return (
            "❌ **Experiment did not pass.**\n\n"
            "| Metric   | Value |\n|----------|-------|\n"
            "| Reason   | Baseline promotion failed —"
            " candidate score was not greater than the current baseline |\n"
            f"| Score    | `{candidate_score}` |\n"
            f"| Baseline | `{baseline_score}` |\n"
            f"| Delta    | `{score_delta}` |\n"
            f"| Run      | {run_url} |\n\n"
            "The baseline candidate was generated successfully,"
            " but it did not improve on the existing baseline."
        )
    if final_status == "post_candidate_failed":
        return (
            "❌ **Experiment promotion succeeded, but later workflow side effects failed.**\n\n"
            "| Metric   | Value |\n|----------|-------|\n"
            "| Reason   | Promotion was applied, but the final commit"
            " or push step did not complete successfully |\n"
            f"| Score    | `{candidate_score}` |\n"
            f"| Baseline | `{baseline_score}` |\n"
            f"| Delta    | `{score_delta}` |\n"
            f"| Run      | {run_url} |\n\n"
            "Inspect the workflow logs before re-labelling this issue."
        )
    if final_status == "failed":
        return (
            "❌ **Experiment did not pass.**\n\n"
            "| Metric   | Value |\n|----------|-------|\n"
            "| Reason   | Candidate score did not improve the baseline"
            " after the configured follow-up attempts |\n"
            f"| Score    | `{candidate_score}` |\n"
            f"| Baseline | `{baseline_score}` |\n"
            f"| Delta    | `{score_delta}` |\n"
            f"| Run      | {run_url} |"
        )
    # Fallback
    return (
        "❌ **Experiment failed unexpectedly.**\n\n"
        "| Metric | Value |\n|--------|-------|\n"
        "| Reason | Workflow step error before the runner contract completed |\n"
        f"| Run    | {run_url} |\n\n"
        "Check the workflow logs for details before re-labelling."
    )


def determine_final_status(
    *,
    job_cancelled: bool,
    experiment_status: str,
    promotion_outcome: str,
    commit_push_outcome: str,
) -> tuple[str, str]:
    """Return (final_status, label_name)."""
    if job_cancelled:
        return "cancelled", "experiment-failure"
    if experiment_status == "timed_out":
        return "timed_out", "experiment-failure"
    if experiment_status == "candidate_ready" and promotion_outcome != "success":
        return "promotion_failed", "experiment-failure"
    if (
        experiment_status == "candidate_ready"
        and promotion_outcome == "success"
        and commit_push_outcome == "success"
    ):
        return "succeeded", "experiment-success"
    if experiment_status == "candidate_ready" and promotion_outcome == "success":
        return "post_candidate_failed", "experiment-failure"
    if experiment_status == "failed":
        return "failed", "experiment-failure"
    return "failed", "experiment-failure"


def update_state(
    state_path: Path,
    *,
    issue_number: int,
    final_status: str,
    promotion_applied: bool,
    commit_pushed: bool,
    status_comment_id: str,
) -> None:
    data = json.loads(state_path.read_text()) if state_path.exists() else {}
    issue = data.get("issue")
    if not isinstance(issue, dict):
        issue = {}
    issue["number"] = issue_number
    data["issue"] = issue
    data["issue_number"] = issue_number
    data.setdefault("attempts", [])
    if data["attempts"]:
        data["attempts"][-1]["status"] = final_status
    data["promotion_applied"] = bool(data.get("promotion_applied", False) or promotion_applied)
    data["commit_pushed"] = bool(data.get("commit_pushed", False) or commit_pushed)
    data.setdefault("replenishment_issue_number", None)
    if status_comment_id:
        data["status_comment_id"] = int(status_comment_id)
    else:
        data.setdefault("status_comment_id", None)
    state_path.write_text(json.dumps(data, indent=2) + "\n")


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--issue-number", type=int, required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--run-url", required=True)
    p.add_argument("--state-path", required=True)
    p.add_argument("--job-cancelled", required=True)
    p.add_argument("--experiment-status", required=True)
    p.add_argument("--baseline-score", default="")
    p.add_argument("--candidate-score", default="")
    p.add_argument("--score-delta", default="")
    p.add_argument("--promotion-outcome", required=True)
    p.add_argument("--commit-push-outcome", required=True)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    job_cancelled = args.job_cancelled.lower() == "true"
    promotion_outcome = args.promotion_outcome
    commit_push_outcome = args.commit_push_outcome

    final_status, label_name = determine_final_status(
        job_cancelled=job_cancelled,
        experiment_status=args.experiment_status,
        promotion_outcome=promotion_outcome,
        commit_push_outcome=commit_push_outcome,
    )

    promotion_applied = promotion_outcome == "success"
    commit_pushed = commit_push_outcome == "success"

    comment_body = build_comment(
        final_status=final_status,
        run_url=args.run_url,
        baseline_score=args.baseline_score,
        candidate_score=args.candidate_score,
        score_delta=args.score_delta,
    )

    # Create outcome labels
    run(
        [
            "gh",
            "label",
            "create",
            "experiment-failure",
            "--color",
            "d93f0b",
            "--description",
            "Experiment did not pass",
            "--force",
        ]
    )
    run(
        [
            "gh",
            "label",
            "create",
            "experiment-success",
            "--color",
            "0e8a16",
            "--description",
            "Experiment passed baseline",
            "--force",
        ]
    )

    side_effect_failure = 0

    try:
        run(["gh", "issue", "edit", str(args.issue_number), "--add-label", label_name])
    except subprocess.CalledProcessError:
        side_effect_failure = 1

    status_comment_id = ""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        json.dump({"body": comment_body}, tmp)
        payload_path = tmp.name
    try:
        status_comment_id = run(
            [
                "gh",
                "api",
                f"repos/{args.repo}/issues/{args.issue_number}/comments",
                "--method",
                "POST",
                "--input",
                payload_path,
                "--jq",
                ".id",
            ]
        )
    except subprocess.CalledProcessError:
        side_effect_failure = 1
        status_comment_id = ""

    update_state(
        Path(args.state_path),
        issue_number=args.issue_number,
        final_status=final_status,
        promotion_applied=promotion_applied,
        commit_pushed=commit_pushed,
        status_comment_id=status_comment_id,
    )

    if side_effect_failure:
        print(
            "::error::Failed to apply one or more terminal workflow side effects.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
