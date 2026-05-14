from __future__ import annotations

import json
import pathlib
import re
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import click
import pytest
from click.testing import CliRunner

from cli.commands import validate as validate_command
from cli.main import cli

if TYPE_CHECKING:
    from cli.services.copilot_session import CopilotSessionService


def test_send_validation_message_requests_json_output_and_returns_the_session_result() -> None:
    fake_copilot_session = MagicMock()
    expected_result = MagicMock(is_success=True, stdout="stored", stderr="")
    fake_copilot_session.send_message.return_value = expected_result

    actual_result = validate_command._send_validation_message(
        fake_copilot_session,
        'My pet is called "secret". do nothing for now.',
        failure_prefix="First message failed",
    )

    assert actual_result is expected_result
    fake_copilot_session.send_message.assert_called_once_with(
        'My pet is called "secret". do nothing for now.',
        output_format="json",
    )


def test_send_validation_message_raises_a_step_specific_click_exception_on_failure() -> None:
    fake_copilot_session = MagicMock()
    fake_copilot_session.send_message.return_value = MagicMock(
        is_success=False,
        stdout="",
        stderr="copilot unavailable",
    )

    with pytest.raises(click.ClickException, match="First message failed: copilot unavailable"):
        validate_command._send_validation_message(
            fake_copilot_session,
            "what's the name of my pet?",
            failure_prefix="First message failed",
        )


def test_validate_uses_auto_discovery_by_default_and_accepts_explicit_config_override(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        with open("aaa.config.toml", "w") as f:
            f.write('name = "auto-project"\n')
            f.write('agentic_cli_alias = "auto-discovered"\n')

        with open("explicit.config.toml", "w") as f:
            f.write('name = "explicit-project"\n')
            f.write('agentic_cli_alias = "explicit-alias"\n')

        aliases_seen: list[str] = []
        models_seen: list[str] = []
        allow_all_seen: list[bool] = []
        agents_seen: list[str | None] = []
        state: dict[str, str | None] = {"secret": None}

        def fake_send_message(
            service: CopilotSessionService,
            prompt: str,
            **kwargs: object,
        ) -> MagicMock:
            if 'My pet is called "' in prompt:
                aliases_seen.append(service.alias)
                models_seen.append(service.model)
                allow_all_seen.append(service.toolset.allow_all)
                agents_seen.append(service.agent)
                match = re.search(r'My pet is called "([^"]+)"', prompt)
                assert match is not None
                state["secret"] = match.group(1)
                return MagicMock(is_success=True, stdout="stored", stderr="")

            if "what's the name of my pet?" in prompt:
                secret = state["secret"] or "unknown"
                return MagicMock(
                    is_success=True,
                    stdout=f"Your pet is called {secret}",
                    stderr="",
                )

            raise AssertionError(f"Unexpected prompt: {prompt}")

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
            side_effect=fake_send_message,
        ):
            fallback_result = runner.invoke(cli, ["autoresearch", "validate"])
            explicit_result = runner.invoke(
                cli,
                ["autoresearch", "validate", "--config", "explicit.config.toml"],
            )

    assert fallback_result.exit_code == 0
    assert explicit_result.exit_code == 0
    assert aliases_seen == ["auto-discovered", "explicit-alias"]
    assert models_seen == ["gpt-5-mini", "gpt-5-mini"]
    assert allow_all_seen == [False, False]
    assert agents_seen == [None, None]


def test_validate_success(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        # Create a mock config
        with open("test.config.toml", "w") as f:
            f.write('name = "test-project"\n')
            f.write('agentic_cli_alias = "copilot"\n')

        # Shared state for the mock
        state: dict[str, str | None] = {"secret": None}

        def mock_side_effect(cmd: list[str], **kwargs: object) -> MagicMock:
            prompt = ""
            for i, arg in enumerate(cmd):
                if arg == "--prompt" or arg == "-p":
                    prompt = cmd[i + 1]
                    break

            # If it's the first message, capture the secret
            match = re.search(r'My pet is called "([^"]+)"', prompt)
            if match:
                state["secret"] = match.group(1)
                return MagicMock(
                    stdout=json.dumps({"type": "result", "sessionId": "s1"}),
                    stderr="",
                    returncode=0,
                )

            # If it's the second message, return the captured secret
            if "what's the name of my pet?" in prompt:
                secret = state["secret"] or "unknown"
                res = (
                    json.dumps(
                        {
                            "type": "assistant.message",
                            "data": {"content": f"Your pet is called {secret}"},
                        }
                    )
                    + "\n"
                    + json.dumps({"type": "result", "sessionId": "s1"})
                )
                return MagicMock(stdout=res, stderr="", returncode=0)

            return MagicMock(
                stdout=json.dumps({"type": "result", "sessionId": "s1"}), stderr="", returncode=0
            )

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = mock_side_effect

            result = runner.invoke(cli, ["autoresearch", "validate"])

            assert result.exit_code == 0
            assert "Validation successful" in result.output
            assert mock_run.call_count == 2

            # Verify session ID was passed to second call as --resume
            args2 = mock_run.call_args_list[1][0][0]
            assert "--resume=s1" in args2


def test_validate_no_config(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()
    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "validate"])
        assert result.exit_code != 0
        assert "No .config.toml file found" in result.output
        assert "Pass --config PATH" in result.output
