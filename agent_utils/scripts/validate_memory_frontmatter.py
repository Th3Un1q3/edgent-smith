#!/usr/bin/env python3
"""Validate serena-memory frontmatter and fences.

When to load: when you create or edit any .md in serena-memory; run before declaring skill complete.

Usage: python scripts/validate_memory_frontmatter.py [--path .agents/skills/serena-memory]
"""
import pathlib, re, sys, json

ROOT = pathlib.Path(".agents/skills/serena-memory")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL | re.MULTILINE)
FENCE_BACKTICK_RE = re.compile(r"^```", re.MULTILINE)
FENCE_TILDE_RE = re.compile(r"^~~~~", re.MULTILINE)
ALLOWED_TYPES = {"profile","preferences","entities","events","cases","trajectories","experiences","claims","cache"}
ADR_STATUSES = {"proposed","accepted","superseded"}

def check_frontmatter(text, path):
    m = FRONTMATTER_RE.search(text)
    if not m:
        return []  # workflows/references may omit frontmatter — not an error
    body = m.group(1)
    errors = []
    lines = body.splitlines()
    for i, line in enumerate(lines, 1):
        if not line.strip() or line.strip().startswith("#"):
            continue
        # no trailing space
        if line != line.rstrip():
            errors.append(f"{path}:{i}: trailing space")
        # leading space check: top keys at col 0, nested 2 spaces
        if line.startswith(" "):
            leading = len(line) - len(line.lstrip(" "))
            if leading != 2:
                errors.append(f"{path}:{i}: indent must be 0 or 2 spaces, got {leading}: {repr(line)}")
        else:
            # col-0 key — must be key: value
            if ":" not in line and line.strip():
                errors.append(f"{path}:{i}: invalid YAML line (missing colon): {line}")
        # L0 quoted <=256c
        if re.match(r"^\s*L0\s*:", line):
            q = re.search(r'L0:\s*"(.*)"\s*$', line)
            if not q:
                errors.append(f"{path}:{i}: L0 must be quoted with double quotes: {line}")
            else:
                val = q.group(1)
                if len(val) > 256:
                    errors.append(f"{path}:{i}: L0 exceeds 256c ({len(val)})")
        # type in 9-type set or ADR allowlist
        if re.match(r"^\s*type\s*:", line):
            tv = line.split(":",1)[1].strip().strip('"').strip("'")
            if tv not in ALLOWED_TYPES:
                errors.append(f"{path}:{i}: type '{tv}' not in 9-type set {ALLOWED_TYPES}")
        # id equals memory_name check is deferred to runtime; validate format here
        if re.match(r"^\s*id\s*:", line):
            iv = line.split(":",1)[1].strip()
            if not iv:
                errors.append(f"{path}:{i}: empty id")
    # type or ADR check: if no type but has title/status, verify ADR status
    if "type:" not in body and "title:" in body:
        sm = re.search(r"status:\s*(\w+)", body)
        if sm and sm.group(1) not in ADR_STATUSES:
            errors.append(f"{path}: ADR status '{sm.group(1)}' not in {ADR_STATUSES}")
    # also check 2-space nesting for any indented line not matching 2
    # already covered above
    # check required frontmatter on SKILL.md
    if path.name == "SKILL.md":
        for k in ["name", "description", "license", "compatibility", "metadata"]:
            if k not in body:
                errors.append(f"{path}: missing frontmatter key: {k}")
    return errors

def check_fences(text, path):
    backtick = len(FENCE_BACKTICK_RE.findall(text))
    tilde = len(FENCE_TILDE_RE.findall(text))
    errs = []
    if backtick % 2 != 0:
        errs.append(f"{path}: unmatched ``` fences ({backtick})")
    if tilde % 2 != 0:
        errs.append(f"{path}: unmatched ~~~~ fences ({tilde})")
    for m in re.finditer(r"```json\n(.*?)\n```", text, re.DOTALL):
        try:
            json.loads(m.group(1))
        except Exception as e:
            errs.append(f"{path}: invalid JSON block: {e}")
    # --- balance: count delimiter lines
    dash_lines = [l for l in text.splitlines() if l.strip() == "---"]
    if len(dash_lines) % 2 != 0:
        errs.append(f"{path}: unbalanced --- delimiters ({len(dash_lines)})")
    # no leading/trailing space already in frontmatter, check whole file trailing spaces for FM lines
    for i, line in enumerate(text.splitlines(), 1):
        if line != line.rstrip() and "---" not in line:
            # only flag FM-like lines with trailing space
            if re.match(r"^\s*(id|type|L0|hotness|ttl|version|freshness|directory|claim_ids|provenance|L0_table|title|status|date|scope)\s*:", line):
                errs.append(f"{path}:{i}: trailing space in FM-like line")
    return errs

def main():
    args = sys.argv[1:]
    if "--path" in args:
        idx = args.index("--path")
        root_str = args[idx + 1] if idx + 1 < len(args) else ".agents/skills/serena-memory"
    elif args:
        root_str = args[0]
    else:
        root_str = ".agents/skills/serena-memory"
    root = pathlib.Path(root_str)
    errors = []
    for p in root.rglob("*.md"):
        t = p.read_text(encoding="utf-8")
        errors.extend(check_frontmatter(t, p))
        errors.extend(check_fences(t, p))
    for p in root.rglob("*.py"):
        try:
            compile(p.read_text(), str(p), "exec")
        except SyntaxError as e:
            errors.append(f"{p}: python syntax error: {e}")
    if errors:
        for e in errors:
            print(e)
        print(f"FAIL: {len(errors)} issue(s)")
        sys.exit(1)
    print("PASS: frontmatter and fences valid")

if __name__ == "__main__":
    main()
