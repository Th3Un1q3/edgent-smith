#!/usr/bin/env python3
"""Run eval suites against a candidate experiment.

Usage:
    python experiments/scripts/run_candidate.py \\
        --name <experiment-name> [--suite smoke|benchmark|holdout|all]

Reads the manifest from experiments/manifests/<name>.json,
runs the specified eval suite, and persists results.
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
from _common import MANIFESTS_DIR, RESULTS_DIR, fail, now_iso


async def run_suite(suite_name: str) -> dict:  # type: ignore[type-arg]
    from eval.harness import EvalHarness
    from eval.suites.benchmark import BENCHMARK_CASES
    from eval.suites.holdout import HOLDOUT_CASES
    from eval.suites.smoke import SMOKE_CASES

    suite_map = {
        "smoke": SMOKE_CASES,
        "benchmark": BENCHMARK_CASES,
        "holdout": HOLDOUT_CASES,
    }
    cases = suite_map[suite_name]

    # Import the real agent runner
    from edgent_smith.agents import build_edge_agent
    from edgent_smith.agents.edge_agent import AgentDeps

    agent = build_edge_agent()

    async def agent_runner(prompt: str) -> object:
        import ulid as ulid_module
        deps = AgentDeps(run_id=str(ulid_module.ULID()), max_tokens=512, max_tool_calls=5)
        return await agent.run(prompt, deps)

    harness = EvalHarness(agent_runner, results_dir=str(RESULTS_DIR))
    sr = await harness.run_suite(cases, suite_name)
    return sr.to_dict()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run candidate eval")
    parser.add_argument("--name", required=True, help="Experiment name matching manifest")
    parser.add_argument(
        "--suite",
        choices=["smoke", "benchmark", "holdout", "all"],
        default="smoke",
        help="Which suite to run",
    )
    args = parser.parse_args()

    manifest_file = MANIFESTS_DIR / f"{args.name}.json"
    if not manifest_file.exists():
        fail(f"No manifest found for experiment '{args.name}'. Run init_experiment.py first.")

    manifest = json.loads(manifest_file.read_text())
    print(f"Running candidate: {args.name} | suite={args.suite}")

    suites = ["smoke", "benchmark", "holdout"] if args.suite == "all" else [args.suite]
    results = {}
    for suite in suites:
        print(f"  Running suite: {suite}")
        result = asyncio.run(run_suite(suite))
        results[suite] = result
        manifest[f"{suite}_result"] = result

    manifest["status"] = "evaluated"
    manifest["evaluated_at"] = now_iso()
    manifest_file.write_text(json.dumps(manifest, indent=2))

    print(f"\nResults persisted to manifest: {manifest_file}")
    for suite_name, r in results.items():
        print(
            f"  {suite_name}: pass_rate={r['pass_rate']:.2%} "
            f"composite={r['composite_score']:.4f} "
            f"cases={r['cases_passed']}/{r['cases_total']}"
        )


if __name__ == "__main__":
    main()
