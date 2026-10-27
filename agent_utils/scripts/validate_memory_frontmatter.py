#!/usr/bin/env python3
"""Validate Serena memory frontmatter against a path-scope policy.

Memory namespaces are populated differently, so the rules apply differently:
exempt namespaces (cache/, researches/, ...) are skipped and counted, validate
namespaces (typed scopes, ADRs, every about.md) carry the full rule set as hard
failures, and every other namespace is structural — checked only when it
declares a ``type:``, and never able to fail the gate.

Usage: python scripts/validate_memory_frontmatter.py [--path DIR] [--strict]

Exit codes: 0 clean (warnings allowed), 1 validate-scope fatal (or any warning
under --strict), 2 usage error.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from dataclasses import dataclass

TIER_VALIDATE = "validate"
TIER_STRUCTURAL = "structural"
TIER_EXEMPT = "exempt"

# Prefix tables relative to the memory-store root; scope lives here, not in ifs.
EXEMPT_PREFIXES: tuple[str, ...] = (
    "cache/",
    "researches/",
    "serena/",
    "private/",
    "browser-automation/",
    "evals/",
    "tooling/",
)
VALIDATE_PREFIXES: tuple[str, ...] = (
    "profile/",
    "preferences/",
    "entities/",
    "events/",
    "cases/",
    "claims/",
    "experiences/",
    "trajectories/",
    "architecture/adr/",
)
TYPED_PREFIXES: tuple[str, ...] = (
    "profile/",
    "preferences/",
    "entities/",
    "events/",
    "cases/",
    "claims/",
    "experiences/",
    "trajectories/",
)
ALLOWED_TYPES: frozenset[str] = frozenset(
    {
        "profile",
        "preferences",
        "entities",
        "events",
        "cases",
        "trajectories",
        "experiences",
        "claims",
        "cache",
    }
)
ABOUT_TYPE = "about"
ABOUT_NAME = "about.md"
ADR_STATUSES: frozenset[str] = frozenset({"proposed", "accepted", "superseded"})
ADR_PREFIX = "architecture/adr/"
ADR_ID_RE = re.compile(r"^ADR-\d+$")
SKILL_KEYS: tuple[str, ...] = ("name", "description", "license", "compatibility", "metadata")
SKILL_ROOT_MARKER = ".agents/skills"
DEFAULT_ROOT = ".agents/skills/serena-memory"
MAX_L0 = 256

# Anchored at file start: a '---' inside body prose or a table separator must
# never open frontmatter.
FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:[ \t]*\r?\n|\Z)", re.DOTALL)
JSON_FENCE_RE = re.compile(r"```json\n(.*?)\n```", re.DOTALL)
KEY_RE = re.compile(r"^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$")


@dataclass(frozen=True)
class Finding:
    """One rule violation, tagged with the scope tier that produced it."""

    severity: str
    scope: str
    path: str
    line: int
    message: str


def _demote(scope: str, severity: str) -> str:
    """A structural finding reports but never fails the gate."""
    if scope == TIER_STRUCTURAL and severity == "error":
        return "warning"
    return severity


def _key_value(line: str) -> tuple[str, str] | None:
    match = KEY_RE.match(line)
    if match is None:
        return None
    return match.group(1), match.group(2)


def _is_about(rel: str) -> bool:
    return rel == ABOUT_NAME or rel.endswith("/" + ABOUT_NAME)


def scope_tier(rel: str) -> str:
    """Classify a memory path; about.md outranks exempt prefixes by design."""
    if _is_about(rel):
        return TIER_VALIDATE
    if rel.startswith(EXEMPT_PREFIXES):
        return TIER_EXEMPT
    if rel.startswith(VALIDATE_PREFIXES):
        return TIER_VALIDATE
    return TIER_STRUCTURAL


def is_memory_store(root: pathlib.Path) -> bool:
    parts = root.resolve().parts
    return "memories" in parts or ".serena" in parts


def declares_type(text: str) -> bool:
    match = FRONTMATTER_RE.match(text)
    if match is None:
        return False
    for line in match.group(1).splitlines():
        kv = _key_value(line)
        if kv is not None and kv[0] == "type":
            return True
    return False


def _check_lines(lines: list[str], path: pathlib.Path, scope: str, rel: str) -> list[Finding]:
    findings: list[Finding] = []
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        if line != line.rstrip():
            findings.append(
                Finding(_demote(scope, "warning"), scope, str(path), number, "trailing space")
            )
        leading = len(line) - len(line.lstrip(" "))
        if leading % 2:
            findings.append(
                Finding(
                    _demote(scope, "warning"),
                    scope,
                    str(path),
                    number,
                    f"indent must be even (0, 2, 4, ...), got {leading}",
                )
            )
    return findings


def _check_type(
    lines: list[str], path: pathlib.Path, rel: str, scope: str
) -> tuple[list[Finding], bool]:
    findings: list[Finding] = []
    declared: str | None = None
    number = 0
    for index, line in enumerate(lines, 1):
        kv = _key_value(line)
        if kv is not None and kv[0] == "type":
            declared = kv[1].strip().strip('"').strip("'")
            number = index
            break
    about = _is_about(rel)
    typed_scope = rel.startswith(TYPED_PREFIXES)
    if declared is None:
        if scope == TIER_VALIDATE and typed_scope:
            findings.append(Finding("error", scope, str(path), 1, "typed frontmatter missing type"))
        return findings, False
    if about:
        # An about memory names its parent scope in type:; 'about' itself is the
        # tolerated placeholder that frontmatter.md asks to replace.
        if declared == ABOUT_TYPE:
            findings.append(
                Finding(
                    _demote(scope, "warning"),
                    scope,
                    str(path),
                    number,
                    "type 'about' should name the parent scope (frontmatter.md)",
                )
            )
        return findings, True
    if declared not in ALLOWED_TYPES:
        findings.append(
            Finding(
                _demote(scope, "error"),
                scope,
                str(path),
                number,
                f"type '{declared}' not in 9-type set",
            )
        )
    return findings, True


def _is_adr_id(value: str, rel: str, stem: str) -> bool:
    """ADRs keep a short id while the stem appends the title slug."""
    if not rel.startswith(ADR_PREFIX) or ADR_ID_RE.match(value) is None:
        return False
    return stem == value or stem.startswith(value + "-")


def _check_identity(lines: list[str], path: pathlib.Path, rel: str, scope: str) -> list[Finding]:
    findings: list[Finding] = []
    memory_names = {path.stem, rel.removesuffix(".md").replace("/", "-")}
    for number, line in enumerate(lines, 1):
        kv = _key_value(line)
        if kv is None or kv[0] != "id":
            continue
        value = kv[1].strip().strip('"').strip("'")
        if not value:
            findings.append(Finding(_demote(scope, "error"), scope, str(path), number, "empty id"))
            continue
        if value.replace("/", "-") not in memory_names and not _is_adr_id(value, rel, path.stem):
            findings.append(
                Finding(
                    _demote(scope, "warning"),
                    scope,
                    str(path),
                    number,
                    f"id '{value}' does not equal memory name '{path.stem}'",
                )
            )
    return findings


def _scan_l0(lines: list[str], path: pathlib.Path, scope: str) -> tuple[list[Finding], bool, bool]:
    findings: list[Finding] = []
    has_l0 = False
    has_type = False
    for number, line in enumerate(lines, 1):
        leading = len(line) - len(line.lstrip(" "))
        kv = _key_value(line)
        if kv is None:
            continue
        key, raw = kv
        if key == "type":
            has_type = True
        if key != "L0":
            continue
        has_l0 = True
        if leading > 0:
            continue
        quoted = re.match(r'^"(.*)"$', raw)
        if quoted is None:
            findings.append(
                Finding(
                    _demote(scope, "error"),
                    scope,
                    str(path),
                    number,
                    f"L0 must be quoted with double quotes: {line.strip()}",
                )
            )
        elif len(quoted.group(1)) > MAX_L0:
            findings.append(
                Finding(
                    _demote(scope, "error"),
                    scope,
                    str(path),
                    number,
                    f"L0 exceeds {MAX_L0}c ({len(quoted.group(1))})",
                )
            )
    return findings, has_l0, has_type


def _check_l0(lines: list[str], path: pathlib.Path, rel: str, scope: str) -> list[Finding]:
    findings, has_l0, has_type = _scan_l0(lines, path, scope)
    required = scope == TIER_VALIDATE and rel.startswith(TYPED_PREFIXES)
    about = _is_about(rel)
    typed_format = not rel.startswith(ADR_PREFIX)
    if not has_l0:
        if required:
            findings.append(Finding("error", scope, str(path), 1, "typed frontmatter missing L0"))
        elif typed_format and (has_type or about):
            findings.append(
                Finding(
                    _demote(scope, "warning"),
                    scope,
                    str(path),
                    1,
                    "typed frontmatter must carry type and L0 (frontmatter.md)",
                )
            )
    elif typed_format and not has_type and not about and not required:
        findings.append(
            Finding(
                _demote(scope, "warning"),
                scope,
                str(path),
                1,
                "typed frontmatter must carry type and L0 (frontmatter.md)",
            )
        )
    return findings


def _check_adr(lines: list[str], path: pathlib.Path, rel: str, scope: str) -> list[Finding]:
    if not rel.startswith(ADR_PREFIX):
        return []
    for number, line in enumerate(lines, 1):
        kv = _key_value(line)
        if kv is None or kv[0] != "status":
            continue
        value = kv[1].strip().strip('"').strip("'")
        if value not in ADR_STATUSES:
            return [
                Finding(
                    _demote(scope, "error"),
                    scope,
                    str(path),
                    number,
                    f"ADR status '{value}' not in {set(ADR_STATUSES)}",
                )
            ]
    return []


def _check_skill_keys(lines: list[str], path: pathlib.Path, scope: str) -> list[Finding]:
    if path.name != "SKILL.md" or SKILL_ROOT_MARKER not in path.as_posix():
        return []
    present = {kv[0] for line in lines if (kv := _key_value(line)) is not None}
    return [
        Finding("error", scope, str(path), 1, f"missing frontmatter key: {key}")
        for key in SKILL_KEYS
        if key not in present
    ]


def _check_json_fences(text: str, path: pathlib.Path, scope: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in JSON_FENCE_RE.finditer(text):
        try:
            json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            findings.append(
                Finding(
                    _demote(scope, "error"),
                    scope,
                    str(path),
                    0,
                    f"invalid JSON block: {exc}",
                )
            )
    return findings


def check_frontmatter(text: str, path: pathlib.Path, rel: str, scope: str) -> list[Finding]:
    """Run every applicable memory rule; no frontmatter is a pass."""
    findings: list[Finding] = []
    match = FRONTMATTER_RE.match(text)
    if match is not None:
        lines = match.group(1).splitlines()
        findings.extend(_check_lines(lines, path, scope, rel))
        type_findings, _ = _check_type(lines, path, rel, scope)
        findings.extend(type_findings)
        findings.extend(_check_identity(lines, path, rel, scope))
        findings.extend(_check_l0(lines, path, rel, scope))
        findings.extend(_check_adr(lines, path, rel, scope))
        findings.extend(_check_skill_keys(lines, path, scope))
    if scope == TIER_VALIDATE:
        findings.extend(_check_json_fences(text, path, scope))
    return findings


def _check_python(root: pathlib.Path) -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(root.rglob("*.py")):
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except SyntaxError as exc:
            findings.append(
                Finding(
                    "error",
                    TIER_VALIDATE,
                    str(path),
                    exc.lineno or 0,
                    f"python syntax error: {exc.msg}",
                )
            )
    return findings


def _grouped(findings: list[Finding]) -> list[tuple[str, list[Finding]]]:
    grouped: dict[str, list[Finding]] = {}
    for finding in findings:
        grouped.setdefault(finding.path, []).append(finding)
    return sorted(grouped.items())


def _render(title: str, findings: list[Finding], marker: str) -> None:
    if not findings:
        return
    print(f"\n{title}")
    for path_text, group in _grouped(findings):
        print(f"{path_text} ({len(group)})")
        for finding in sorted(group, key=lambda item: item.line):
            print(f"  {marker}{finding.line}: {finding.message}")


def _parse_root(args: list[str]) -> str | None:
    if "--path" in args:
        index = args.index("--path")
        if index + 1 >= len(args):
            return None
        return args[index + 1]
    return args[0] if args else DEFAULT_ROOT


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    strict = "--strict" in args
    root_str = _parse_root([arg for arg in args if arg != "--strict"])
    if root_str is None:
        print("ERROR: --path requires a directory")
        return 2
    root = pathlib.Path(root_str)
    if not root.is_dir():
        print(f"ERROR: not a directory: {root}")
        return 2

    store = is_memory_store(root)
    file_counts = {TIER_VALIDATE: 0, TIER_STRUCTURAL: 0, TIER_EXEMPT: 0}
    untyped_structural = 0
    skipped = 0
    findings: list[Finding] = []
    for path in sorted(root.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(root).as_posix()
        scope = scope_tier(rel) if store else TIER_VALIDATE
        file_counts[scope] += 1
        if scope == TIER_EXEMPT:
            skipped += len(check_frontmatter(text, path, rel, TIER_VALIDATE))
            continue
        if scope == TIER_STRUCTURAL and not declares_type(text):
            untyped_structural += 1
            continue
        findings.extend(check_frontmatter(text, path, rel, scope))
    findings.extend(_check_python(root))

    errors = [f for f in findings if f.severity == "error"]
    warnings = [f for f in findings if f.severity == "warning"]
    validate_warnings = sum(1 for f in warnings if f.scope == TIER_VALIDATE)
    structural_warnings = len(warnings) - validate_warnings

    print(
        f"VALIDATE   {file_counts[TIER_VALIDATE]:>4} files  {len(errors):>3} errors  "
        f"{validate_warnings:>3} warnings"
    )
    print(
        f"STRUCTURAL {file_counts[TIER_STRUCTURAL]:>4} files  "
        f"{untyped_structural:>3} untyped counted  {structural_warnings:>3} warnings"
    )
    print(f"EXEMPT     {file_counts[TIER_EXEMPT]:>4} files  {skipped:>3} findings skipped")
    print(f"SUMMARY: {len(errors)} errors, {len(warnings)} warnings, {skipped} skipped")

    _render("FAILURES (grouped by file)", errors, "E")
    _render("WARNINGS (grouped by file)", warnings, "W")

    if errors or (strict and warnings):
        print(f"\nFAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print("\nPASS: no validate-scope errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
