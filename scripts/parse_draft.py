#!/usr/bin/env python3
"""Parse a YAML-only agent draft and extract title and body into separate files.

Usage:
    python3 scripts/parse_draft.py DRAFT_PATH TITLE_PATH BODY_PATH
"""

from __future__ import annotations

import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    args = argv or sys.argv[1:]
    if len(args) != 3:
        print("Usage: parse_draft.py DRAFT_PATH TITLE_PATH BODY_PATH", file=sys.stderr)
        return 2

    draft_path, title_path, body_path = Path(args[0]), Path(args[1]), Path(args[2])
    lines = draft_path.read_text().splitlines()

    if len(lines) < 3:
        print("Draft must include title and body fields.", file=sys.stderr)
        return 1

    title_prefix = "title: "
    if not lines[0].startswith(title_prefix):
        print("Draft title must be a single-line YAML scalar.", file=sys.stderr)
        return 1

    title = lines[0][len(title_prefix) :].strip()
    if not title or not title.startswith("experiment:"):
        print("Draft title must start with 'experiment:'.", file=sys.stderr)
        return 1

    if lines[1] != "body: |":
        print("Draft body must use a literal YAML block scalar.", file=sys.stderr)
        return 1

    normalized: list[str] = []
    for line in lines[2:]:
        if line.startswith("  "):
            normalized.append(line[2:])
        elif line == "":
            normalized.append("")
        else:
            print("Draft body lines must be indented by two spaces.", file=sys.stderr)
            return 1

    body = "\n".join(normalized).strip()
    if not body:
        print("Draft body must not be empty.", file=sys.stderr)
        return 1

    title_path.write_text(title + "\n")
    body_path.write_text(body + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
