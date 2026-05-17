from __future__ import annotations

import pathlib
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner
from pydantic import ValidationError

from cli.main import cli
from cli.services.project_config import load_project_config


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
        assert "[task_prompts.design]" in content
        assert 'kind = "file"' in content
        assert 'path = ".github/prompts/create-experiment-from-ideas.prompt.md"' in content


@patch("cli.commands.init.CopilotSessionService")
@patch("cli.commands.init.subprocess.run")
def test_autoresearch_init_writes_default_baseline_section(
    mock_run: MagicMock,
    mock_copilot_session_service: MagicMock,
    tmp_path: pathlib.Path,
) -> None:
    mock_run.return_value = MagicMock(returncode=0)
    mock_service = MagicMock()
    mock_service.send_message.return_value = MagicMock(is_success=True, stderr="")
    mock_copilot_session_service.return_value = mock_service
    runner = CliRunner()
    project_name = "baseline_project"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", project_name])

        assert result.exit_code == 0
        project_config = load_project_config(f"{project_name}.config.toml", required=True)
        assert project_config is not None
        assert project_config.baseline_id == project_name
        assert project_config.baseline_eval_model == "edge_agent_default"


@patch("cli.commands.init.CopilotSessionService")
@patch("cli.commands.init.subprocess.run")
def test_autoresearch_init_accepts_explicit_baseline_settings(
    mock_run: MagicMock,
    mock_copilot_session_service: MagicMock,
    tmp_path: pathlib.Path,
) -> None:
    mock_run.return_value = MagicMock(returncode=0)
    mock_service = MagicMock()
    mock_service.send_message.return_value = MagicMock(is_success=True, stderr="")
    mock_copilot_session_service.return_value = mock_service
    runner = CliRunner()
    project_name = "configured_project"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(
            cli,
            [
                "autoresearch",
                "init",
                "--name",
                project_name,
                "--baseline-id",
                "configured_baseline",
                "--eval-model",
                "edge_agent_local_openrouter",
            ],
        )

        assert result.exit_code == 0
        project_config = load_project_config(f"{project_name}.config.toml", required=True)
        assert project_config is not None
        assert project_config.baseline_id == "configured_baseline"
        assert project_config.baseline_eval_model == "edge_agent_local_openrouter"


@patch("cli.commands.init.CopilotSessionService")
@patch("cli.commands.init.subprocess.run")
def test_autoresearch_init_derives_filename_from_validated_project_name(
    mock_run: MagicMock,
    mock_copilot_session_service: MagicMock,
    tmp_path: pathlib.Path,
) -> None:
    mock_run.return_value = MagicMock(returncode=0)
    mock_service = MagicMock()
    mock_service.send_message.return_value = MagicMock(is_success=True, stderr="")
    mock_copilot_session_service.return_value = mock_service
    runner = CliRunner()
    raw_project_name = "  spaced_name  "
    normalized_project_name = "spaced_name"

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["autoresearch", "init", "--name", raw_project_name])

        assert result.exit_code == 0
        assert (
            f"Created project configuration: {normalized_project_name}.config.toml" in result.output
        )
        assert pathlib.Path(f"{normalized_project_name}.config.toml").exists()
        assert not pathlib.Path(f"{raw_project_name}.config.toml").exists()

        content = pathlib.Path(f"{normalized_project_name}.config.toml").read_text()
        assert f'name = "{normalized_project_name}"' in content


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


def test_autoresearch_init_rejects_invalid_baseline_id_characters() -> None:
    runner = CliRunner()
    result = runner.invoke(
        cli,
        ["autoresearch", "init", "--name", "valid_name", "--baseline-id", "bad baseline!"],
    )
    assert result.exit_code != 0
    assert "Error: Baseline ID contains invalid characters." in result.output


@patch("cli.commands.init.CopilotSessionService")
@patch("cli.commands.init.subprocess.run")
def test_autoresearch_init_rejects_explicit_empty_baseline_id(
    mock_run: MagicMock,
    mock_copilot_session_service: MagicMock,
    tmp_path: pathlib.Path,
) -> None:
    mock_run.return_value = MagicMock(returncode=0)
    mock_service = MagicMock()
    mock_service.send_message.return_value = MagicMock(is_success=True, stderr="")
    mock_copilot_session_service.return_value = mock_service
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(
            cli,
            ["autoresearch", "init", "--name", "valid_name", "--baseline-id", ""],
        )

    assert result.exit_code != 0
    assert "Error: Baseline ID cannot be empty." in result.output


def test_init_command_inputs_reject_invalid_eval_model() -> None:
    from cli.commands import init as init_module

    with pytest.raises(ValidationError) as excinfo:
        init_module.InitCommandInputs.model_validate(
            {
                "name": "valid_name",
                "baseline_id": "valid_baseline",
                "eval_model": "bad/model",
            }
        )

    assert any(error["loc"] == ("eval_model",) for error in excinfo.value.errors())


def test_autoresearch_init_rejects_invalid_eval_model_characters() -> None:
    runner = CliRunner()
    result = runner.invoke(
        cli,
        ["autoresearch", "init", "--name", "valid_name", "--eval-model", "bad/model"],
    )
    assert result.exit_code != 0
    assert "Error: Evaluation model contains invalid characters." in result.output


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
