#!/usr/bin/env python3
"""Validate Markdown link targets across a skills tree.

Usage:
    python3 validate_md_links.py [ROOT]

Recursively scans ROOT (default: the skills root three parents above this
script) for *.md files and reports every relative text link whose target
file does not exist. Fenced code blocks (``` or ~~~) and inline code spans
are skipped so placeholder links inside template skeletons never flag.
Prints one line per broken link, then a summary. Exits 0 when all links
resolve, 1 when any link is broken, 2 on usage errors.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys
from collections.abc import Iterator

FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
IGNORED_SCHEMES = ("http://", "https://", "ftp://", "mailto:")


def iter_links(text: str) -> Iterator[tuple[int, str]]:
    """Yield (line_number, target) for each link outside fences and code spans."""
    fence_char = None
    for lineno, line in enumerate(text.splitlines(), 1):
        marker = FENCE_RE.match(line)
        if fence_char:
            if marker and marker.group(1)[0] == fence_char:
                fence_char = None
            continue
        if marker:
            fence_char = marker.group(1)[0]
            continue
        for target in LINK_RE.findall(INLINE_CODE_RE.sub("", line)):
            target = target.strip()
            if (
                not target
                or target.startswith(("#", "/", "//"))
                or target.startswith(IGNORED_SCHEMES)
            ):
                continue
            yield lineno, target.split("#", 1)[0].split("?", 1)[0]


DEFAULT_EXCLUDES = [".dsh", "node_modules", ".serena/cache", "researches"]


def _is_excluded(path: pathlib.Path, excludes: list[str]) -> bool:
    s = str(path)
    return any(e in s for e in excludes)


def main(argv: list[str] | None = None) -> int:
    default_root = str(pathlib.Path(__file__).resolve().parents[2])
    parser = argparse.ArgumentParser(description="Validate Markdown links across a skills tree.")
    parser.add_argument(
        "roots", nargs="*", default=None, help="skills root(s) to scan (default: %(default)s)"
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        dest="excludes",
        help="exclude any path containing this substring (repeatable)",
    )
    args = parser.parse_args(argv)

    excludes = list(DEFAULT_EXCLUDES) + list(args.excludes or [])
    roots = args.roots if args.roots else [default_root]
    # argparse with nargs=* sets default None but when no args it gives []; handle
    if not roots:
        roots = [default_root]

    files_scanned = 0
    links_checked = 0
    broken = 0
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
            for lineno, target in iter_links(text):
                links_checked += 1
                if not (md.parent / target).resolve().exists():
                    broken += 1
                    print(f"{md}:{lineno}: broken link -> {target}")

    print(f"files scanned: {files_scanned}; links checked: {links_checked}; broken: {broken}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
