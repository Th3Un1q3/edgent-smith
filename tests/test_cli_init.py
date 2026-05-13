from __future__ import annotations

import pathlib
from unittest.mock import MagicMock, patch

from click.testing import CliRunner

from cli.main import cli


@patch("cli.commands.init.CopilotSessionService")
@patch("cli.commands.init.subprocess.run")
def test_autoresearch_init_creates_config_file(
    mock_run: MagicMock,
    mock_copilot_session_service: MagicMock,
    tmp_path: pathlib.Path,
) -> None:
    """
    TDD Test: `just autoresearch init --name <name>` should create a <name>.config.toml file
    in the current directory with the correct content.
    """
    mock_run.return_value = MagicMock(returncode=0)
    mock_service = MagicMock()
    mock_service.send_message.return_value = MagicMock(is_success=True, stderr="")
    mock_copilot_session_service.return_value = mock_service
    runner = CliRunner()
    project_name = "test_project"
    config_filename = f"{project_name}.config.toml"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", project_name])

        assert result.exit_code == 0
        assert f"Created project configuration: {config_filename}" in result.output

        config_file = pathlib.Path(config_filename)
        assert config_file.exists()

        content = config_file.read_text()
        assert f'name = "{project_name}"' in content
        assert 'agentic_cli_type = "copilot_cli"' in content
        assert 'agentic_cli_alias = "copilot"' in content


@patch("subprocess.run")
def test_autoresearch_init_verifies_cli_success(
    mock_run: MagicMock, tmp_path: pathlib.Path
) -> None:
    """TDD Test: `init` should succeed if agentic CLI verification passes."""
    mock_run.return_value = MagicMock(returncode=0)
    runner = CliRunner()
    project_name = "verified_project"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", project_name])
        assert result.exit_code == 0
        assert f"Created project configuration: {project_name}.config.toml" in result.output
        # Verify subprocess was called for version and message
        assert mock_run.call_count >= 2
        version_args = mock_run.call_args_list[0][0][0]
        assert version_args[0] == "copilot"
        assert "--version" in version_args


@patch("subprocess.run")
def test_autoresearch_init_fails_if_cli_unauthenticated(
    mock_run: MagicMock, tmp_path: pathlib.Path
) -> None:
    """TDD Test: `init` should fail if agentic CLI verification fails."""
    # First call (version) succeeds, second (message) fails
    mock_run.side_effect = [
        MagicMock(returncode=0),
        MagicMock(returncode=1, stderr="Not authenticated"),
    ]
    runner = CliRunner()
    project_name = "unverified_project"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", project_name])
        assert result.exit_code != 0
        assert "Error: Agentic CLI verification failed" in result.output
        # Config file should NOT be created if verification fails
        assert not pathlib.Path(f"{project_name}.config.toml").exists()


@patch("subprocess.run")
def test_autoresearch_init_reports_current_copilot_install_command_when_binary_is_missing(
    mock_run: MagicMock, tmp_path: pathlib.Path
) -> None:
    """TDD Test: `init` should print current Copilot install guidance when the binary is missing."""
    mock_run.side_effect = FileNotFoundError()
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", "missing-cli"], input="n\n")

    assert result.exit_code != 0
    assert "To install the GitHub Copilot CLI, run:" in result.output
    assert "npm install -g @github/copilot" in result.output
    assert "@github/copilot-cli" not in result.output
    assert "Error: Missing required tool: copilot" in result.output


def test_autoresearch_init_rejects_empty_name() -> None:
    """TDD Test: `init --name ""` should fail."""
    runner = CliRunner()
    result = runner.invoke(cli, ["autoresearch", "init", "--name", ""])
    assert result.exit_code != 0
    assert "Error: Project name cannot be empty." in result.output


def test_autoresearch_init_rejects_invalid_characters() -> None:
    """TDD Test: `init --name "bad/name"` should fail."""
    runner = CliRunner()
    result = runner.invoke(cli, ["autoresearch", "init", "--name", "bad/name"])
    assert result.exit_code != 0
    assert "Error: Project name contains invalid characters." in result.output


def test_autoresearch_init_prevents_overwrite(tmp_path: pathlib.Path) -> None:
    """TDD Test: `init` should not overwrite existing config."""
    runner = CliRunner()
    project_name = "existing"
    config_filename = f"{project_name}.config.toml"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        # Create initial file
        pathlib.Path(config_filename).write_text("existing")

        result = runner.invoke(cli, ["autoresearch", "init", "--name", project_name])
        assert result.exit_code != 0
        assert f"Error: Configuration file {config_filename} already exists." in result.output
