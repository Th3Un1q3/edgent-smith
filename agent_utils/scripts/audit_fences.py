#!/usr/bin/env python3
"""Audit code fences in a skill tree (Rule 15).

Usage:
    python3 audit_fences.py [ROOT]

Scans ROOT (default: current directory) for *.md files and parses every
```json fence with json.loads. Matches both ``` and ~~~~ fence runs so
template skeletons using ~~~~md get the same coverage. Prints one line per
invalid JSON fence, then a summary. Exits 0 when every declared-language
fence parses, 1 when any JSON fence fails to parse, 2 on usage errors.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

FENCE_RE = re.compile(r"(`{3,}|~{3,})(\w*)\n(.*?)\1", re.S)

DEFAULT_EXCLUDES = [".dsh", "node_modules", ".serena/cache", "researches"]


def _is_excluded(path: pathlib.Path, excludes: list[str]) -> bool:
    s = str(path)
    return any(e in s for e in excludes)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit code fences in a skill tree.")
    parser.add_argument("roots", nargs="*", default=None, help="roots to scan")
    parser.add_argument("--exclude", action="append", default=[], dest="excludes",
                        help="exclude any path containing this substring (repeatable)")
    args = parser.parse_args(argv)

    excludes = list(DEFAULT_EXCLUDES) + list(args.excludes or [])
    roots = args.roots if args.roots else ["."]
    if not roots:
        roots = ["."]

    files_scanned = 0
    fences_audited = 0
    violations = 0
    for root_str in roots:
        root = pathlib.Path(root_str)
        if not root.is_dir():
            print(f"error: not a directory: {root}", file=sys.stderr)
            return 2
        for md in sorted(root.rglob("*.md")):
            if _is_excluded(md, excludes):
                continue
            files_scanned += 1
            try:
                text = md.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                print(f"{md}: unreadable: {exc}")
                continue
            for i, (_fence, lang, body) in enumerate(FENCE_RE.findall(text), 1):
                fences_audited += 1
                if lang.lower() == "json":
                    try:
                        json.loads(body)
                    except Exception as exc:
                        violations += 1
                        print(f"{md}: fence {i}: {exc}")

    print(f"files scanned: {files_scanned}; fences audited: {fences_audited}; json violations: {violations}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())