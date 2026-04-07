#!/usr/bin/env python3
"""Initialize a new experiment branch and manifest.

Usage:
    python experiments/scripts/init_experiment.py \
        --name "short-prompt-v2" \
        --hypothesis "Shorter system prompt reduces latency without quality loss" \
        --mutation-surface "prompts/system/edge_agent.md"

Creates:
    experiments/manifests/<name>.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MANIFESTS_DIR, now_iso, fail


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize a new experiment")
    parser.add_argument("--name", required=True, help="Short experiment name (slug)")
    parser.add_argument("--hypothesis", required=True, help="One-sentence hypothesis")
    parser.add_argument(
        "--mutation-surface",
        nargs="+",
        required=True,
        help="Files/paths being mutated (relative to repo root)",
    )
    parser.add_argument("--parent", default=None, help="Parent experiment name or 'baseline'")
    args = parser.parse_args()

    # Validate name is slug-like
    if not args.name.replace("-", "").replace("_", "").isalnum():
        fail("--name must be a slug (alphanumeric, hyphens, underscores only)")

    # Check allowed mutation surfaces
    ALLOWED_PREFIXES = [
        "prompts/",
        "src/edgent_smith/agents/edge_agent.py",
        "src/edgent_smith/config/settings.py",
        "src/edgent_smith/tools/",
    ]
    for surface in args.mutation_surface:
        if not any(surface.startswith(p) for p in ALLOWED_PREFIXES):
            fail(
                f"Mutation surface '{surface}' is not in the allowed list.\n"
                f"Allowed prefixes: {ALLOWED_PREFIXES}\n"
                "See EXPERIMENT_RULES.md for the full mutation boundary definition."
            )

    manifest = {
        "name": args.name,
        "hypothesis": args.hypothesis,
        "mutation_surface": args.mutation_surface,
        "parent": args.parent or "baseline",
        "status": "initialized",
        "created_at": now_iso(),
        "smoke_result": None,
        "benchmark_result": None,
        "holdout_result": None,
        "decision": None,
        "rationale": None,
    }

    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    manifest_file = MANIFESTS_DIR / f"{args.name}.json"
    if manifest_file.exists():
        fail(f"Manifest already exists: {manifest_file}")

    manifest_file.write_text(json.dumps(manifest, indent=2))
    print(f"Experiment manifest created: {manifest_file}")
    print(f"Branch convention: experiment/{args.name}")
    print("Next steps:")
    print("  1. Create branch: git checkout -b experiment/" + args.name)
    print("  2. Mutate only the listed surfaces")
    print("  3. Run: python experiments/scripts/run_candidate.py --name " + args.name)


if __name__ == "__main__":
    main()
