#!/usr/bin/env python3
"""Register the current system state as the baseline/champion.

Usage:
    python experiments/scripts/register_baseline.py [--suite smoke|benchmark|holdout|all]

Runs the specified eval suite(s) against the current codebase and saves the
result as the reference baseline in experiments/baselines/current.json.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import BASELINES_DIR, now_iso


async def run_baseline(suite: str) -> dict:  # type: ignore[type-arg]
    from eval.harness import EvalHarness
    from eval.suites.benchmark import BENCHMARK_CASES
    from eval.suites.holdout import HOLDOUT_CASES
    from eval.suites.smoke import SMOKE_CASES

    # Minimal mock runner – replace with real agent for live baseline
    async def mock_runner(prompt: str) -> object:
        class R:
            answer = "mock baseline answer"
            confidence = "medium"
            tool_calls_used = 0
            tokens_used = None
        return R()

    harness = EvalHarness(mock_runner, results_dir=str(BASELINES_DIR))

    results = {}
    suite_map = {
        "smoke": ("smoke", SMOKE_CASES),
        "benchmark": ("benchmark", BENCHMARK_CASES),
        "holdout": ("holdout", HOLDOUT_CASES),
    }

    for suite_name, cases in ([suite_map[suite]] if suite != "all" else suite_map.values()):
        sr = await harness.run_suite(cases, suite_name)
        results[suite_name] = sr.to_dict()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Register baseline eval results")
    parser.add_argument(
        "--suite",
        choices=["smoke", "benchmark", "holdout", "all"],
        default="smoke",
        help="Which suite(s) to run for baseline",
    )
    args = parser.parse_args()

    print(f"Running baseline eval: suite={args.suite}")
    results = asyncio.run(run_baseline(args.suite))

    baseline = {
        "registered_at": now_iso(),
        "suite": args.suite,
        "results": results,
    }

    BASELINES_DIR.mkdir(parents=True, exist_ok=True)
    out = BASELINES_DIR / "current.json"
    out.write_text(json.dumps(baseline, indent=2))
    print(f"Baseline registered: {out}")


if __name__ == "__main__":
    main()
