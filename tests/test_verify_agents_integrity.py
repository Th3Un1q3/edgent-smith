from __future__ import annotations

import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def _read_text(path: pathlib.Path) -> str:
    return (REPO_ROOT / path).read_text(encoding="utf-8")


def test_justfile_boundary_allowed_11_and_mod_7() -> None:
    text = _read_text(pathlib.Path("justfile"))
    # allowed list must be exactly 11
    match = re.search(r'^\s*allowed="([^"]+)"', text, re.MULTILINE)
    assert match is not None, "allowed variable not found in justfile"
    allowed = match.group(1).split()
    assert len(allowed) == 11, f"expected 11 allowed recipes, got {len(allowed)}: {allowed}"
    assert set(allowed) == {
        "test",
        "lint",
        "typecheck",
        "ci",
        "ci-fast",
        "format",
        "format-check",
        "clean",
        "verify-agents",
        "oc",
        "oc-log",
    }
    # verify actual recipes count matches allowed 11 (filter set := assignments)
    actual_names = []
    for line in text.splitlines():
        if re.match(r"^[a-z][a-z0-9_-]*.*:", line) and ":=" not in line:
            m = re.match(r"^([a-z][a-z0-9_-]*)", line)
            if m:
                actual_names.append(m.group(1))
    assert len(actual_names) == 11, f"expected 11 recipes, got {len(actual_names)}: {actual_names}"

    # mod_count must be 7
    mod_count = len(re.findall(r"^mod\?? ", text, re.MULTILINE))
    assert mod_count == 7, f"expected 7 mod imports, got {mod_count}"
    for mod in ["agent_utils", "evals", "scripts", "docs", "agents", "cli", "opencode"]:
        assert re.search(rf"^mod\?? {mod}", text, re.MULTILINE), f"missing mod {mod}"


def test_justfile_verify_agents_calls_verify_thresholds() -> None:
    text = _read_text(pathlib.Path("justfile"))
    assert "bash scripts/verify_thresholds.sh" in text, (
        "verify-agents must call verify_thresholds.sh (Gate #0)"
    )
    # verify_thresholds must be first gate before verify-agents grep gates
    vg_idx = text.index("bash scripts/verify_thresholds.sh")
    va_idx = text.index("verify-agents: 8 grep gates")
    assert vg_idx < va_idx, "verify-thresholds.sh must run before grep gates in verify-agents"


def test_stryker_break_72_not_null() -> None:
    text = _read_text(pathlib.Path(".opencode/stryker.config.mjs"))
    assert re.search(r"break:\s*72", text), "stryker break threshold must be 72"
    assert not re.search(r"break:\s*null", text), "stryker break must not be null"


def test_vitest_branches_90() -> None:
    text = _read_text(pathlib.Path(".opencode/vitest.config.ts"))
    for key in ["branches", "functions", "lines", "statements"]:
        assert re.search(rf"{key}:\s*90", text), f"vitest coverage {key} must be 90"


def test_harness_branches_85() -> None:
    text = _read_text(pathlib.Path(".opencode/plugins/config/harness.config.ts"))
    # harness opencode-test gate must enforce 85 thresholds
    for key in ["branches 85", "functions 85", "lines 85", "statements 85"]:
        assert key in text, f"harness must contain '{key}'"
    # also ensure at least 5 gates defined
    gate_count = text.count("name: '")
    # qualityGates array length check - count gate entries
    assert gate_count >= 5, f"expected >=5 gates in harness.config.ts, got {gate_count}"


def test_eslint_ban_disable() -> None:
    text = _read_text(pathlib.Path(".opencode/eslint.config.js"))
    assert "no-eslint-disable" in text, (
        "eslint ban-disable rule must remain (forbid eslint-disable)"
    )
    assert not re.search(r"try\s*:\s*true", text), "eslint must not contain try:true override"


def test_gate_config_fail_closed() -> None:
    text = _read_text(pathlib.Path(".opencode/plugins/helpers/gate-config.ts"))
    assert "section?.gates" in text
    assert "gates.length < 5" in text, "gate-config must check gates.length < 5"
    assert "expected >=5 gates, got" in text, (
        "gate-config must throw with expected >=5 gates message"
    )
    assert "Fix source, not config." in text, "gate-config must contain Fix source, not config hint"
    # must throw, not silently return empty
    assert "throw new Error" in text
    # ensure fallback `?? []` is gone (fail-closed, not fail-open)
    # we allow debounce fallback but not gates fallback to []
    assert "gates: section?.gates ?? []" not in text, "fail-open fallback must be removed"
    assert "gates: section.gates" in text or "gates: section?.gates" in text


def test_ci_has_13_gates() -> None:
    text = _read_text(pathlib.Path("scripts/ci.sh"))
    # Gate #0 verify-thresholds + 12 others = 13 distinct gates
    gate_names = set(re.findall(r"run_check\s+([a-z0-9\-]+)", text))
    assert len(gate_names) == 13, (
        f"expected 13 distinct gates in ci.sh, got {len(gate_names)}: {gate_names}"
    )
    assert "verify-thresholds" in text
    assert "verify-agents" in text
    assert "opencode-mutation" in text
    # also ensure header documents 13 gates
    assert "13 gates" in text


def test_verify_agents_grep_gates_present() -> None:
    text = _read_text(pathlib.Path("justfile"))
    # ensure the 8 grep gates from AGENTS.md VALIDATION are still pinned
    for needle in [
        'grep -R "pydantic-ai" pyproject.toml',
        ".dsh/cordis.patch.yml",
        ".opencode/agents/rug.md",
        ".github/agents/*.agent.md",
        "scripts/conductor",
        "mcp/catalog.yaml",
        ".agents/skills/",
        "allowed_count",
        "mod_count",
        "set working-directory",
        "[c]d .*&&",
    ]:
        assert needle in text, f"verify-agents must contain '{needle}'"


def test_python_strict_and_complexity() -> None:
    text = _read_text(pathlib.Path("pyproject.toml"))
    assert re.search(r"strict\s*=\s*true", text), "mypy strict=true must be pinned"
    assert re.search(r"max-complexity\s*=\s*10", text), "ruff max-complexity 10 must be pinned"
    assert "ignore_missing_imports" not in text, "ignore_missing_imports must not be present"
