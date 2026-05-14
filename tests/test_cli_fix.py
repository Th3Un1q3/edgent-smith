from __future__ import annotations

import os
import pathlib
import shlex
import subprocess
import textwrap
import threading
from collections import Counter
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

from click.testing import CliRunner

from cli.commands.fix import run_fix
from cli.main import cli
from cli.services.copilot_session import PERMISSIVE_TOOLSET

if TYPE_CHECKING:
    from cli.services.copilot_session import CopilotSessionService

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]

DEFAULT_QUALITY_HOOKS = [
    {
        "name": "format",
        "command": "just format",
        "remediation_prompt": (
            "Formatting failed. Find the most non breaking way to fix the issue. "
            "To re-run formatting use just format."
        ),
    },
    {
        "name": "lint",
        "command": "just lint",
        "remediation_prompt": (
            "Lint failed. Find the most non breaking way to fix the issue. "
            "To re-run lint use just lint."
        ),
    },
    {
        "name": "typecheck",
        "command": "just typecheck",
        "remediation_prompt": (
            "Type checking failed. Find the most non breaking way to fix the issue. "
            "To re-run type checking use just typecheck."
        ),
    },
    {
        "name": "test",
        "command": "just test",
        "remediation_prompt": (
            "Tests failed. Find the most non breaking way to fix the failure. "
            "Consider what caused the tests to fail, either there is an underlying "
            "error in implementation or in rare case it's a test itself tests a wrong "
            "thing. Re-run tests use `just test`."
        ),
    },
]


def _completed_process(
    args: list[str], returncode: int = 0, stdout: str = "", stderr: str = ""
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        args=args,
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


def _write_autofix_config(config_path: pathlib.Path, hooks: list[dict[str, str]]) -> None:
    lines: list[str] = []
    for hook in hooks:
        if lines:
            lines.append("")
        lines.extend(
            [
                "[[hooks]]",
                f'name = "{hook["name"]}"',
                f'command = "{hook["command"]}"',
                f'remediation_prompt = "{hook["remediation_prompt"]}"',
            ]
        )
    config_path.write_text("\n".join(lines))


def _write_project_config(config_path: pathlib.Path, *, alias: str = "copilot") -> None:
    config_path.write_text(f'name = "test-project"\nagentic_cli_alias = "{alias}"\n')


def test_just_fix_recipe_routes_to_python_cli() -> None:
    result = subprocess.run(
        ["just", "--dry-run", "fix", "--continue"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    rendered = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert "uv run python -m cli autoresearch fix --continue" in rendered
    assert "bash scripts/fix_code.sh" not in rendered


def test_fix_code_script_is_a_thin_cli_wrapper(tmp_path: pathlib.Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    capture_path = tmp_path / "uv-call.txt"
    fake_uv = fake_bin / "uv"
    fake_uv.write_text(
        textwrap.dedent(
            f"""#!/usr/bin/env bash
            set -euo pipefail
            printf '%s\n' "$PWD" > {capture_path}
            printf '%s\n' "$@" >> {capture_path}
            """
        )
    )
    fake_uv.chmod(0o755)

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "fix_code.sh"), "--continue"],
        cwd=tmp_path,
        env={"PATH": f"{fake_bin}:{os.environ['PATH']}"},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert capture_path.read_text().splitlines() == [
        str(REPO_ROOT),
        "run",
        "python",
        "-m",
        "cli",
        "autoresearch",
        "fix",
        "--continue",
    ]


def test_fix_runs_default_hooks_from_autofix_config_in_order_without_copilot(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path), patch("subprocess.run") as mock_run:
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)
        mock_run.side_effect = [
            _completed_process(["just", "format"]),
            _completed_process(["just", "lint"]),
            _completed_process(["just", "typecheck"]),
            _completed_process(["just", "test"]),
        ]

        with patch("cli.services.copilot_session.CopilotSessionService.send_message") as mock_send:
            result = runner.invoke(cli, ["autoresearch", "fix"])

    assert result.exit_code == 0
    assert result.output.index("[1/4] Running format...") < result.output.index(
        "[2/4] Running lint..."
    )
    assert result.output.index("[2/4] Running lint...") < result.output.index(
        "[3/4] Running typecheck..."
    )
    assert result.output.index("[3/4] Running typecheck...") < result.output.index(
        "[4/4] Running test..."
    )
    assert result.output.index("[4/4] Running test...") < result.output.index(
        "All autofix stages completed successfully."
    )
    assert "All autofix stages completed successfully." in result.output
    assert [call.args[0] for call in mock_run.call_args_list] == [
        ["just", "format"],
        ["just", "lint"],
        ["just", "typecheck"],
        ["just", "test"],
    ]
    mock_send.assert_not_called()


def test_fix_uses_project_config_alias_by_default_while_loading_hooks_from_autofix_config(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("test.config.toml"), alias="gh-copilot")
        _write_autofix_config(
            pathlib.Path("custom-autofix.toml"),
            [
                {
                    "name": "validate",
                    "command": "just validate",
                    "remediation_prompt": "Validation failed. Retry just validate.",
                }
            ],
        )

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                _completed_process(["just", "validate"], returncode=1, stderr="hook failed"),
                _completed_process(["just", "validate"]),
            ]

            def fake_send_message(
                session: CopilotSessionService,
                prompt: str,
                **kwargs: object,
            ) -> MagicMock:
                assert session.alias == "gh-copilot"
                assert "just validate" in prompt
                return MagicMock(is_success=True, stdout="fixed", stderr="")

            with patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
                side_effect=fake_send_message,
            ) as mock_send:
                result = runner.invoke(
                    cli,
                    ["autoresearch", "fix", "--autofix-config", "custom-autofix.toml"],
                )

    assert result.exit_code == 0
    assert [call.args[0] for call in mock_run.call_args_list] == [
        ["just", "validate"],
        ["just", "validate"],
    ]
    assert mock_send.call_count == 1


def test_fix_uses_explicit_project_config_when_config_flag_is_provided(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("aaa.config.toml"), alias="auto-discovered")
        _write_project_config(pathlib.Path("explicit.config.toml"), alias="explicit-alias")
        _write_autofix_config(
            pathlib.Path("custom-autofix.toml"),
            [
                {
                    "name": "validate",
                    "command": "just validate",
                    "remediation_prompt": "Validation failed. Retry just validate.",
                }
            ],
        )

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                _completed_process(["just", "validate"], returncode=1, stderr="hook failed"),
                _completed_process(["just", "validate"]),
            ]

            def fake_send_message(
                session: CopilotSessionService,
                prompt: str,
                **kwargs: object,
            ) -> MagicMock:
                assert session.alias == "explicit-alias"
                assert "just validate" in prompt
                return MagicMock(is_success=True, stdout="fixed", stderr="")

            with patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
                side_effect=fake_send_message,
            ) as mock_send:
                result = runner.invoke(
                    cli,
                    [
                        "autoresearch",
                        "fix",
                        "--config",
                        "explicit.config.toml",
                        "--autofix-config",
                        "custom-autofix.toml",
                    ],
                )

    assert result.exit_code == 0
    assert [call.args[0] for call in mock_run.call_args_list] == [
        ["just", "validate"],
        ["just", "validate"],
    ]
    assert mock_send.call_count == 1


def test_fix_uses_copilot_fallback_for_failed_stage_and_continues(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with (
        runner.isolated_filesystem(temp_dir=tmp_path),
        patch("subprocess.run") as mock_run,
        patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            return_value=MagicMock(is_success=True, stdout="fixed", stderr=""),
        ) as mock_send,
    ):
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)
        mock_run.side_effect = [
            _completed_process(["just", "format"]),
            _completed_process(
                ["just", "lint"],
                returncode=1,
                stdout="lint stdout",
                stderr="lint stderr",
            ),
            _completed_process(["just", "lint"]),
            _completed_process(["just", "typecheck"]),
            _completed_process(["just", "test"]),
        ]

        result = runner.invoke(cli, ["autoresearch", "fix"])

    assert result.exit_code == 0
    assert "[2/4] lint failed. Requesting remediation..." in result.output
    assert result.output.index(
        "[2/4] lint failed. Requesting remediation..."
    ) < result.output.index("[2/4] Retrying lint...")
    assert result.output.index("[2/4] Retrying lint...") < result.output.index(
        "[2/4] lint passed after remediation."
    )
    assert [call.args[0] for call in mock_run.call_args_list] == [
        ["just", "format"],
        ["just", "lint"],
        ["just", "lint"],
        ["just", "typecheck"],
        ["just", "test"],
    ]
    prompt = mock_send.call_args.args[0]
    assert "just lint" in prompt
    assert "lint stdout" in prompt
    assert "lint stderr" in prompt
    assert mock_send.call_args.kwargs["continue_session"] is False
    assert mock_send.call_args.kwargs["output_format"] == "json"


def test_fix_parallel_batches_first_pass_failures_into_single_remediation(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()
    first_pass_barrier = threading.Barrier(4)
    typecheck_finished = threading.Event()
    attempts: Counter[str] = Counter()
    first_pass_completed: list[str] = []

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)

        def fake_run_command(command: str) -> subprocess.CompletedProcess[str]:
            attempts[command] += 1
            attempt = attempts[command]

            if attempt == 1:
                first_pass_barrier.wait(timeout=1)
                if command == "just lint":
                    typecheck_finished.wait(timeout=1)
                    first_pass_completed.append(command)
                    return _completed_process(
                        ["just", "lint"],
                        returncode=1,
                        stdout="lint stdout",
                        stderr="lint stderr",
                    )
                if command == "just typecheck":
                    first_pass_completed.append(command)
                    typecheck_finished.set()
                    return _completed_process(
                        ["just", "typecheck"],
                        returncode=1,
                        stdout="type stdout",
                        stderr="type stderr",
                    )
                first_pass_completed.append(command)
                return _completed_process(shlex.split(command))

            return _completed_process(shlex.split(command))

        def fake_send_message(*args: object, **kwargs: object) -> MagicMock:
            assert attempts == Counter(
                {
                    "just format": 1,
                    "just lint": 1,
                    "just typecheck": 1,
                    "just test": 1,
                }
            )
            assert len(first_pass_completed) == 4
            return MagicMock(is_success=True, stdout="fixed", stderr="")

        with (
            patch(
                "cli.commands.fix._run_command", side_effect=fake_run_command
            ) as mock_run_command,
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                side_effect=fake_send_message,
            ) as mock_send,
        ):
            result = runner.invoke(cli, ["autoresearch", "fix", "--parallel"])

    assert result.exit_code == 0
    assert "Running first pass for 4 autofix hooks in parallel..." in result.output
    assert "[first pass 1/4] format passed." in result.output
    assert "[first pass 2/4] lint failed." in result.output
    assert "[first pass 3/4] typecheck failed." in result.output
    assert "[first pass 4/4] test passed." in result.output
    remediation_index = result.output.index("Running remediation for 2 failed hooks...")
    assert result.output.index("[first pass 2/4] lint failed.") < remediation_index
    assert result.output.index("[first pass 3/4] typecheck failed.") < remediation_index
    assert result.output.index("Running remediation for 2 failed hooks...") < result.output.index(
        "[retry 1/2] Retrying lint..."
    )
    assert result.output.index("[retry 1/2] Retrying lint...") < result.output.index(
        "[retry 2/2] Retrying typecheck..."
    )
    assert mock_run_command.call_count == 6
    assert attempts == Counter(
        {
            "just format": 1,
            "just lint": 2,
            "just typecheck": 2,
            "just test": 1,
        }
    )
    mock_send.assert_called_once()
    prompt = mock_send.call_args.args[0]
    assert prompt.index("Hook name: lint") < prompt.index("Hook name: typecheck")
    assert "Command: just lint" in prompt
    assert "Command: just typecheck" in prompt
    assert "lint stdout" in prompt
    assert "lint stderr" in prompt
    assert "type stdout" in prompt
    assert "type stderr" in prompt
    assert DEFAULT_QUALITY_HOOKS[1]["remediation_prompt"] in prompt
    assert DEFAULT_QUALITY_HOOKS[2]["remediation_prompt"] in prompt
    assert "Hook name: format" not in prompt
    assert "Hook name: test" not in prompt


def test_fix_parallel_emits_first_pass_progress_as_hooks_finish(tmp_path: pathlib.Path) -> None:
    slow_hook_ready = threading.Event()
    release_slow_hook = threading.Event()
    fast_hook_progress_seen = threading.Event()
    captured_messages: list[str] = []
    attempts: Counter[str] = Counter()
    thread_error: list[BaseException] = []

    hooks = [
        {
            "name": "lint",
            "command": "just lint",
            "remediation_prompt": "Lint failed. Retry just lint.",
        },
        {
            "name": "typecheck",
            "command": "just typecheck",
            "remediation_prompt": "Typecheck failed. Retry just typecheck.",
        },
    ]

    _write_autofix_config(tmp_path / "autofix.toml", hooks)

    def fake_run_command(command: str) -> subprocess.CompletedProcess[str]:
        attempts[command] += 1
        if attempts[command] > 1:
            return _completed_process(shlex.split(command))
        if command == "just lint":
            slow_hook_ready.set()
            release_slow_hook.wait(timeout=1)
            return _completed_process(["just", "lint"], returncode=1, stdout="lint stdout")
        if command == "just typecheck":
            return _completed_process(
                ["just", "typecheck"],
                returncode=1,
                stdout="type stdout",
            )
        raise AssertionError(f"unexpected command: {command}")

    def fake_echo(message: object | None = None, **_: object) -> None:
        rendered = "" if message is None else str(message)
        captured_messages.append(rendered)
        if rendered == "[first pass 2/2] typecheck failed.":
            fast_hook_progress_seen.set()

    with (
        patch("cli.commands.fix._run_command", side_effect=fake_run_command),
        patch(
            "cli.commands.fix.build_command_context",
            return_value=MagicMock(
                copilot_session=MagicMock(
                    send_message=MagicMock(
                        return_value=MagicMock(is_success=True, stdout="fixed", stderr="")
                    )
                )
            ),
        ),
        patch("cli.commands.fix.click.echo", side_effect=fake_echo),
    ):

        def run_fix_worker() -> None:
            try:
                run_fix(
                    str(tmp_path / "autofix.toml"),
                    config_path=None,
                    continue_session=False,
                    parallel=True,
                )
            except BaseException as exc:  # pragma: no cover - assertion-backed safety net
                thread_error.append(exc)

        worker = threading.Thread(
            target=run_fix_worker,
        )
        worker.start()

        assert slow_hook_ready.wait(timeout=1)
        assert fast_hook_progress_seen.wait(timeout=0.2)

        release_slow_hook.set()
        worker.join(timeout=1)

    assert not worker.is_alive()
    assert thread_error == []
    assert captured_messages[0] == "Running first pass for 2 autofix hooks in parallel..."
    assert "[first pass 2/2] typecheck failed." in captured_messages


def test_fix_parallel_skips_copilot_when_first_pass_succeeds(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with (
        runner.isolated_filesystem(temp_dir=tmp_path),
        patch("subprocess.run") as mock_run,
        patch("cli.services.copilot_session.CopilotSessionService.send_message") as mock_send,
    ):
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)
        mock_run.side_effect = [
            _completed_process(["just", "format"]),
            _completed_process(["just", "lint"]),
            _completed_process(["just", "typecheck"]),
            _completed_process(["just", "test"]),
        ]

        result = runner.invoke(cli, ["autoresearch", "fix", "--parallel"])

    assert result.exit_code == 0
    assert "All autofix stages completed successfully." in result.output
    mock_send.assert_not_called()


def test_fix_parallel_reports_remaining_failures_in_config_order_after_single_retry(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with (
        runner.isolated_filesystem(temp_dir=tmp_path),
        patch("subprocess.run") as mock_run,
        patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            return_value=MagicMock(is_success=True, stdout="fixed", stderr=""),
        ) as mock_send,
    ):
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)
        mock_run.side_effect = [
            _completed_process(["just", "format"]),
            _completed_process(["just", "lint"], returncode=1, stdout="lint stdout"),
            _completed_process(["just", "typecheck"], returncode=1, stdout="type stdout"),
            _completed_process(["just", "test"]),
            _completed_process(["just", "lint"], returncode=1, stdout="lint retry stdout"),
            _completed_process(
                ["just", "typecheck"],
                returncode=1,
                stdout="type retry stdout",
            ),
        ]

        result = runner.invoke(cli, ["autoresearch", "fix", "--parallel"])

    assert result.exit_code != 0
    mock_send.assert_called_once()
    assert "Autofix steps still failed after remediation:" in result.output
    assert result.output.index("- lint") < result.output.index("- typecheck")
    assert "lint retry stdout" in result.output
    assert "type retry stdout" in result.output


def test_fix_continue_reuses_same_service_across_fallback_turns(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()
    fake_copilot_session = MagicMock()
    fake_copilot_session.send_message.return_value = MagicMock(
        is_success=True,
        stdout="fixed",
        stderr="",
    )

    with (
        runner.isolated_filesystem(temp_dir=tmp_path),
        patch("subprocess.run") as mock_run,
        patch(
            "cli.commands.fix.build_command_context",
            return_value=MagicMock(copilot_session=fake_copilot_session),
        ) as mock_build_command_context,
    ):
        _write_autofix_config(pathlib.Path("autofix.toml"), DEFAULT_QUALITY_HOOKS)
        mock_run.side_effect = [
            _completed_process(["just", "format"]),
            _completed_process(["just", "lint"], returncode=1, stdout="lint stdout"),
            _completed_process(["just", "lint"]),
            _completed_process(["just", "typecheck"], returncode=1, stdout="type stdout"),
            _completed_process(["just", "typecheck"]),
            _completed_process(["just", "test"]),
        ]

        result = runner.invoke(cli, ["autoresearch", "fix", "--continue"])

    assert result.exit_code == 0
    mock_build_command_context.assert_called_once_with(
        config_path=None,
        required=False,
        model="gpt-5-mini",
        toolset=PERMISSIVE_TOOLSET,
    )
    assert fake_copilot_session.send_message.call_count == 2
    assert fake_copilot_session.send_message.call_args_list[0].kwargs["continue_session"] is True
    assert fake_copilot_session.send_message.call_args_list[1].kwargs["continue_session"] is False
    assert fake_copilot_session.send_message.call_args_list[0].kwargs["output_format"] == "json"
    assert fake_copilot_session.send_message.call_args_list[1].kwargs["output_format"] == "json"


def test_fix_runs_only_configured_hooks_from_toml_config(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with (
        runner.isolated_filesystem(temp_dir=tmp_path),
        patch("subprocess.run") as mock_run,
        patch("cli.services.copilot_session.CopilotSessionService.send_message") as mock_send,
    ):
        _write_autofix_config(
            pathlib.Path("autofix.toml"),
            [
                {
                    "name": "smoke",
                    "command": "just validate",
                    "remediation_prompt": "Validation failed.",
                }
            ],
        )

        mock_run.side_effect = [
            _completed_process(["just", "validate"]),
        ]

        result = runner.invoke(cli, ["autoresearch", "fix"])

    assert result.exit_code == 0
    assert [call.args[0] for call in mock_run.call_args_list] == [
        ["just", "validate"],
    ]
    mock_send.assert_not_called()


def test_fix_builds_hook_failure_prompt_from_configured_remediation_text(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_autofix_config(
            pathlib.Path("custom-autofix.toml"),
            [
                {
                    "name": "smoke",
                    "command": "just validate",
                    "remediation_prompt": (
                        "Validation failed. Review ${hook_stdout} and retry just validate."
                    ),
                }
            ],
        )

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                _completed_process(
                    ["just", "validate"],
                    returncode=1,
                    stdout="hook stdout",
                    stderr="hook stderr",
                ),
                _completed_process(["just", "validate"]),
            ]

            with patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                return_value=MagicMock(is_success=True, stdout="fixed", stderr=""),
            ) as mock_send:
                result = runner.invoke(
                    cli,
                    ["autoresearch", "fix", "--autofix-config", "custom-autofix.toml"],
                )

    assert result.exit_code == 0
    prompt = mock_send.call_args.args[0]
    assert "Validation failed." in prompt
    assert "hook stdout" in prompt
    assert "hook stderr" in prompt
    assert "just validate" in prompt


def test_fix_notifies_when_autofix_config_is_missing(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path), patch("subprocess.run") as mock_run:
        result = runner.invoke(
            cli,
            ["autoresearch", "fix", "--autofix-config", "missing.toml"],
        )

    assert result.exit_code == 0
    assert "No autofix hooks are configured in missing.toml." in result.output
    assert (
        "Add one or more [[hooks]] entries to missing.toml or pass --autofix-config <path>."
        in result.output
    )
    mock_run.assert_not_called()


def test_fix_notifies_when_autofix_config_has_no_hooks(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path), patch("subprocess.run") as mock_run:
        pathlib.Path("empty.toml").write_text("", encoding="utf-8")

        result = runner.invoke(
            cli,
            ["autoresearch", "fix", "--autofix-config", "empty.toml"],
        )

    assert result.exit_code == 0
    assert "No autofix hooks are configured in empty.toml." in result.output
    assert (
        "Add one or more [[hooks]] entries to empty.toml or pass --autofix-config <path>."
        in result.output
    )
    mock_run.assert_not_called()


def test_fix_fails_clearly_for_invalid_hook_config(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        pathlib.Path("bad.toml").write_text(
            "\n".join(
                [
                    "[[hooks]]",
                    'name = "broken"',
                    'remediation_prompt = "Missing command."',
                ]
            )
        )

        with patch("subprocess.run") as mock_run:
            result = runner.invoke(cli, ["autoresearch", "fix", "--autofix-config", "bad.toml"])

    assert result.exit_code != 0
    assert "Error: Invalid autofix config" in result.output
    mock_run.assert_not_called()
