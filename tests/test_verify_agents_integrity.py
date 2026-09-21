from __future__ import annotations

import pathlib
import re
import subprocess

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


def test_stryker_cache_key_segmented() -> None:
    text = _read_text(pathlib.Path(".github/workflows/ci.yml"))
    dep = (
        "hashFiles('.opencode/bun.lock', '.opencode/package.json', "
        "'.devcontainer/devcontainer.json', '.devcontainer/docker-compose.yml', "
        "'.devcontainer/setup-dev.sh')"
    )
    src = (
        "hashFiles('.opencode/plugins/**/*.ts', "
        "'.opencode/plugins/tests/**/*.test.ts', "
        "'.opencode/stryker.config.mjs', '.opencode/vitest.config.ts', "
        "'.opencode/tsconfig.json')"
    )
    # Primary key: dependency/toolchain hash then source/test hash.
    assert f"key: ${{{{ runner.os }}}}-stryker-v2-${{{{ {dep} }}}}-${{{{ {src} }}}}" in text
    # restore-keys repeats the identical dependency/toolchain expression, so
    # source-only changes warm-fall-back while dependency drift cannot cross-reuse.
    assert text.count(dep) == 2, "dep/toolchain hash must be identical in key and restore-keys"
    assert f"${{{{ runner.os }}}}-stryker-v2-${{{{ {dep} }}}}-" in text
    assert "-stryker-v1-" not in text, "v1 cache epoch must be retired"


def _hashfiles_literal_inputs(workflow_text: str) -> list[str]:
    """Return the literal (non-glob) path arguments of every hashFiles(...) call.

    Globs are skipped because their expansion cannot be asserted path-by-path; the
    literal files are what git must track for hashFiles to see them at key time.
    """
    inputs: list[str] = []
    for call in re.findall(r"hashFiles\((.*?)\)", workflow_text, re.DOTALL):
        for raw in re.findall(r"'([^']+)'", call):
            if "*" not in raw and raw not in inputs:
                inputs.append(raw)
    return inputs


def test_stryker_cache_hash_paths_are_present_not_gitignored_and_tracked() -> None:
    # hashFiles silently skips absent, ignored, or untracked paths, dropping them from
    # the key. Derive the inputs from the workflow itself so a newly added input is
    # checked too, then require each to exist, be not-ignored, and be tracked in git.
    workflow = _read_text(pathlib.Path(".github/workflows/ci.yml"))
    inputs = _hashfiles_literal_inputs(workflow)
    # Guard the parser: the dependency/toolchain and source-config inputs must all be
    # discovered, otherwise the loop below would vacuously pass on an empty list.
    expected = {
        ".opencode/bun.lock",
        ".opencode/package.json",
        ".devcontainer/devcontainer.json",
        ".devcontainer/docker-compose.yml",
        ".devcontainer/setup-dev.sh",
        ".opencode/stryker.config.mjs",
        ".opencode/vitest.config.ts",
        ".opencode/tsconfig.json",
    }
    assert expected <= set(inputs), f"hashFiles inputs not discovered: {expected - set(inputs)}"

    for rel in inputs:
        assert (REPO_ROOT / rel).exists(), f"hashed cache input missing: {rel}"
        ignored = subprocess.run(
            ["git", "check-ignore", "--quiet", rel],
            cwd=REPO_ROOT,
            check=False,
        )
        # git check-ignore exits 1 when the path is not ignored.
        assert ignored.returncode == 1, f"hashed cache input is gitignored: {rel}"
        # `git check-ignore` exits nonzero for ignored *and* for merely-untracked
        # paths, so it cannot tell them apart. A file absent from the checkout is
        # invisible to hashFiles, so require it to be in the index as well.
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", "--", rel],
            cwd=REPO_ROOT,
            check=False,
        )
        assert tracked.returncode == 0, (
            f"hashed cache input is not tracked in git: {rel} "
            "(hashFiles drops untracked paths, silently shrinking the cache key)"
        )


def test_stryker_cache_save_is_marker_gated() -> None:
    text = _read_text(pathlib.Path(".github/workflows/ci.yml"))
    # The save step must depend on the restore step's key and a deterministic host
    # marker check, not hashFiles (which cannot see the gitignored reports dir).
    assert "steps.stryker-cache.outputs.cache-primary-key != ''" in text
    assert "id: stryker-cache-marker" in text
    assert "if [ -f .opencode/reports/.stryker-cache-ok ]" in text
    assert "steps.stryker-cache-marker.outputs.present == 'true'" in text
    assert "hashFiles('.opencode/reports/.stryker-cache-ok')" not in text
    # Marker is cleared first, then written only after the non-empty + valid-JSON check.
    marker_reset = text.index('rm -f "$marker"')
    json_check = text.index("json.load")
    marker_write = text.index('echo ok > "$marker"')
    assert marker_reset < json_check < marker_write
    # No host Python setup: gates run in the DevContainer, not on the runner.
    assert "actions/setup-python" not in text


def test_bun_toolchain_pinned_not_latest() -> None:
    text = _read_text(pathlib.Path(".devcontainer/devcontainer.json"))
    match = re.search(r'features/bun:1":\s*\{\s*"version":\s*"([^"]+)"', text)
    assert match is not None, "bun feature version option not found"
    version = match.group(1)
    assert version != "latest", "bun toolchain must not float on latest"
    assert re.fullmatch(r"\d+\.\d+\.\d+", version), f"bun version not exact: {version}"
