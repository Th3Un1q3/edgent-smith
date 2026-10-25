#!/usr/bin/env python3
"""Validate a skill's evals/evals.json and report the selected case ids."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SKILLS_ROOT = Path(".agents/skills")
EVAL_FILE = Path("evals/evals.json")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill", required=True, help="skill name or directory")
    parser.add_argument("--cases", default="all", help="ids to keep, e.g. 1,3-5")
    return parser.parse_args(argv)


def resolve_skill(skill: str) -> Path:
    candidate = Path(skill)
    if candidate.is_dir():
        return candidate.resolve()
    return (SKILLS_ROOT / skill).resolve()


def parse_case_spec(spec: str) -> set[int] | None:
    """Return the requested ids, or None when every case is wanted."""
    text = spec.strip()
    if not text or text.lower() == "all":
        return None

    selected: set[int] = set()
    for token in text.split(","):
        entry = token.strip()
        if not entry:
            raise ValueError(f"empty entry in --cases: {spec!r}")
        start_text, sep, end_text = entry.partition("-")
        try:
            start = int(start_text)
            end = int(end_text) if sep else start
        except ValueError as exc:
            raise ValueError(f"invalid --cases entry: {entry!r}") from exc
        if start < 1 or end < start:
            raise ValueError(f"invalid --cases range: {entry!r}")
        selected.update(range(start, end + 1))
    return selected


def validate_case(case: Any, index: int, errors: list[str]) -> int | None:
    where = f"evals[{index}]"
    if not isinstance(case, dict):
        errors.append(f"{where}: case must be an object")
        return None

    case_id = case.get("id")
    if not isinstance(case_id, int) or isinstance(case_id, bool):
        errors.append(f"{where}: id must be an integer")
        return None

    where = f"case {case_id}"
    if not isinstance(case.get("prompt"), str):
        errors.append(f"{where}: prompt must be a string")
    if not isinstance(case.get("expected_output"), str):
        errors.append(f"{where}: expected_output must be a string")

    assertions = case.get("assertions")
    if not isinstance(assertions, list) or not assertions:
        errors.append(f"{where}: assertions must be a non-empty list")
    else:
        for position, assertion in enumerate(assertions):
            text = assertion.get("text") if isinstance(assertion, dict) else None
            if not isinstance(text, str):
                errors.append(f"{where}: assertions[{position}].text must be a string")
    return case_id


def validate_document(data: Any, errors: list[str]) -> list[int]:
    if not isinstance(data, dict):
        errors.append("eval set must be a JSON object")
        return []
    if not isinstance(data.get("skill_name"), str):
        errors.append("skill_name must be a string")

    cases = data.get("evals")
    if not isinstance(cases, list):
        errors.append("evals must be a list")
        return []

    case_ids: list[int] = []
    for index, case in enumerate(cases):
        case_id = validate_case(case, index, errors)
        if case_id is not None:
            case_ids.append(case_id)
    return case_ids


def load_document(path: Path, errors: list[str]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        errors.append(f"cannot read {path}: {exc}")
    except json.JSONDecodeError as exc:
        errors.append(f"{path} is not valid JSON: {exc}")
    return None


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    errors: list[str] = []

    skill_dir = resolve_skill(args.skill)
    eval_set = skill_dir / EVAL_FILE
    case_ids: list[int] = []

    try:
        requested = parse_case_spec(args.cases)
    except ValueError as exc:
        errors.append(str(exc))
        requested = set()

    if not skill_dir.is_dir():
        errors.append(f"skill directory not found: {skill_dir}")
    elif not eval_set.is_file():
        errors.append(f"eval set not found: {eval_set}")
    else:
        data = load_document(eval_set, errors)
        if data is not None:
            case_ids = validate_document(data, errors)

    if requested is not None and not errors:
        case_ids = [case_id for case_id in case_ids if case_id in requested]

    valid = not errors
    ok = valid and bool(case_ids)
    payload = {
        "ok": ok,
        "valid": valid,
        "eval_set": str(eval_set),
        "count": len(case_ids),
        "case_ids": case_ids,
        "errors": errors,
    }
    print(json.dumps(payload))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
