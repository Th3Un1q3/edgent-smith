#!/usr/bin/env python3
"""Aggregate case-*.json result files into a scorecard."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", required=True, help="directory holding case-*.json files")
    return parser.parse_args(argv)


def load_case_files(results_dir: Path) -> list[dict[str, Any]]:
    return [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(results_dir.glob("case-*.json"))
    ]


def merge_assertions(rows: dict[str, dict[str, int]], summary: dict[str, Any]) -> None:
    for text, counts in (summary.get("per_assertion") or {}).items():
        bucket = rows.setdefault(str(text), {"passed": 0, "total": 0})
        bucket["passed"] += int(counts.get("passed", 0))
        bucket["total"] += int(counts.get("total", 0))


def aggregate(cases: list[dict[str, Any]]) -> dict[str, Any]:
    total = 0
    passed = 0
    failed = 0
    elapsed = 0.0
    per_assertion: dict[str, dict[str, int]] = {}
    for data in cases:
        summary = data.get("summary") or {}
        total += int(summary.get("total", 0))
        passed += int(summary.get("passed", 0))
        failed += int(summary.get("failed", 0))
        merge_assertions(per_assertion, summary)
        if "cases" in data:
            elapsed += sum(float(case.get("elapsed") or 0) for case in data.get("cases") or [])
        else:
            elapsed += float(summary.get("avg_elapsed", 0)) * int(summary.get("total", 0))
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "avg_elapsed": round(elapsed / total, 3) if total else 0.0,
        "per_assertion": per_assertion,
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    results_dir = Path(args.results).resolve()
    results_dir.mkdir(parents=True, exist_ok=True)

    cases = load_case_files(results_dir)
    scorecard = {"results_dir": str(results_dir), "case_files": len(cases)}
    scorecard.update(aggregate(cases))

    path = results_dir / "scorecard.json"
    path.write_text(json.dumps(scorecard, indent=2, ensure_ascii=False), encoding="utf-8")

    payload = {
        "ok": True,
        "scorecard": str(path),
        "total": scorecard["total"],
        "passed": scorecard["passed"],
        "failed": scorecard["failed"],
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
