"""Pin AIDLC provisioning in setup-dev.sh, devcontainer.json, .gitignore and AGENTS.md,
and prove the projection is installed and wired into the opencode harness."""

from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
SETUP_SCRIPT = REPO_ROOT / ".devcontainer" / "setup-dev.sh"
DEVCONTAINER_CONFIG = REPO_ROOT / ".devcontainer" / "devcontainer.json"
GITIGNORE = REPO_ROOT / ".gitignore"
AGENTS_DOC = REPO_ROOT / "AGENTS.md"
OPENCODE_CONFIG = REPO_ROOT / "opencode.jsonc"
OPENCODE_AGENTS_DIR = REPO_ROOT / ".opencode" / "agents"
OPENCODE_COMMAND = REPO_ROOT / ".opencode" / "command" / "aidlc.md"
OPENCODE_PLUGIN = REPO_ROOT / ".opencode" / "plugin" / "aidlc-opencode-adapter.ts"
AIDLC_HOOKS_DIR = REPO_ROOT / ".aidlc" / "hooks"
AIDLC_ORG_MEMORY = REPO_ROOT / "aidlc" / "spaces" / "default" / "memory" / "org.md"
QUALITY_GATES_PLUGIN = REPO_ROOT / "aidlc-plugins" / "quality-gates"
QUALITY_GATES_MANIFESTS = (
    QUALITY_GATES_PLUGIN / ".aidlc-plugin" / "plugin.json",
    QUALITY_GATES_PLUGIN / ".opencode-plugin" / "plugin.json",
)
HARNESS_GATES_SENSOR = QUALITY_GATES_PLUGIN / "sensors" / "aidlc-harness-gates.md"
HARNESS_GATES_OVERLAY = (
    QUALITY_GATES_PLUGIN / "contributions" / "construction" / "build-and-test.md"
)
HARNESS_GATES_TOOL = QUALITY_GATES_PLUGIN / "tools" / "aidlc-sensor-harness-gates.ts"
HARNESS_CONFIG = REPO_ROOT / ".opencode" / "plugins" / "config" / "harness.config.ts"
HARNESS_CONFIG_REL = ".opencode/plugins/config/harness.config.ts"

AIDLC_LOCAL_BIN = "/home/vscode/.local/bin"
AIDLC_INSTALL_URL = "https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh"
AIDLC_LOCAL_SETTINGS = ("aidlc.settings.local.json", ".aidlc/settings.local.json")
AIDLC_TRACKED_PATHS = (".aidlc", "aidlc", ".aidlc/settings.json", "aidlc/config.yml")
AIDLC_PINNED_VERSION = "2.11.3"
AIDLC_EXPECTED_AGENT_COUNT = 14
AIDLC_AGENTS_BEGIN = "<!-- BEGIN AI-DLC:agents -->"
AIDLC_AGENTS_END = "<!-- END AI-DLC:agents -->"
AIDLC_GITIGNORE_BEGIN = "# BEGIN AI-DLC:gitignore"
AIDLC_GITIGNORE_END = "# END AI-DLC:gitignore"
AIDLC_WHOLE_TREE_PATTERNS = (
    ".aidlc",
    ".aidlc/",
    "/.aidlc",
    "/.aidlc/",
    ".aidlc/**",
    "aidlc",
    "aidlc/",
    "/aidlc",
    "/aidlc/",
    "aidlc/**",
)


def _write_executable(path: pathlib.Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)


def _first_line(lines: list[str], needle: str) -> int:
    return next(index for index, line in enumerate(lines) if needle in line)


def _aidlc_guard_snippet() -> list[str]:
    """Return the aidlc install guard from setup-dev.sh, with its indentation intact."""
    lines = SETUP_SCRIPT.read_text(encoding="utf-8").splitlines()
    start = _first_line(lines, "AIDLC_INSTALL_URL=")
    end = next(index for index in range(start, len(lines)) if lines[index] == "  fi")
    return lines[start : end + 1]


def _is_ignored(path: str) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "--no-index", "--quiet", "--", path],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        msg = f"git check-ignore failed for {path}: {result.stderr.strip()}"
        raise AssertionError(msg)
    return result.returncode == 0


def _run_aidlc_guard(
    tmp_path: pathlib.Path,
    *,
    version: str,
    installer_exit: int = 0,
    aidlc_on_path: bool = False,
) -> tuple[subprocess.CompletedProcess[str], pathlib.Path]:
    """Run the guard with a stub curl that records the args the installer receives."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    argv_log = tmp_path / "installer-argv.log"

    installer = "".join(
        [
            "#!/usr/bin/env bash\n",
            'printf "argc=%s\\n" "$#" >> "$AIDLC_TEST_ARGV_LOG"\n',
            'for argument in "$@"; do\n',
            '  printf "argv=%s\\n" "$argument" >> "$AIDLC_TEST_ARGV_LOG"\n',
            "done\n",
        ]
    )
    # A failing curl after the body proves the WARNING path; failing curl alone
    # would leave the installer unrun and the non-fatal branch untested.
    if installer_exit:
        curl_stub = f"#!/usr/bin/env bash\nexit {installer_exit}\n"
    else:
        curl_stub = "#!/usr/bin/env bash\ncat <<'INSTALLER'\n" + installer + "INSTALLER\n"
    _write_executable(bin_dir / "curl", curl_stub)
    if aidlc_on_path:
        _write_executable(bin_dir / "aidlc", "#!/usr/bin/env bash\nexit 0\n")

    script = "\n".join(
        [
            "set -euo pipefail",
            f'export PATH="{bin_dir}:/usr/bin:/bin"',
            f'export AIDLC_TEST_ARGV_LOG="{argv_log}"',
            *_aidlc_guard_snippet(),
        ]
    )
    runner = tmp_path / "run-guard.sh"
    runner.write_text(script + "\n", encoding="utf-8")

    env = {key: value for key, value in os.environ.items() if key != "AIDLC_VERSION"}
    env["AIDLC_VERSION"] = version
    result = subprocess.run(
        [shutil.which("bash") or "bash", str(runner)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    return result, argv_log


def _aidlc_projection_snippet() -> list[str]:
    """Return the aidlc projection block from setup-dev.sh, with its indentation intact."""
    lines = SETUP_SCRIPT.read_text(encoding="utf-8").splitlines()
    start = _first_line(lines, 'AIDLC_ROOT="$(cd')
    end = next(index for index in range(start + 1, len(lines)) if lines[index] == "  fi")
    return lines[start : end + 1]


def _run_aidlc_projection(
    tmp_path: pathlib.Path,
    *,
    config_exit: int = 0,
    doctor_exit: int = 0,
) -> tuple[subprocess.CompletedProcess[str], pathlib.Path]:
    """Run the projection block with stub timeout/aidlc recording argv, cwd and stdin."""
    project = tmp_path / "project"
    (project / ".devcontainer").mkdir(parents=True)
    caller_cwd = tmp_path / "elsewhere"
    caller_cwd.mkdir()
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "aidlc-calls.log"

    _write_executable(
        bin_dir / "timeout",
        '#!/usr/bin/env bash\nprintf "timeout=%s\\n" "$1" >> "$AIDLC_TEST_LOG"\nshift\nexec "$@"\n',
    )
    # stdin carries one line, so dropping </dev/null from the projection call shows
    # up as stdin=nonempty instead of the EOF that /dev/null produces.
    _write_executable(
        bin_dir / "aidlc",
        "#!/usr/bin/env bash\n"
        'printf "aidlc=%s cwd=%s\\n" "$*" "$PWD" >> "$AIDLC_TEST_LOG"\n'
        'if read -r _; then echo "stdin=nonempty" >> "$AIDLC_TEST_LOG"; '
        'else echo "stdin=eof" >> "$AIDLC_TEST_LOG"; fi\n'
        'case "$1" in\n'
        f"  config) exit {config_exit} ;;\n"
        f"  doctor) exit {doctor_exit} ;;\n"
        "esac\n"
        "exit 1\n",
    )

    script = "\n".join(
        [
            "set -euo pipefail",
            f'export PATH="{bin_dir}:/usr/bin:/bin"',
            f'export AIDLC_TEST_LOG="{log}"',
            *_aidlc_projection_snippet(),
        ]
    )
    runner = project / ".devcontainer" / "run-projection.sh"
    runner.write_text(script + "\n", encoding="utf-8")

    env = {key: value for key, value in os.environ.items() if key != "AIDLC_VERSION"}
    result = subprocess.run(
        [shutil.which("bash") or "bash", str(runner)],
        capture_output=True,
        text=True,
        cwd=caller_cwd,
        env=env,
        input="interactive-answer\n",
        check=False,
    )
    return result, log


def _run_version_script(runner: pathlib.Path, version: str | None) -> str:
    env = {key: value for key, value in os.environ.items() if key != "AIDLC_VERSION"}
    if version is not None:
        env["AIDLC_VERSION"] = version
    result = subprocess.run(
        [shutil.which("bash") or "bash", str(runner)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def _managed_block(path: pathlib.Path, begin: str, end: str) -> tuple[int, int]:
    lines = path.read_text(encoding="utf-8").splitlines()
    starts = [index for index, line in enumerate(lines) if line.strip() == begin]
    ends = [index for index, line in enumerate(lines) if line.strip() == end]
    assert len(starts) == 1, f"{path.name} must hold exactly one {begin!r}, found {len(starts)}"
    assert len(ends) == 1, f"{path.name} must hold exactly one {end!r}, found {len(ends)}"
    return starts[0], ends[0]


def _strip_jsonc(text: str) -> str:
    """Remove // comments and trailing commas without touching string contents."""
    return _strip_trailing_commas(_strip_jsonc_comments(text))


def _strip_jsonc_comments(text: str) -> str:
    """Drop // comments while leaving string contents untouched."""
    kept: list[str] = []
    in_string = False
    escaped = False
    index = 0
    while index < len(text):
        char = text[index]
        if in_string:
            kept.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            kept.append(char)
            index += 1
            continue
        if text.startswith("//", index):
            newline = text.find("\n", index)
            index = len(text) if newline == -1 else newline
            continue
        kept.append(char)
        index += 1
    return "".join(kept)


def _strip_trailing_commas(text: str) -> str:
    """Drop commas that precede a closing brace or bracket outside strings."""
    kept: list[str] = []
    in_string = False
    escaped = False
    for position, char in enumerate(text):
        if in_string:
            kept.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            kept.append(char)
            continue
        if char == "," and _closes_container(text, position):
            continue
        kept.append(char)
    return "".join(kept)


def _closes_container(text: str, comma: int) -> bool:
    lookahead = comma + 1
    while lookahead < len(text) and text[lookahead].isspace():
        lookahead += 1
    return lookahead < len(text) and text[lookahead] in "}]"


def test_aidlc_install_guard_sits_inside_non_fast_block() -> None:
    lines = SETUP_SCRIPT.read_text(encoding="utf-8").splitlines()
    fast_start = _first_line(lines, 'if [[ "$FAST_MODE" == false ]]; then')
    fast_end = next(index for index in range(fast_start + 1, len(lines)) if lines[index] == "fi")
    guard = _first_line(lines, "if ! command -v aidlc")
    path_export = _first_line(lines, f'export PATH="{AIDLC_LOCAL_BIN}:$PATH"')
    url_assignment = _first_line(lines, "AIDLC_INSTALL_URL=")

    assert path_export < guard, "the aidlc bin dir must be on PATH before the presence check"
    assert fast_start < url_assignment < guard < fast_end, (
        "the aidlc install must stay inside the non-fast block"
    )
    assert lines[guard].startswith("  if !"), "the install must be nested under the block guard"
    assert AIDLC_INSTALL_URL in "\n".join(lines[url_assignment:fast_end])


def test_existing_aidlc_binary_skips_the_installer(tmp_path: pathlib.Path) -> None:
    result, argv_log = _run_aidlc_guard(tmp_path, version="", aidlc_on_path=True)

    assert result.returncode == 0, result.stderr
    assert not argv_log.exists(), "the installer must not run when aidlc is already present"
    assert "Installing aidlc" not in result.stdout


@pytest.mark.parametrize(
    ("version", "expected_args"),
    [
        ("", ["--version", AIDLC_PINNED_VERSION]),
        (AIDLC_PINNED_VERSION, ["--version", AIDLC_PINNED_VERSION]),
    ],
    ids=["empty-version-falls-back-to-pin", "pinned-version"],
)
def test_aidlc_version_reaches_the_installer_as_the_resolved_pin(
    tmp_path: pathlib.Path,
    version: str,
    expected_args: list[str],
) -> None:
    result, argv_log = _run_aidlc_guard(tmp_path, version=version)

    assert result.returncode == 0, result.stderr
    recorded = argv_log.read_text(encoding="utf-8").splitlines()
    expected = [f"argc={len(expected_args)}", *(f"argv={arg}" for arg in expected_args)]
    assert recorded == expected


def test_aidlc_install_failure_is_non_fatal(tmp_path: pathlib.Path) -> None:
    result, _ = _run_aidlc_guard(tmp_path, version="", installer_exit=1)

    assert result.returncode == 0, result.stderr
    assert "WARNING: aidlc install failed" in result.stdout


def test_devcontainer_path_exposes_aidlc_install_directory() -> None:
    config = json.loads(DEVCONTAINER_CONFIG.read_text(encoding="utf-8"))

    path_entries = config["containerEnv"]["PATH"].split(":")
    assert AIDLC_LOCAL_BIN in path_entries
    assert path_entries[0] == AIDLC_LOCAL_BIN


def test_gitignore_ignores_only_local_aidlc_settings() -> None:
    patterns = GITIGNORE.read_text(encoding="utf-8").splitlines()

    for pattern in AIDLC_LOCAL_SETTINGS:
        assert f"/{pattern}" in patterns
        assert _is_ignored(pattern), f"{pattern} must be ignored"
    for tracked in AIDLC_TRACKED_PATHS:
        assert not _is_ignored(tracked), f"{tracked} must stay tracked"


def test_agents_md_documents_aidlc_commands() -> None:
    text = AGENTS_DOC.read_text(encoding="utf-8")

    assert "`aidlc config --harness opencode`" in text
    assert "`aidlc doctor`" in text


def test_aidlc_cli_reports_a_version() -> None:
    executable = shutil.which("aidlc")
    if executable is None:
        pytest.skip("aidlc is not installed in this environment")

    result = subprocess.run(
        [executable, "--version"],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip(), "aidlc --version printed an empty version"


def test_setup_dev_pins_aidlc_version_and_honours_the_override(tmp_path: pathlib.Path) -> None:
    version_line = next(
        line.strip() for line in _aidlc_guard_snippet() if line.strip().startswith("AIDLC_VERSION=")
    )
    runner = tmp_path / "run-version.sh"
    runner.write_text(
        f'set -euo pipefail\n{version_line}\nprintf "%s\\n" "$AIDLC_VERSION"\n',
        encoding="utf-8",
    )

    assert _run_version_script(runner, None) == AIDLC_PINNED_VERSION
    assert _run_version_script(runner, "9.9.9") == "9.9.9"


def test_aidlc_projection_and_doctor_warnings_never_abort_setup(
    tmp_path: pathlib.Path,
) -> None:
    result, log = _run_aidlc_projection(tmp_path, config_exit=1, doctor_exit=1)

    assert result.returncode == 0, result.stderr
    assert "WARNING: aidlc projection failed; harness wiring may be stale" in result.stdout
    assert "WARNING: aidlc doctor exited non-zero (advisory; setup continues)" in result.stdout
    calls = log.read_text(encoding="utf-8").splitlines()
    assert len(calls) == 6, calls
    assert re.fullmatch(r"timeout=\d+", calls[0])
    assert calls[1] == f"aidlc=config --harness opencode --yes cwd={tmp_path / 'project'}"
    assert calls[2] == "stdin=eof", "the projection must read stdin from /dev/null"
    assert re.fullmatch(r"timeout=\d+", calls[3])
    assert calls[4] == f"aidlc=doctor --no-color cwd={tmp_path / 'project'}"
    assert calls[5] == "stdin=nonempty", "doctor must run after a failed projection"


def test_aidlc_projection_and_doctor_report_success(tmp_path: pathlib.Path) -> None:
    result, _ = _run_aidlc_projection(tmp_path)

    assert result.returncode == 0, result.stderr
    assert "aidlc projection refreshed" in result.stdout
    assert "aidlc doctor: exit 0" in result.stdout
    assert "WARNING" not in result.stdout


def test_projection_installs_engine_hooks_and_workspace_memory() -> None:
    hooks = sorted(AIDLC_HOOKS_DIR.glob("aidlc-*.ts"))

    assert hooks, f"{AIDLC_HOOKS_DIR} must hold the projected aidlc-*.ts hooks"
    assert AIDLC_ORG_MEMORY.is_file()
    assert AIDLC_ORG_MEMORY.stat().st_size > 0


def test_projection_wires_subagents_command_and_plugin() -> None:
    agents = sorted(OPENCODE_AGENTS_DIR.glob("aidlc-*-agent.md"))

    assert len(agents) == AIDLC_EXPECTED_AGENT_COUNT, [path.name for path in agents]
    for agent in agents:
        assert "mode: subagent" in agent.read_text(encoding="utf-8").splitlines(), agent.name
    assert OPENCODE_COMMAND.is_file()

    plugin = OPENCODE_PLUGIN.read_text(encoding="utf-8")
    assert "export default" in plugin
    assert re.search(r"^\s*async setup\(", plugin, flags=re.MULTILINE)
    assert re.search(r"^\s*server:", plugin, flags=re.MULTILINE)


def test_opencode_config_registers_the_aidlc_skills_path() -> None:
    config = json.loads(_strip_jsonc(OPENCODE_CONFIG.read_text(encoding="utf-8")))

    assert ".aidlc/skills" in config["skills"]["paths"]
    assert not (REPO_ROOT / "opencode.json").exists(), (
        "opencode.json must not shadow the jsonc config"
    )


def test_agents_doc_holds_one_aidlc_managed_block() -> None:
    start, end = _managed_block(AGENTS_DOC, AIDLC_AGENTS_BEGIN, AIDLC_AGENTS_END)

    assert start < end


def test_gitignore_managed_block_keeps_the_aidlc_scaffold_tracked() -> None:
    start, end = _managed_block(GITIGNORE, AIDLC_GITIGNORE_BEGIN, AIDLC_GITIGNORE_END)
    lines = GITIGNORE.read_text(encoding="utf-8").splitlines()
    entries = [line.strip() for line in lines[start + 1 : end]]

    assert not [entry for entry in entries if entry in AIDLC_WHOLE_TREE_PATTERNS]
    assert not _is_ignored(".aidlc/hooks/aidlc-session-start.ts")
    assert not _is_ignored("aidlc/spaces/default/memory/org.md")


def test_aidlc_doctor_reports_a_healthy_projection() -> None:
    executable = shutil.which("aidlc")
    if executable is None:
        pytest.skip("aidlc is not installed in this environment")

    result = subprocess.run(
        [executable, "doctor", "--no-color"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )

    assert result.returncode == 0, (result.stdout + result.stderr).strip()


def _frontmatter_lines(path: pathlib.Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines[:1] == ["---"], f"{path.name} must open with a YAML frontmatter fence"
    return lines[1 : lines.index("---", 1)]


def _frontmatter_fields(path: pathlib.Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in _frontmatter_lines(path):
        key, separator, value = line.partition(":")
        if separator and key and key == key.strip() and (not value or value[:1] == " "):
            fields[key] = value.strip().strip('"')
    return fields


def test_quality_gates_plugin_declares_matching_twin_manifests() -> None:
    aidlc_manifest, opencode_manifest = (
        json.loads(path.read_text(encoding="utf-8")) for path in QUALITY_GATES_MANIFESTS
    )

    assert aidlc_manifest["name"] == "quality-gates", (
        "the .aidlc manifest name must equal the plugin root, or the build validator rejects it"
    )
    assert aidlc_manifest["aidlc"]["contributes"]["sensors"] == "sensors/"
    for manifest in (aidlc_manifest, opencode_manifest):
        assert manifest["version"].strip()
        assert manifest["description"].strip()


def test_harness_gates_sensor_manifest_matches_its_filename_and_schema() -> None:
    fields = _frontmatter_fields(HARNESS_GATES_SENSOR)

    assert {"id", "kind", "command", "matches", "timeout_seconds", "input_schema"} <= set(fields)
    assert HARNESS_GATES_SENSOR.stem == f"aidlc-{fields['id']}" == "aidlc-harness-gates"
    assert fields["kind"] == "deterministic"
    assert "aidlc-sensor-harness-gates.ts" in fields["command"]
    assert fields["matches"] == "**/*"
    assert int(fields["timeout_seconds"]) > 0


def test_build_and_test_overlay_attaches_the_harness_gates_sensor() -> None:
    fields = _frontmatter_fields(HARNESS_GATES_OVERLAY)
    lines = _frontmatter_lines(HARNESS_GATES_OVERLAY)

    assert fields["target"] == "build-and-test"
    assert "  sensors:" in lines, "the overlay must contribute a sensors list under adds:"
    start = lines.index("  sensors:")
    entries = [
        line.strip().removeprefix("- ")
        for line in lines[start + 1 :]
        if line.startswith("    ") and line.strip()
    ]
    assert entries == ["harness-gates"]


def test_sensor_tool_exports_main_and_guards_its_top_level_run() -> None:
    text = HARNESS_GATES_TOOL.read_text(encoding="utf-8")

    assert re.search(r"^export function main\(argv", text, flags=re.MULTILINE), (
        "the sensor worker imports main(argv); a missing export made every fire could-not-run"
    )
    assert not [line for line in text.splitlines() if re.match(r"^main\(", line)], (
        "a bare top-level main(...) call runs the gates on import and again on every fire"
    )
    invocations = [line for line in text.splitlines() if "main(process.argv" in line]
    assert invocations, "the tool must still run when executed as a script"
    assert all(line.startswith("if ") for line in invocations)
    assert "import.meta" in text


def test_setup_dev_rebuilds_syncs_and_selects_the_quality_gates_plugin() -> None:
    lines = SETUP_SCRIPT.read_text(encoding="utf-8").splitlines()
    fast_start = _first_line(lines, 'if [[ "$FAST_MODE" == false ]]; then')
    fast_end = next(index for index in range(fast_start + 1, len(lines)) if lines[index] == "fi")
    section_start = _first_line(
        lines, 'QUALITY_GATES_ROOT="$AIDLC_ROOT/aidlc-plugins/quality-gates"'
    )
    section = lines[section_start:fast_end]

    assert fast_start < section_start < fast_end, "plugin wiring must sit inside the non-fast block"
    for step in (
        ".aidlc/tools/aidlc-plugin-build.ts aidlc-plugins/quality-gates opencode",
        'aidlc engine plugin sync --plugin-root "$QUALITY_GATES_ROOT/dist/opencode"',
        "aidlc engine plugin select aidlc quality-gates",
    ):
        assert any(step in line for line in section), f"setup-dev.sh must run {step!r}"
    for warning in (
        "WARNING: quality-gate plugin build failed",
        "WARNING: aidlc plugin sync failed",
        "WARNING: aidlc plugin select failed",
    ):
        assert any(warning in line for line in section), f"{warning!r} must keep the step advisory"
    assert not [line for line in section if re.search(r"\b(?:exit|return) [1-9]", line)]
    assert "quality-gate sensors enabled" in "\n".join(section)


def test_sensor_tool_reads_gate_commands_from_the_harness_config() -> None:
    text = HARNESS_GATES_TOOL.read_text(encoding="utf-8")

    assert HARNESS_CONFIG.is_file()
    assert HARNESS_CONFIG_REL in text, "the tool must resolve the repo's gate config"
    assert "harnessConfig" in text
    assert "quality-gate-enforcer" in text
    for command in ("just lint", "just test", "just typecheck"):
        assert command not in text, f"the sensor must read {command!r}, not duplicate it"
