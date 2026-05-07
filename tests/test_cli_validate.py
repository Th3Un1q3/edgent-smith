from __future__ import annotations

import json
import re
from unittest.mock import MagicMock, patch

from click.testing import CliRunner

from cli.main import cli


def test_validate_success(tmp_path: any) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        # Create a mock config
        with open("test.config.toml", "w") as f:
            f.write('name = "test-project"\n')
            f.write('agentic_cli_alias = "copilot"\n')

        # Shared state for the mock
        state = {"secret": None}

        def mock_side_effect(cmd, **kwargs):
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


def test_validate_no_config(tmp_path: any) -> None:
    runner = CliRunner()
    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "validate"])
        assert result.exit_code != 0
        assert "No .config.toml file found" in result.output
