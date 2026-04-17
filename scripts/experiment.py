#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent


def sanitize_baseline_id(baseline_id: str) -> str:
    return baseline_id.replace("/", "_").replace(":", "_")


def baseline_file(baseline_id: str) -> Path:
    safe_id = sanitize_baseline_id(baseline_id)
    return REPO_ROOT / f"{safe_id}.baseline.json"


def baseline_candidate_file(baseline_id: str) -> Path:
    safe_id = sanitize_baseline_id(baseline_id)
    return REPO_ROOT / f"{safe_id}.baseline-candidate.json"


def run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> None:
    print(f"+ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, env=env)


def load_score(path: Path) -> int:
    try:
        data = json.loads(path.read_text())
        return int(data.get("score", 0))
    except Exception:
        return 0


def write_dry_candidate(path: Path, prompt: str, baseline_score: int) -> int:
    score = baseline_score - 1 if baseline_score > 0 else 0
    data: dict[str, Any] = {
        "score": score,
        "prompt": prompt,
        "dry_run": True,
    }
    path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Dry-run: wrote candidate to {path} (score={score})")
    return score


def invoke_copilot(agent: str, model: str, prompt: str, continue_mode: bool, dry_run: bool) -> None:
    if dry_run:
        print("DRY_RUN enabled; skipping Copilot invocation")
        return
    args = [
        "copilot",
        "--agent",
        agent,
        "--autopilot",
        "--model",
        model,
        "--prompt",
        prompt,
        "--allow-all-tools",
        "--deny-tool=shell(git push)",
        "--deny-tool=shell(git commit)",
        "--deny-tool=shell(git checkout)",
    ]
    if continue_mode:
        args.insert(3, "--continue")
    run_cmd(args)


def just_fix() -> None:
    run_cmd(["just", "fix", "--continue"])


def just_eval_ci(baseline_id: str) -> None:
    run_cmd(["just", "eval", baseline_id])


def compare_scores(baseline_id: str) -> tuple[int, int]:
    baseline_score = load_score(baseline_file(baseline_id))
    candidate_score = load_score(baseline_candidate_file(baseline_id))
    return baseline_score, candidate_score


def run_experiment(
    prompt: str,
    agent: str,
    model: str,
    baseline_id: str,
    followup_limit: int,
    dry_run: bool,
) -> bool:
    baseline_path = baseline_file(baseline_id)
    candidate_path = baseline_candidate_file(baseline_id)

    baseline_score = load_score(baseline_path)
    if dry_run:
        write_dry_candidate(candidate_path, prompt, baseline_score)
        return load_score(candidate_path) > baseline_score

    invoke_copilot(agent, model, prompt, continue_mode=False, dry_run=False)
    just_fix()
    just_eval_ci(baseline_id)

    baseline_score, candidate_score = compare_scores(baseline_id)
    attempt = 0
    while candidate_score <= baseline_score and attempt < followup_limit:
        attempt += 1
        print(
            f"Follow-up attempt {attempt}/{followup_limit}: candidate did not improve the baseline."
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

        invoke_copilot(agent, model, followup_prompt, continue_mode=True, dry_run=False)
        just_fix()
        just_eval_ci(baseline_id)

        baseline_score, candidate_score = compare_scores(baseline_id)

    print(f"Baseline score: {baseline_score}")
    print(f"Candidate score: {candidate_score}")
    if candidate_score > baseline_score:
        print("Candidate improved.")
    else:
        print("Candidate did not improve.")
    return candidate_score > baseline_score


def add_experiment(
    prompt: str,
    agent: str,
    model: str,
    baseline_id: str,
    tolerance: float,
    dry_run: bool,
) -> bool:
    baseline_score = load_score(baseline_file(baseline_id))
    candidate_path = baseline_candidate_file(baseline_id)

    if dry_run:
        write_dry_candidate(candidate_path, prompt, baseline_score)
        candidate_score = load_score(candidate_path)
    else:
        invoke_copilot(agent, model, prompt, continue_mode=False, dry_run=False)
        just_fix()
        just_eval_ci(baseline_id)
        candidate_score = load_score(candidate_path)

    threshold = baseline_score * (1.0 - tolerance)
    if baseline_score == 0:
        print("No existing baseline; add workflow succeeds by default.")
        return True

    print(f"Baseline score: {baseline_score}")
    print(f"Candidate score: {candidate_score}")
    print(f"Tolerance threshold: {threshold:.2f}")
    success = candidate_score >= threshold
    print("Add workflow succeeded." if success else "Add workflow failed.")
    return success


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Experiment runner for Copilot-driven changes.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--prompt", required=True)
    common.add_argument("--agent", default="implement")
    common.add_argument("--model", default="gpt-5-mini")
    common.add_argument("--baseline-id", default="auto_research")
    common.add_argument("--dry", action="store_true")

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

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    if args.command == "run":
        success = run_experiment(
            prompt=args.prompt,
            agent=args.agent,
            model=args.model,
            baseline_id=args.baseline_id,
            followup_limit=args.followup_limit,
            dry_run=args.dry,
        )
    elif args.command == "add":
        success = add_experiment(
            prompt=args.prompt,
            agent=args.agent,
            model=args.model,
            baseline_id=args.baseline_id,
            tolerance=args.tolerance,
            dry_run=args.dry,
        )
    else:
        raise SystemExit("Unknown command")

    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
