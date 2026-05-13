#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from cli.services.copilot_session import allow_all_deny_git_toolset

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_ROOT = REPO_ROOT / "hooks"
GENERATED_HOOK_NAME = "experiment_generated.sh"
COMPLETE_HOOK_NAME = "experiment_complete.sh"
DEFAULT_LOCAL_DRAFT_PATH = REPO_ROOT / "experiments" / "local_idea_draft.yaml"
DEFAULT_LOCAL_TITLE_PATH = REPO_ROOT / "experiments" / "local_idea_title.txt"
DEFAULT_LOCAL_BODY_PATH = REPO_ROOT / "experiments" / "local_idea_body.md"
DEFAULT_LOCAL_CANDIDATE_PATH = REPO_ROOT / "experiments" / "candidate.md"
DEFAULT_LOCAL_STATE_PATH = REPO_ROOT / "experiments" / "manual.state.json"
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


def run_cmd(
    cmd: list[str],
    env: dict[str, str] | None = None,
    cwd: str | Path | None = None,
) -> None:
    print(f"+ {' '.join(cmd)}", file=sys.stderr)
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    subprocess.run(
        cmd,
        check=True,
        cwd=cwd or REPO_ROOT,
        env=merged_env,
        stdout=sys.stderr,
        stderr=sys.stderr,
    )


def log(message: str) -> None:
    print(message, file=sys.stderr)


def run_prepare_command(command: str) -> None:
    run_cmd(["bash", "-lc", command])


def resolve_hook_set_dir(hooks_set: str) -> Path:
    if not hooks_set or hooks_set in {".", ".."}:
        raise ValueError("Hook set must be a basename-style identifier.")
    if "/" in hooks_set or "\\" in hooks_set or Path(hooks_set).name != hooks_set:
        raise ValueError("Hook set must not contain path separators.")

    hooks_root = HOOKS_ROOT.resolve()
    resolved = (hooks_root / hooks_set).resolve()
    if not resolved.is_relative_to(hooks_root):
        raise ValueError("Hook set must resolve under the repo hooks directory.")
    if not resolved.is_dir():
        raise FileNotFoundError(f"Hook set not found: {hooks_set}")
    return resolved


def build_hook_env(
    *,
    hooks_set: str,
    baseline_id: str,
    iteration: int,
    draft_path: Path,
    title_path: Path,
    body_path: Path,
    candidate_path: Path,
    status: str | None = None,
    improved: bool | None = None,
    baseline_score: int | None = None,
    candidate_score: int | None = None,
) -> dict[str, str]:
    """Export the minimal documented env contract for local-loop shell hooks."""

    env = {
        "EXPERIMENT_HOOK_SET": hooks_set,
        "EXPERIMENT_REPO_ROOT": str(REPO_ROOT.resolve()),
        "EXPERIMENT_BASELINE_ID": baseline_id,
        "EXPERIMENT_ITERATION": str(iteration),
        "EXPERIMENT_DRAFT_PATH": str(draft_path.resolve()),
        "EXPERIMENT_TITLE_PATH": str(title_path.resolve()),
        "EXPERIMENT_BODY_PATH": str(body_path.resolve()),
        "EXPERIMENT_CANDIDATE_PATH": str(candidate_path.resolve()),
    }
    if status is not None:
        env["EXPERIMENT_STATUS"] = status
    if improved is not None:
        env["EXPERIMENT_IMPROVED"] = "true" if improved else "false"
    if baseline_score is not None:
        env["EXPERIMENT_BASELINE_SCORE"] = str(baseline_score)
    if candidate_score is not None:
        env["EXPERIMENT_CANDIDATE_SCORE"] = str(candidate_score)
    return env


def run_hook_script(hook_path: Path, env: dict[str, str]) -> None:
    run_cmd(["bash", str(hook_path)], env=env)


def refresh_local_spec_inputs(draft_path: Path, title_path: Path, body_path: Path) -> None:
    if draft_path.exists():
        run_cmd(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "parse_draft.py"),
                str(draft_path),
                str(title_path),
                str(body_path),
            ]
        )

    if not title_path.exists() or not body_path.exists():
        raise FileNotFoundError("Local loop requires title/body inputs or a parseable draft file.")


def stage_checkpoint_files(paths: list[Path]) -> None:
    existing_paths = [path for path in paths if path.exists()]
    if not existing_paths:
        return
    run_cmd(["git", "add", "--", *[str(path) for path in existing_paths]])


def checkpoint_local_spec(
    *,
    title_path: Path,
    body_path: Path,
    candidate_path: Path,
    draft_path: Path,
) -> None:
    title = title_path.read_text().strip()
    body = body_path.read_text().strip()
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    candidate_path.parent.mkdir(parents=True, exist_ok=True)
    candidate_path.write_text(f'---\ntitle: "{title}"\ndate: {timestamp}\n---\n\n{body}\n')
    stage_checkpoint_files([draft_path, title_path, body_path, candidate_path])


def build_local_loop_prompt(candidate_path: Path) -> str:
    try:
        display_path = candidate_path.relative_to(REPO_ROOT)
    except ValueError:
        display_path = candidate_path
    return (
        f"Please read {display_path} for the full experiment specification. "
        "Perform the experiment end to end."
    )


def run_local_loop_iteration(
    *,
    iteration: int,
    agent: str,
    model: str,
    eval_model: str = "edge_agent_local_openrouter",
    baseline_id: str,
    hooks_set: str | None,
    prepare_cmd: str | None,
    draft_path: Path,
    title_path: Path,
    body_path: Path,
    candidate_path: Path,
    state_path: Path,
    dry_run: bool,
) -> dict[str, Any]:
    if prepare_cmd:
        run_prepare_command(prepare_cmd)

    hooks_dir = resolve_hook_set_dir(hooks_set) if hooks_set else None
    if hooks_dir is not None:
        if hooks_set is None:
            raise ValueError("Hook set name is required when hooks are enabled.")
        generated_hook = hooks_dir / GENERATED_HOOK_NAME
        if generated_hook.exists():
            run_hook_script(
                generated_hook,
                build_hook_env(
                    hooks_set=hooks_set,
                    baseline_id=baseline_id,
                    iteration=iteration,
                    draft_path=draft_path,
                    title_path=title_path,
                    body_path=body_path,
                    candidate_path=candidate_path,
                ),
            )

    refresh_local_spec_inputs(draft_path, title_path, body_path)
    checkpoint_local_spec(
        title_path=title_path,
        body_path=body_path,
        candidate_path=candidate_path,
        draft_path=draft_path,
    )

    result = run_experiment(
        prompt=build_local_loop_prompt(candidate_path),
        agent=agent,
        model=model,
        eval_model=eval_model,
        baseline_id=baseline_id,
        followup_limit=0,
        dry_run=dry_run,
        local_mode=True,
        state_path=state_path,
    )

    improved = result["status"] == "candidate_ready"
    final_status = str(result["status"])
    if improved:
        try:
            promote_baseline(baseline_id)
            final_status = "succeeded"
        except subprocess.CalledProcessError as exc:
            log(f"Baseline promotion failed for {baseline_id}: {exc}")
            final_status = "promotion_failed"

    final_result = dict(result)
    final_result["status"] = final_status
    final_result["improved"] = improved

    if hooks_dir is not None:
        if hooks_set is None:
            raise ValueError("Hook set name is required when hooks are enabled.")
        completion_hook = hooks_dir / COMPLETE_HOOK_NAME
        if completion_hook.exists():
            try:
                run_hook_script(
                    completion_hook,
                    build_hook_env(
                        hooks_set=hooks_set,
                        baseline_id=baseline_id,
                        iteration=iteration,
                        draft_path=draft_path,
                        title_path=title_path,
                        body_path=body_path,
                        candidate_path=candidate_path,
                        status=final_status,
                        improved=improved,
                        baseline_score=int(result["baseline_score"]),
                        candidate_score=int(result["candidate_score"]),
                    ),
                )
            except subprocess.CalledProcessError as exc:
                log(f"Completion hook {completion_hook.name} failed: {exc}")

    return final_result


def run_local_loop(
    *,
    agent: str,
    model: str,
    eval_model: str = "edge_agent_default",
    baseline_id: str,
    hooks_set: str | None,
    prepare_cmd: str | None,
    max_experiments: int | None,
    max_minutes: float | None,
    dry_run: bool,
    draft_path: Path = DEFAULT_LOCAL_DRAFT_PATH,
    title_path: Path = DEFAULT_LOCAL_TITLE_PATH,
    body_path: Path = DEFAULT_LOCAL_BODY_PATH,
    candidate_path: Path = DEFAULT_LOCAL_CANDIDATE_PATH,
    state_path: Path = DEFAULT_LOCAL_STATE_PATH,
) -> dict[str, Any]:
    if max_experiments is not None and max_experiments <= 0:
        return {
            "status": "completed",
            "baseline_id": baseline_id,
            "model": model,
            "iterations_completed": 0,
            "stop_reason": "max_experiments",
            "last_result": None,
        }

    started_at = time.monotonic()
    iteration = 0
    last_result: dict[str, Any] | None = None

    while True:
        iteration += 1
        last_result = run_local_loop_iteration(
            iteration=iteration,
            agent=agent,
            model=model,
            eval_model=eval_model,
            baseline_id=baseline_id,
            hooks_set=hooks_set,
            prepare_cmd=prepare_cmd,
            draft_path=draft_path,
            title_path=title_path,
            body_path=body_path,
            candidate_path=candidate_path,
            state_path=state_path,
            dry_run=dry_run,
        )

        if max_experiments is not None and iteration >= max_experiments:
            stop_reason = "max_experiments"
            break
        if max_minutes is not None and (time.monotonic() - started_at) >= max_minutes * 60:
            stop_reason = "max_minutes"
            break

    return {
        "status": "completed",
        "baseline_id": baseline_id,
        "model": model,
        "iterations_completed": iteration,
        "stop_reason": stop_reason,
        "last_result": last_result,
    }


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
        "--no-ask-user",
        "--output-format",
        "json",
    ]
    args.extend(allow_all_deny_git_toolset().to_flags(inline_assignment=True))
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


def just_eval_ci(baseline_id: str, eval_model: str | None = None) -> None:
    cmd = ["just", "eval"]
    cmd.append(baseline_id)
    if eval_model is not None:
        cmd.extend(["--model", eval_model])
    run_cmd(cmd)


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
    eval_model: str | None = None,
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
    just_eval_ci(baseline_id, eval_model=eval_model)
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
    *,
    eval_model: str | None = None,
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
        eval_model=eval_model,
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
    just_eval_ci(baseline_id, eval_model=eval_model)

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
        just_eval_ci(baseline_id, eval_model=eval_model)
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
    *,
    eval_model: str | None = None,
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
        just_eval_ci(baseline_id, eval_model=eval_model)
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
    common.add_argument(
        "--engineer-model",
        "--model",
        "--model-alias",
        dest="model",
        default="gpt-5-mini",
    )
    common.add_argument("--eval-model", default="edge_agent_default")
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

    local_loop_parser = subparsers.add_parser(
        "local-loop",
        help="Run the local foreground experiment loop.",
    )
    local_loop_parser.add_argument("--agent", default="implement")
    local_loop_parser.add_argument(
        "--model-alias",
        "--model",
        "--engineer-model",
        dest="model",
        default="gpt-5-mini",
    )
    local_loop_parser.add_argument(
        "--eval-model",
        dest="eval_model",
        default="edge_agent_default",
    )
    local_loop_parser.add_argument("--baseline-id", default="local")
    local_loop_parser.add_argument("--hooks")
    local_loop_parser.add_argument("--prepare-cmd")
    local_loop_parser.add_argument("--draft-path", default=str(DEFAULT_LOCAL_DRAFT_PATH))
    local_loop_parser.add_argument("--title-path", default=str(DEFAULT_LOCAL_TITLE_PATH))
    local_loop_parser.add_argument("--body-path", default=str(DEFAULT_LOCAL_BODY_PATH))
    local_loop_parser.add_argument("--candidate-path", default=str(DEFAULT_LOCAL_CANDIDATE_PATH))
    local_loop_parser.add_argument("--state-path", default=str(DEFAULT_LOCAL_STATE_PATH))
    local_loop_parser.add_argument(
        "--max-experiments",
        "--max-iterations",
        dest="max_experiments",
        type=int,
    )
    local_loop_parser.add_argument("--max-minutes", type=float)
    local_loop_parser.add_argument("--dry", action="store_true")

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    if args.command == "run":
        result = run_experiment(
            prompt=args.prompt,
            agent=args.agent,
            model=args.model,
            eval_model=args.eval_model,
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
            eval_model=args.eval_model,
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
    elif args.command == "local-loop":
        result = run_local_loop(
            agent=args.agent,
            model=args.model,
            eval_model=args.eval_model,
            baseline_id=args.baseline_id,
            hooks_set=args.hooks,
            prepare_cmd=args.prepare_cmd,
            max_experiments=args.max_experiments,
            max_minutes=args.max_minutes,
            dry_run=args.dry,
            draft_path=Path(args.draft_path),
            title_path=Path(args.title_path),
            body_path=Path(args.body_path),
            candidate_path=Path(args.candidate_path),
            state_path=Path(args.state_path),
        )
        print(json.dumps(result))
        return 0
    else:
        raise SystemExit("Unknown command")

    print(json.dumps(result))
    return 0 if result["status"] == "candidate_ready" else 1


if __name__ == "__main__":
    raise SystemExit(main())
