#!/usr/bin/env python3
"""Run selected skill eval cases one at a time and tally the pass/fail split."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNNER = REPO_ROOT / "scripts" / "run_skill_evals.py"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill", required=True, help="skill name or directory")
    parser.add_argument("--model", required=True, help="model id handed to the runner")
    parser.add_argument("--case-ids", required=True, help="comma separated ids, e.g. 1,2,3")
    parser.add_argument("--max-turns", type=int, default=4, help="continuation turns per case")
    parser.add_argument(
        "--timeout", type=int, default=600, help="per-invocation timeout in seconds"
    )
    parser.add_argument("--agent", default="rug-swe", help="agent name handed to the runner")
    parser.add_argument("--opencode-bin", default="opencode", help="opencode binary path")
    parser.add_argument(
        "--results-dir",
        default=None,
        help="default: .agents/skills/<skill>/evals/results/conductor-<timestamp>",
    )
    return parser.parse_args(argv)


def parse_case_ids(spec: str) -> list[int]:
    ids = [int(part) for part in spec.replace(" ", "").split(",") if part]
    if not ids:
        raise ValueError(f"no case ids in {spec!r}")
    return ids


def default_results_dir(skill: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return Path(".agents/skills") / Path(skill).name / "evals" / "results" / f"conductor-{stamp}"


def run_case(case_id: int, args: argparse.Namespace, results_dir: Path) -> Path:
    out_path = results_dir / f"case-{case_id}.json"
    command = [
        sys.executable,
        str(RUNNER),
        "--skill",
        args.skill,
        "--cases",
        str(case_id),
        "--model",
        args.model,
        "--agent",
        args.agent,
        "--max-turns",
        str(args.max_turns),
        "--timeout",
        str(args.timeout),
        "--opencode-bin",
        args.opencode_bin,
        "--output",
        str(out_path),
    ]
    completed = subprocess.run(command, cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    if not out_path.is_file():
        print(f"case {case_id}: runner exit {completed.returncode}", file=sys.stderr)
        tail = (completed.stderr or completed.stdout).strip().splitlines()
        if tail:
            print(tail[-1][:300], file=sys.stderr)
    return out_path


def tally(path: Path) -> tuple[int, int]:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    summary = data.get("summary") or {}
    return int(summary.get("passed", 0)), int(summary.get("failed", 0))


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        case_ids = parse_case_ids(args.case_ids)
    except ValueError as exc:
        print(f"run_cases: {exc}", file=sys.stderr)
        return 1

    results_dir = (
        Path(args.results_dir) if args.results_dir else default_results_dir(args.skill)
    ).resolve()
    results_dir.mkdir(parents=True, exist_ok=True)

    passed = 0
    failed = 0
    missing: list[int] = []
    for case_id in case_ids:
        out_path = run_case(case_id, args, results_dir)
        try:
            case_passed, case_failed = tally(out_path)
        except (OSError, ValueError):
            missing.append(case_id)
            continue
        passed += case_passed
        failed += case_failed

    payload = {
        "ok": not missing,
        "results_dir": str(results_dir),
        "passed": passed,
        "failed": failed,
        "case_ids": case_ids,
    }
    print(json.dumps(payload))
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
