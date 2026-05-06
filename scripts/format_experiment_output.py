#!/usr/bin/env python3
"""Write experiment result JSON fields to $GITHUB_OUTPUT (or a path).

Usage:
    python3 scripts/format_experiment_output.py RESULT_PATH OUTPUT_PATH
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

FIELDS = (
    "status",
    "issue_number",
    "baseline_id",
    "attempt",
    "state_path",
    "baseline_score",
    "candidate_score",
    "score_delta",
    "baseline_bootstrapped",
    "candidate_path",
)


def main(argv: list[str] | None = None) -> int:
    args = argv or sys.argv[1:]
    if len(args) != 2:
        print("Usage: format_experiment_output.py RESULT_PATH OUTPUT_PATH", file=sys.stderr)
        return 2
    result = json.loads(Path(args[0]).read_text())
    output_path = Path(args[1])
    with output_path.open("a") as fh:
        for field in FIELDS:
            value = result.get(field, "")
            rendered = str(value).lower() if isinstance(value, bool) else str(value)
            print(f"{field}={rendered}", file=fh)
    # Also print the status to stdout for the caller to capture.
    status = result.get("status", "")
    if not status:
        print("::error::Result JSON missing 'status' field.", file=sys.stderr)
        return 1
    print(status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
