#!/usr/bin/env python3
"""Doc hygiene for the automa skill's markdown files.

Walks all .md files under a root directory (default: the skill root, i.e.
two levels above this script) and reports:
  - every ```json fence parses as JSON (whole-fence); fences that hold
    multiple JSON fragments are accepted if every non-empty line parses, and
    comment-marked fragments (lines starting with //) are flagged
    informationally
  - every non-external markdown link resolves to a real file, and any #anchor
    matches a GitHub-slugged heading in the target file
  - no residual meta-commentary patterns (e.g. "Implements:", "source
    research") in any .md file's body prose (YAML frontmatter excluded)
  - evals/evals.json parses as JSON

Exits non-zero when any fence fails to parse, any link is broken, or any
meta-commentary pattern is found. Findings in files outside this skill are
outside scope and reported only.
"""
import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parents[1]

META_PATTERNS = [
    r"Implements:",
    r"verify against",
    r"Example fragment:",
    r"Notes on the example",
    r"JSON accepts no comments",
    r"This file parses as JSON",
    r"they write and fix",
    r"source research",
]
META_RE = re.compile("|".join(META_PATTERNS))
FENCE_RE = re.compile(r"```json\n(.*?)\n```", re.DOTALL)
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")


def slugify(text):
    """GitHub-style anchor slug approximation: lowercase; keep word chars,
    spaces, hyphens, underscores; spaces become hyphens."""
    text = text.strip().lower()
    text = re.sub(r"[^\w\s\-_]", "", text, flags=re.UNICODE)
    text = text.replace(" ", "-")
    return text


def headings_of(path):
    slugs = set()
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            m = HEADING_RE.match(line)
            if m:
                slugs.add(slugify(m.group(2)))
    except OSError:
        pass
    return slugs


def check_fences(path, rel, findings, info):
    content = path.read_text(encoding="utf-8")
    fences = FENCE_RE.findall(content)
    for i, block in enumerate(fences, 1):
        try:
            json.loads(block)
            continue
        except json.JSONDecodeError as exc:
            pass
        # maybe a multi-fragment fence: try per-line parse
        frag_fail = []
        comment_marked = False
        for ln in block.splitlines():
            if ln.strip().startswith("//"):
                comment_marked = True
            if not ln.strip():
                continue
            try:
                json.loads(ln)
            except json.JSONDecodeError as exc2:
                frag_fail.append(exc2)
        if frag_fail:
            findings.append(f"{rel}: ```json fence {i} does not parse: {exc}")
        else:
            info.append(f"{rel}: fence {i} holds multiple fragments (parsed per line)")
        if comment_marked:
            info.append(f"{rel}: fence {i} contains '//' comment lines")


def check_links(path, rel, findings):
    content = path.read_text(encoding="utf-8")
    for m in LINK_RE.finditer(content):
        target = m.group(1).strip()
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        file_part, _, frag = target.partition("#")
        tgt = path.parent / file_part if file_part else path
        if not tgt.exists():
            findings.append(f"{rel}: link '{target}' -> missing file '{file_part}'")
            continue
        if frag:
            if slugify(frag) not in headings_of(tgt):
                tgt_rel = str(tgt.relative_to(path.parent.parent)) if tgt.is_relative_to(path.parent.parent) else str(tgt)
                findings.append(f"{rel}: link '{target}' -> heading '#{frag}' not found in {tgt_rel}")


def check_meta(path, rel, findings):
    lines = path.read_text(encoding="utf-8").splitlines()
    # Skip a leading YAML frontmatter block (content between the first
    # '---' line and its closing '---' line): provenance/metadata fields
    # there are not residual doc commentary.
    start = 0
    if lines and lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                start = i + 1
                break
    for i in range(start, len(lines)):
        line = lines[i]
        if META_RE.search(line):
            findings.append(f"{rel}:{i + 1}: residual meta pattern: {line.strip()[:90]!r}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Check automa skill doc hygiene.")
    ap.add_argument("root", nargs="?", default=str(DEFAULT_ROOT),
                    help=f"skill root directory (default: {DEFAULT_ROOT})")
    args = ap.parse_args(argv)

    root = Path(args.root)
    if not root.is_dir():
        print(f"FAIL: {args.root} is not a directory")
        return 1

    md_files = sorted(p for p in root.rglob("*.md"))
    findings = []
    info = []

    for path in md_files:
        rel = str(path.relative_to(root))
        check_fences(path, rel, findings, info)
        check_links(path, rel, findings)
        check_meta(path, rel, findings)

    print(f"=== DOC CHECK: {len(md_files)} markdown files under {root}")
    for line in info:
        print(f"  info: {line}")

    print(f"\n=== JSON FENCES: parsed OK; {len(findings)} findings ===")
    print(f"=== LINKS: checked non-external links; {len(findings)} findings ===")
    print(f"=== META PATTERNS: {len(findings)} findings ===")

    # evals.json parse
    ev_path = root / "evals" / "evals.json"
    if ev_path.exists():
        try:
            ev = json.loads(ev_path.read_text(encoding="utf-8"))
            print(f"evals.json parses OK; skill_name={ev.get('skill_name')}; "
                  f"evals={len(ev.get('evals', []))}")
        except Exception as exc:
            findings.append(f"evals.json parse fail: {exc}")
    else:
        findings.append("evals/evals.json missing")

    if findings:
        print(f"\n{len(findings)} FINDING(S):")
        for f in findings:
            print(f"  - {f}")
        return 1
    print("\nDOC CHECK PASSED: all json fences parse, all links resolve, no meta patterns")
    return 0


if __name__ == "__main__":
    sys.exit(main())
