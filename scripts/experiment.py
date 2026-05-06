#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
TERMINAL_ATTEMPT_STATUSES = {
    "candidate_ready",
    "failed",
    "crashed",
    "promotion_failed",
    "post_candidate_failed",
    "succeeded",
    "timed_out",
    "cancelled",
}


def sanitize_baseline_id(baseline_id: str) -> str:
    return baseline_id.replace("/", "_").replace(":", "_")


def baseline_file(baseline_id: str) -> Path:
    safe_id = sanitize_baseline_id(baseline_id)
    return REPO_ROOT / f"{safe_id}.baseline.json"


def baseline_candidate_file(baseline_id: str) -> Path:
    safe_id = sanitize_baseline_id(baseline_id)
    return REPO_ROOT / f"{safe_id}.baseline-candidate.json"


def state_file(issue_number: int | None = None, explicit_path: str | Path | None = None) -> Path:
    if explicit_path is not None:
        return Path(explicit_path)
    issue_key = str(issue_number) if issue_number is not None else "manual"
    return REPO_ROOT / "experiments" / f"{issue_key}.state.json"


def run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> None:
    print(f"+ {' '.join(cmd)}", file=sys.stderr)
    subprocess.run(cmd, check=True, env=env, stdout=sys.stderr, stderr=sys.stderr)


def log(message: str) -> None:
    print(message, file=sys.stderr)


def load_score(path: Path) -> int:
    try:
        data = json.loads(path.read_text())
        return int(data.get("score", 0))
    except Exception:
        return 0


def eval_set_version() -> str:
    """Return a short stable hash of the eval case file contents.

    Hashes the sorted byte contents of every *.py file in evals/ so that any
    addition, removal, or edit of eval cases produces a different version string.
    The hash is truncated to 8 hex characters for readability.
    """
    import hashlib

    evals_dir = REPO_ROOT / "evals"
    hasher = hashlib.sha256()
    for path in sorted(evals_dir.glob("*.py")):
        hasher.update(path.read_bytes())
    return hasher.hexdigest()[:8]


def git_head_sha() -> str:
    """Return the current git HEAD SHA (first 12 characters)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_ROOT,
        )
        return result.stdout.strip()[:12]
    except Exception:
        return "unknown"


def load_state(path: Path, issue_number: int | None) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(path.read_text()) if path.exists() else {"attempts": []}

    data.setdefault("attempts", [])
    if issue_number is not None:
        data["issue_number"] = issue_number
    elif "issue_number" not in data:
        data["issue_number"] = None
    return data


def save_state(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def session_name_for_attempt(issue_number: int | None, attempt_number: int) -> str:
    issue_key = str(issue_number) if issue_number is not None else "manual"
    return f"experiment-issue-{issue_key}-attempt-{attempt_number}"


def claim_attempt(
    path: Path,
    *,
    issue_number: int | None,
    workflow_run_id: str | None,
    baseline_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    state = load_state(path, issue_number)
    attempts = state["attempts"]
    current_workflow_run_id = workflow_run_id or "manual"

    if attempts:
        latest = attempts[-1]
        latest_status = latest.get("status")
        if latest_status not in TERMINAL_ATTEMPT_STATUSES:
            if latest.get("workflow_run_id") == current_workflow_run_id:
                return state, latest
            latest["status"] = "crashed"

    attempt_number = len(attempts) + 1
    attempt = {
        "attempt": attempt_number,
        "baseline_bootstrapped": False,
        "baseline_id": baseline_id,
        "session_name": session_name_for_attempt(issue_number, attempt_number),
        "status": "running",
        "workflow_run_id": current_workflow_run_id,
    }
    attempts.append(attempt)
    save_state(path, state)
    return state, attempt


def write_dry_candidate(path: Path, prompt: str, baseline_score: int) -> int:
    score = baseline_score - 1 if baseline_score > 0 else 0
    data: dict[str, Any] = {
        "score": score,
        "prompt": prompt,
        "dry_run": True,
    }
    path.write_text(json.dumps(data, indent=2) + "\n")
    log(f"Dry-run: wrote candidate to {path} (score={score})")
    return score


def build_copilot_command(
    *,
    agent: str,
    model: str,
    prompt: str,
    session_name: str,
    resume_session: bool,
) -> list[str]:
    args = [
        "copilot",
        "-p",
        prompt,
        "--agent",
        agent,
        "--model",
        model,
        "--allow-all-tools",
        "--no-ask-user",
        "--output-format",
        "json",
        "--deny-tool=shell(git push)",
        "--deny-tool=shell(git commit)",
        "--deny-tool=shell(git checkout)",
    ]
    if resume_session:
        args.extend(["--resume", session_name])
    else:
        args.extend(["--name", session_name])
    return args


def invoke_copilot(
    *,
    agent: str,
    model: str,
    prompt: str,
    session_name: str,
    resume_session: bool,
    dry_run: bool,
) -> None:
    if dry_run:
        log("DRY_RUN enabled; skipping Copilot invocation")
        return
    run_cmd(
        build_copilot_command(
            agent=agent,
            model=model,
            prompt=prompt,
            session_name=session_name,
            resume_session=resume_session,
        )
    )


def just_fix() -> None:
    run_cmd(["just", "fix", "--continue"])


def just_eval_ci(baseline_id: str) -> None:
    run_cmd(["just", "eval", baseline_id])


def promote_baseline(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
    run_cmd(["bash", "scripts/promote_baseline.sh", baseline_id])
    # Annotate the newly-promoted baseline with provenance.
    path = baseline_file(baseline_id)
    if path.exists():
        data = json.loads(path.read_text())
        data["_provenance"] = {
            "git_sha": git_head_sha(),
            "eval_set_version": eval_set_version(),
            "source_experiment_id": source_experiment_id,
        }
        path.write_text(json.dumps(data, indent=2) + "\n")


def compare_scores(baseline_id: str) -> tuple[int, int]:
    baseline_score = load_score(baseline_file(baseline_id))
    candidate_score = load_score(baseline_candidate_file(baseline_id))
    return baseline_score, candidate_score


def ensure_baseline(
    *,
    baseline_id: str,
    state_path: Path,
    state: dict[str, Any],
    attempt: dict[str, Any],
) -> int:
    baseline_path = baseline_file(baseline_id)
    if baseline_path.exists():
        # Validate provenance: re-bootstrap if the baseline is stale.
        data = json.loads(baseline_path.read_text())
        provenance = data.get("_provenance", {})
        stored_sha = provenance.get("git_sha", "")
        stored_eval_version = provenance.get("eval_set_version", "")
        current_sha = git_head_sha()
        current_eval_version = eval_set_version()

        sha_mismatch = stored_sha and stored_sha != current_sha and stored_sha != "unknown"
        eval_mismatch = stored_eval_version and stored_eval_version != current_eval_version

        if sha_mismatch or eval_mismatch:
            reasons = []
            if sha_mismatch:
                reasons.append(f"git SHA changed ({stored_sha} \u2192 {current_sha})")
            if eval_mismatch:
                reasons.append(
                    f"eval set changed ({stored_eval_version} \u2192 {current_eval_version})"
                )
            log(
                f"Baseline {baseline_id} is stale: {', '.join(reasons)}. Re-bootstrapping baseline."
            )
            attempt["baseline_invalidated"] = True
            attempt["baseline_invalidation_reasons"] = reasons
            save_state(state_path, state)
            # Fall through to bootstrap below.
        else:
            return load_score(baseline_path)

    log(f"Baseline missing or stale for {baseline_id}; bootstrapping.")
    just_eval_ci(baseline_id)
    promote_baseline(baseline_id, source_experiment_id=None)
    attempt["baseline_bootstrapped"] = True
    save_state(state_path, state)
    return load_score(baseline_path)


def build_result(
    *,
    attempt: dict[str, Any],
    baseline_id: str,
    baseline_score: int,
    candidate_path: Path,
    candidate_score: int,
    issue_number: int | None,
    local_mode: bool,
    state_path: Path,
    status: str,
) -> dict[str, Any]:
    return {
        "attempt": int(attempt["attempt"]),
        "baseline_bootstrapped": bool(attempt.get("baseline_bootstrapped", False)),
        "baseline_id": baseline_id,
        "baseline_invalidated": bool(attempt.get("baseline_invalidated", False)),
        "baseline_score": baseline_score,
        "candidate_path": str(candidate_path),
        "candidate_score": candidate_score,
        "issue_number": issue_number,
        "local_mode": local_mode,
        "score_delta": candidate_score - baseline_score,
        "state_path": str(state_path),
        "status": status,
    }


def finish_attempt(
    *,
    attempt: dict[str, Any],
    baseline_id: str,
    baseline_score: int,
    candidate_path: Path,
    candidate_score: int,
    issue_number: int | None,
    local_mode: bool,
    state: dict[str, Any],
    state_path: Path,
    success: bool,
) -> dict[str, Any]:
    status = "candidate_ready" if success else "failed"
    attempt["baseline_score"] = baseline_score
    attempt["candidate_score"] = candidate_score
    attempt["score_delta"] = candidate_score - baseline_score
    attempt["status"] = status
    save_state(state_path, state)
    return build_result(
        attempt=attempt,
        baseline_id=baseline_id,
        baseline_score=baseline_score,
        candidate_path=candidate_path,
        candidate_score=candidate_score,
        issue_number=issue_number,
        local_mode=local_mode,
        state_path=state_path,
        status=status,
    )


def run_experiment(
    prompt: str,
    agent: str,
    model: str,
    baseline_id: str,
    followup_limit: int,
    dry_run: bool,
    local_mode: bool = False,
    issue_number: int | None = None,
    workflow_run_id: str | None = None,
    state_path: str | Path | None = None,
) -> dict[str, Any]:
    baseline_path = baseline_file(baseline_id)
    candidate_path = baseline_candidate_file(baseline_id)
    resolved_state_path = state_file(issue_number, state_path)
    state, attempt = claim_attempt(
        resolved_state_path,
        issue_number=issue_number,
        workflow_run_id=workflow_run_id,
        baseline_id=baseline_id,
    )
    baseline_score = ensure_baseline(
        baseline_id=baseline_id,
        state_path=resolved_state_path,
        state=state,
        attempt=attempt,
    )

    if dry_run:
        candidate_score = write_dry_candidate(candidate_path, prompt, baseline_score)
        return finish_attempt(
            attempt=attempt,
            baseline_id=baseline_id,
            baseline_score=baseline_score,
            candidate_path=candidate_path,
            candidate_score=candidate_score,
            issue_number=issue_number,
            local_mode=local_mode,
            state=state,
            state_path=resolved_state_path,
            success=candidate_score > baseline_score,
        )

    invoke_copilot(
        agent=agent,
        model=model,
        prompt=prompt,
        session_name=str(attempt["session_name"]),
        resume_session=False,
        dry_run=False,
    )
    just_fix()
    just_eval_ci(baseline_id)

    baseline_score, candidate_score = compare_scores(baseline_id)
    followup_attempt = 0
    while candidate_score <= baseline_score and followup_attempt < followup_limit:
        followup_attempt += 1
        log(
            "Follow-up attempt "
            f"{followup_attempt}/{followup_limit}: candidate did not improve the baseline."
        )
        baseline_contents = baseline_path.read_text() if baseline_path.exists() else ""
        candidate_contents = candidate_path.read_text() if candidate_path.exists() else ""
        followup_prompt = (
            "The prior experiment candidate failed to improve the baseline score. "
            "Please revise the change using the same task, focusing on improving "
            "the generated baseline candidate.\n\n"
            "Baseline:\n"
            f"{baseline_contents}\n\n"
            "Candidate:\n"
            f"{candidate_contents}"
        )

        invoke_copilot(
            agent=agent,
            model=model,
            prompt=followup_prompt,
            session_name=str(attempt["session_name"]),
            resume_session=True,
            dry_run=False,
        )
        just_fix()
        just_eval_ci(baseline_id)
        baseline_score, candidate_score = compare_scores(baseline_id)

    log(f"Baseline score: {baseline_score}")
    log(f"Candidate score: {candidate_score}")
    log("Candidate improved." if candidate_score > baseline_score else "Candidate did not improve.")
    return finish_attempt(
        attempt=attempt,
        baseline_id=baseline_id,
        baseline_score=baseline_score,
        candidate_path=candidate_path,
        candidate_score=candidate_score,
        issue_number=issue_number,
        local_mode=local_mode,
        state=state,
        state_path=resolved_state_path,
        success=candidate_score > baseline_score,
    )


def add_experiment(
    prompt: str,
    agent: str,
    model: str,
    baseline_id: str,
    tolerance: float,
    dry_run: bool,
    local_mode: bool = False,
    issue_number: int | None = None,
    workflow_run_id: str | None = None,
    state_path: str | Path | None = None,
) -> dict[str, Any]:
    candidate_path = baseline_candidate_file(baseline_id)
    resolved_state_path = state_file(issue_number, state_path)
    state, attempt = claim_attempt(
        resolved_state_path,
        issue_number=issue_number,
        workflow_run_id=workflow_run_id,
        baseline_id=baseline_id,
    )
    baseline_score = ensure_baseline(
        baseline_id=baseline_id,
        state_path=resolved_state_path,
        state=state,
        attempt=attempt,
    )

    if dry_run:
        candidate_score = write_dry_candidate(candidate_path, prompt, baseline_score)
    else:
        invoke_copilot(
            agent=agent,
            model=model,
            prompt=prompt,
            session_name=str(attempt["session_name"]),
            resume_session=False,
            dry_run=False,
        )
        just_fix()
        just_eval_ci(baseline_id)
        candidate_score = load_score(candidate_path)

    threshold = baseline_score * (1.0 - tolerance)
    if baseline_score == 0:
        log("No existing baseline; add workflow succeeds by default.")
        return finish_attempt(
            attempt=attempt,
            baseline_id=baseline_id,
            baseline_score=baseline_score,
            candidate_path=candidate_path,
            candidate_score=candidate_score,
            issue_number=issue_number,
            local_mode=local_mode,
            state=state,
            state_path=resolved_state_path,
            success=True,
        )

    log(f"Baseline score: {baseline_score}")
    log(f"Candidate score: {candidate_score}")
    log(f"Tolerance threshold: {threshold:.2f}")
    success = candidate_score >= threshold
    log("Add workflow succeeded." if success else "Add workflow failed.")
    return finish_attempt(
        attempt=attempt,
        baseline_id=baseline_id,
        baseline_score=baseline_score,
        candidate_path=candidate_path,
        candidate_score=candidate_score,
        issue_number=issue_number,
        local_mode=local_mode,
        state=state,
        state_path=resolved_state_path,
        success=success,
    )


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Experiment runner for Copilot-driven changes.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--prompt", required=True)
    common.add_argument("--agent", default="implement")
    common.add_argument("--model", default="gpt-5")
    common.add_argument("--baseline-id", default="auto_research")
    common.add_argument("--issue-number", type=int)
    common.add_argument("--state-path")
    common.add_argument("--workflow-run-id")
    common.add_argument("--dry", action="store_true")
    common.add_argument("--local", action="store_true", default=False)

    run_parser = subparsers.add_parser(
        "run",
        parents=[common],
        help="Run an experiment and require improvement.",
    )
    run_parser.add_argument("--followup-limit", type=int, default=0)

    add_parser = subparsers.add_parser(
        "add",
        parents=[common],
        help="Run an experiment and allow small score decreases.",
    )
    add_parser.add_argument("--tolerance", type=float, default=0.2)

    init_state_parser = subparsers.add_parser(
        "init-state",
        help="Initialise or refresh the experiment state file for a given issue.",
    )
    init_state_parser.add_argument("--state-path", required=True)
    init_state_parser.add_argument("--issue-number", type=int, required=True)

    update_repl_parser = subparsers.add_parser(
        "update-replenishment-state",
        help="Record the replenishment issue number in the experiment state file.",
    )
    update_repl_parser.add_argument("--state-path", required=True)
    update_repl_parser.add_argument("--issue-url", required=True)

    promote_parser = subparsers.add_parser(
        "promote-baseline",
        help="Promote candidate to baseline and annotate with provenance.",
    )
    promote_parser.add_argument("--baseline-id", required=True)
    promote_parser.add_argument("--source-experiment-id", default=None)

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    if args.command == "run":
        result = run_experiment(
            prompt=args.prompt,
            agent=args.agent,
            model=args.model,
            baseline_id=args.baseline_id,
            followup_limit=args.followup_limit,
            dry_run=args.dry,
            local_mode=args.local,
            issue_number=args.issue_number,
            workflow_run_id=args.workflow_run_id,
            state_path=args.state_path,
        )
    elif args.command == "add":
        result = add_experiment(
            prompt=args.prompt,
            agent=args.agent,
            model=args.model,
            baseline_id=args.baseline_id,
            tolerance=args.tolerance,
            dry_run=args.dry,
            local_mode=args.local,
            issue_number=args.issue_number,
            workflow_run_id=args.workflow_run_id,
            state_path=args.state_path,
        )
    elif args.command == "init-state":
        path = Path(args.state_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        state = load_state(path, args.issue_number)
        issue = state.get("issue")
        if not isinstance(issue, dict):
            issue = {}
        issue["number"] = args.issue_number
        state["issue"] = issue
        state["issue_number"] = args.issue_number
        state.setdefault("attempts", [])
        state.setdefault("promotion_applied", False)
        state.setdefault("commit_pushed", False)
        state.setdefault("replenishment_issue_number", None)
        state.setdefault("status_comment_id", None)
        save_state(path, state)
        return 0
    elif args.command == "update-replenishment-state":
        import re

        match = re.search(r"/issues/(\d+)$", args.issue_url.strip())
        if not match:
            print("Could not extract issue number from URL", file=sys.stderr)
            return 1
        replenishment_number = int(match.group(1))
        path = Path(args.state_path)
        state = json.loads(path.read_text()) if path.exists() else {}
        state["replenishment_issue_number"] = replenishment_number
        save_state(path, state)
        print(replenishment_number)
        return 0
    elif args.command == "promote-baseline":
        promote_baseline(
            args.baseline_id,
            source_experiment_id=args.source_experiment_id,
        )
        return 0
    else:
        raise SystemExit("Unknown command")

    print(json.dumps(result))
    return 0 if result["status"] == "candidate_ready" else 1


if __name__ == "__main__":
    raise SystemExit(main())
