#!/usr/bin/env python3
"""Compare candidate experiment results against the current baseline/champion.

Usage:
    python experiments/scripts/compare.py --name <experiment-name>

Reads:
    experiments/manifests/<name>.json   (candidate results)
    experiments/baselines/current.json  (baseline)

Outputs:
    Comparison summary to stdout and appends a ledger entry.
    Exit code 0 = candidate passes (better or equivalent on primary metrics)
    Exit code 1 = candidate fails
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import BASELINES_DIR, MANIFESTS_DIR, append_ledger, fail, now_iso

# Thresholds – part of the immutable judge
SMOKE_MIN_PASS_RATE = 1.0      # Must pass all smoke cases
BENCHMARK_MIN_PASS_RATE = 0.80  # 80% pass rate on benchmark
HOLDOUT_MIN_PASS_RATE = 0.75    # 75% pass rate on holdout
MAX_LATENCY_REGRESSION = 0.20   # Allow up to 20% latency increase
MIN_SCORE_IMPROVEMENT = 0.0     # Candidate must match or beat baseline composite


def compare_suite(
    baseline: dict,  # type: ignore[type-arg]
    candidate: dict,  # type: ignore[type-arg]
    suite: str,
    min_pass_rate: float,
) -> tuple[bool, str]:
    """Return (passed, reason)."""
    if suite not in candidate:
        return False, f"No {suite} results in candidate manifest"
    if suite not in baseline.get("results", {}):
        return True, f"No {suite} baseline – skipping comparison"

    cand = candidate[suite]
    base = baseline["results"].get(suite, {})

    cand_pass = cand.get("pass_rate", 0.0)
    base_pass = base.get("pass_rate", 0.0)
    cand_score = cand.get("composite_score", 0.0)
    base_score = base.get("composite_score", 0.0)
    cand_latency = cand.get("avg_latency_seconds", 0.0)
    base_latency = base.get("avg_latency_seconds", 0.0)

    reasons = []

    if cand_pass < min_pass_rate:
        reasons.append(f"pass_rate {cand_pass:.2%} < required {min_pass_rate:.2%}")

    if cand_score < base_score + MIN_SCORE_IMPROVEMENT - 0.001:
        reasons.append(
            f"composite_score {cand_score:.4f} < baseline {base_score:.4f}"
        )

    if base_latency > 0 and cand_latency > base_latency * (1 + MAX_LATENCY_REGRESSION):
        reasons.append(
            f"latency regression: {cand_latency:.2f}s vs baseline {base_latency:.2f}s"
        )

    if reasons:
        return False, "; ".join(reasons)

    return True, (
        f"pass_rate={cand_pass:.2%} (base={base_pass:.2%}), "
        f"score={cand_score:.4f} (base={base_score:.4f})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare candidate vs baseline")
    parser.add_argument("--name", required=True, help="Experiment name")
    parser.add_argument("--suite", choices=["smoke", "benchmark", "holdout"], default="smoke")
    args = parser.parse_args()

    manifest_file = MANIFESTS_DIR / f"{args.name}.json"
    if not manifest_file.exists():
        fail(f"No manifest: {manifest_file}")

    baseline_file = BASELINES_DIR / "current.json"
    if not baseline_file.exists():
        print("WARNING: No baseline found. Skipping baseline comparison.")
        baseline = {"results": {}}
    else:
        baseline = json.loads(baseline_file.read_text())

    manifest = json.loads(manifest_file.read_text())

    # Map suite to threshold
    thresholds = {
        "smoke": SMOKE_MIN_PASS_RATE,
        "benchmark": BENCHMARK_MIN_PASS_RATE,
        "holdout": HOLDOUT_MIN_PASS_RATE,
    }

    passed, reason = compare_suite(
        baseline, manifest, args.suite, thresholds[args.suite]
    )

    decision = "accept" if passed else "reject"
    manifest["decision"] = decision
    manifest["rationale"] = reason
    manifest["decided_at"] = now_iso()
    manifest_file.write_text(json.dumps(manifest, indent=2))

    ledger_entry = {
        "name": args.name,
        "suite": args.suite,
        "decision": decision,
        "rationale": reason,
        "hypothesis": manifest.get("hypothesis"),
        "mutation_surface": manifest.get("mutation_surface"),
        "timestamp": now_iso(),
    }
    append_ledger(ledger_entry)

    print(f"\n{'='*60}")
    print(f"Experiment: {args.name}")
    print(f"Suite:      {args.suite}")
    print(f"Decision:   {decision.upper()}")
    print(f"Reason:     {reason}")
    print(f"{'='*60}\n")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
