from __future__ import annotations

import json
import pathlib
from unittest.mock import MagicMock, patch

import click
import pytest
from click.testing import CliRunner

from cli.main import cli
from cli.commands import design as design_module
from cli.services.copilot_session import PERMISSIVE_TOOLSET
from cli.services.project_config import ProjectConfig


class _CountingStdout:
    def __init__(self, raw_text: str) -> None:
        self._raw_text = raw_text
        self.strip_call_count = 0

    def strip(self) -> str:
        self.strip_call_count += 1
        return self._raw_text.strip()


def _write_project_config(config_path: pathlib.Path, *, alias: str = "copilot") -> None:
    prompt_path = pathlib.Path(".github/prompts/create-experiment-from-ideas.prompt.md")
    prompt_path.parent.mkdir(parents=True, exist_ok=True)
    prompt_path.write_text(
        "\n".join(
            [
                "---",
                'agent: "edge-architect"',
                "---",
                "Create One Experiment From Ideas",
                "Return one Markdown experiment spec with these headings",
                "Submit it exactly once with `just autoresearch experiment create`.",
            ]
        )
        + "\n"
    )
    config_path.write_text(
        "\n".join(
            [
                'name = "test-project"',
                f'agentic_cli_alias = "{alias}"',
                "",
                "[task_prompts.design]",
                'kind = "file"',
                'path = ".github/prompts/create-experiment-from-ideas.prompt.md"',
            ]
        )
        + "\n"
    )


def _write_registry(experiments: list[dict[str, object]]) -> None:
    registry_path = pathlib.Path("experiments/registry.state.json")
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps({"experiments": experiments}, indent=2) + "\n")


def test_design_uses_configured_prompt_file_body_without_frontmatter(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "prompt-body-experiment",
                            "title": "Prompt body experiment",
                            "description": "Created from the checked-in prompt.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code == 0
    prompt = mock_send.call_args.args[1]
    assert "Create One Experiment From Ideas" in prompt
    assert "Return one Markdown experiment spec with these headings" in prompt
    assert "Submit it exactly once with `just autoresearch experiment create`." in prompt
    assert "name:" not in prompt
    assert 'agent: "edge-architect"' not in prompt
    assert "\n---\n" not in prompt
    assert "User brief: Improve eval throughput" in prompt


def test_resolve_design_prompt_requires_task_prompt_configuration() -> None:
    project_config = ProjectConfig(
        path=pathlib.Path("project.config.toml"),
        name="test-project",
        agentic_cli_type="copilot_cli",
        agentic_cli_alias="copilot",
        baseline_id="test-project",
        baseline_eval_model="edge_agent_default",
        task_prompts={},
    )

    with pytest.raises(click.ClickException) as exc_info:
        design_module._resolve_design_prompt(project_config)

    assert "task_prompts.design" in str(exc_info.value)


def test_design_requires_task_prompt_configuration(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        pathlib.Path("project.config.toml").write_text(
            "\n".join(
                [
                    'name = "test-project"',
                    'agentic_cli_alias = "copilot"',
                ]
            )
            + "\n"
        )
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:
            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code != 0
    assert "task_prompts.design" in result.output
    mock_send.assert_not_called()


def test_design_uses_configured_prompt_relative_to_config_and_frontmatter_agent(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_dir = pathlib.Path("config")
        prompts_dir = pathlib.Path("prompts")
        config_dir.mkdir()
        prompts_dir.mkdir()
        config_path = config_dir / "project.config.toml"
        config_path.write_text(
            "\n".join(
                [
                    'name = "test-project"',
                    'agentic_cli_alias = "configured-alias"',
                    "",
                    "[task_prompts.design]",
                    'kind = "file"',
                    'path = "../prompts/custom.prompt.md"',
                ]
            )
            + "\n"
        )
        (prompts_dir / "custom.prompt.md").write_text(
            "\n".join(
                [
                    "---",
                    'agent: "custom-architect"',
                    "---",
                    "Custom prompt body.",
                ]
            )
            + "\n"
        )
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "custom-prompt-experiment",
                            "title": "Custom prompt experiment",
                            "description": "Created from a configured prompt.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    str(config_path),
                ],
            )

    assert result.exit_code == 0
    session = mock_send.call_args.args[0]
    prompt = mock_send.call_args.args[1]
    assert session.alias == "configured-alias"
    assert session.agent == "custom-architect"
    assert "Custom prompt body." in prompt
    assert 'agent: "custom-architect"' not in prompt
    assert "Create One Experiment From Ideas" not in prompt


def test_design_uses_inline_task_prompt_text_and_agent(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_path = pathlib.Path("project.config.toml")
        config_path.write_text(
            "\n".join(
                [
                    'name = "test-project"',
                    'agentic_cli_alias = "inline-alias"',
                    "",
                    "[task_prompts.design]",
                    'text = "Inline design prompt body."',
                    'agent = "implement"',
                ]
            )
            + "\n"
        )
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "inline-prompt-experiment",
                            "title": "Inline prompt experiment",
                            "description": "Created from an inline prompt.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    str(config_path),
                ],
            )

    assert result.exit_code == 0
    session = mock_send.call_args.args[0]
    prompt = mock_send.call_args.args[1]
    assert session.alias == "inline-alias"
    assert session.agent == "implement"
    assert "Inline design prompt body." in prompt
    assert "Create One Experiment From Ideas" not in prompt


def test_design_uses_no_agent_when_configured_prompt_frontmatter_has_no_agent(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_dir = pathlib.Path("config")
        prompts_dir = pathlib.Path("prompts")
        config_dir.mkdir()
        prompts_dir.mkdir()
        config_path = config_dir / "project.config.toml"
        config_path.write_text(
            "\n".join(
                [
                    'name = "test-project"',
                    "",
                    "[task_prompts.design]",
                    'kind = "file"',
                    'path = "../prompts/no-agent.prompt.md"',
                ]
            )
            + "\n"
        )
        (prompts_dir / "no-agent.prompt.md").write_text(
            "\n".join(
                [
                    "---",
                    'description: "No agent override"',
                    "---",
                    "Prompt without agent frontmatter.",
                ]
            )
            + "\n"
        )
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "no-agent-experiment",
                            "title": "No agent experiment",
                            "description": "Created without an agent override.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    str(config_path),
                ],
            )

    assert result.exit_code == 0
    session = mock_send.call_args.args[0]
    prompt = mock_send.call_args.args[1]
    assert session.agent is None
    assert "Prompt without agent frontmatter." in prompt
    assert 'description: "No agent override"' not in prompt


def test_design_without_brief_instructs_agent_to_choose_one_topic(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "autonomous-experiment",
                            "title": "Autonomous experiment",
                            "description": "Chosen by the agent.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code == 0
    assert "designed" in result.output
    assert mock_send.call_count == 1
    prompt = mock_send.call_args.args[1]
    assert "Choose exactly one experiment topic yourself" in prompt
    assert "Inspect docs/ideas.md first as the primary source of candidate directions" in prompt
    assert "current repository code and docs" in prompt
    assert "relevant library docs if they suggest a stronger experiment" in prompt
    assert "User brief:" not in prompt
    assert "just autoresearch experiment create --title" in prompt


def test_design_uses_explicit_project_config_and_injects_local_experiment_context(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("aaa.config.toml"), alias="auto-discovered")
        _write_project_config(pathlib.Path("explicit.config.toml"), alias="explicit-alias")
        _write_registry(
            [
                {
                    "id": "pending-experiment",
                    "title": "Pending experiment",
                    "description": "Draft a pending experiment.",
                    "status": "pending",
                    "created_at": "2026-05-10T10:00:00Z",
                    "updated_at": "2026-05-10T10:00:00Z",
                    "current_run_id": None,
                    "runs": [],
                },
                {
                    "id": "completed-experiment",
                    "title": "Completed experiment",
                    "description": "Recently completed experiment.",
                    "status": "completed",
                    "created_at": "2026-05-09T10:00:00Z",
                    "updated_at": "2026-05-11T11:00:00Z",
                    "current_run_id": None,
                    "runs": [
                        {
                            "run_id": "run-123",
                            "status": "completed",
                            "outcome": "improved",
                            "baseline_id": "baseline-a",
                            "started_at": "2026-05-11T10:30:00Z",
                            "finished_at": "2026-05-11T11:00:00Z",
                            "before_score": 0.4,
                            "after_score": 0.5,
                            "absolute_delta": 0.1,
                            "relative_delta": 0.25,
                            "rerun_of_run_id": None,
                        }
                    ],
                },
            ]
        )

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "pending-experiment",
                            "title": "Pending experiment",
                            "description": "Draft a pending experiment.",
                            "status": "pending",
                            "created_at": "2026-05-10T10:00:00Z",
                            "updated_at": "2026-05-10T10:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        },
                        {
                            "id": "completed-experiment",
                            "title": "Completed experiment",
                            "description": "Recently completed experiment.",
                            "status": "completed",
                            "created_at": "2026-05-09T10:00:00Z",
                            "updated_at": "2026-05-11T11:00:00Z",
                            "current_run_id": None,
                            "runs": [
                                {
                                    "run_id": "run-123",
                                    "status": "completed",
                                    "outcome": "improved",
                                    "baseline_id": "baseline-a",
                                    "started_at": "2026-05-11T10:30:00Z",
                                    "finished_at": "2026-05-11T11:00:00Z",
                                    "before_score": 0.4,
                                    "after_score": 0.5,
                                    "absolute_delta": 0.1,
                                    "relative_delta": 0.25,
                                    "rerun_of_run_id": None,
                                }
                            ],
                        },
                        {
                            "id": "new-experiment",
                            "title": "New experiment",
                            "description": "Created by the agent.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        },
                    ]
                )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "explicit.config.toml",
                ],
            )

    assert result.exit_code == 0
    assert "designed" in result.output
    session = mock_send.call_args.args[0]
    prompt = mock_send.call_args.args[1]
    assert session.alias == "explicit-alias"
    assert session.model == "gpt-5-mini"
    assert session.toolset == PERMISSIVE_TOOLSET
    assert session.agent == "edge-architect"
    assert mock_send.call_count == 1
    assert "Improve eval throughput" in prompt
    assert "just autoresearch experiment create --title" in prompt
    assert "Pending experiments:" in prompt
    assert "- pending-experiment | pending | Pending experiment" in prompt
    assert "Recent completed experiments:" in prompt
    assert (
        "- completed-experiment | completed | Completed experiment | last outcome: improved"
        in prompt
    )
    assert "just autoresearch experiment list" not in prompt
    assert "just autoresearch experiment show" not in prompt
    assert "length changes by 1" not in prompt
    assert "candidate.md" not in prompt


def test_design_retries_once_in_same_session_when_experiment_count_does_not_increase(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_registry(
            [
                {
                    "id": "existing-experiment",
                    "title": "Existing experiment",
                    "description": "Already present.",
                    "status": "pending",
                    "created_at": "2026-05-10T10:00:00Z",
                    "updated_at": "2026-05-10T10:00:00Z",
                    "current_run_id": None,
                    "runs": [],
                }
            ]
        )

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:
            send_count = 0

            def _send_message(*args: object, **kwargs: object) -> MagicMock:
                nonlocal send_count
                send_count += 1
                if send_count == 2:
                    _write_registry(
                        [
                            {
                                "id": "existing-experiment",
                                "title": "Existing experiment",
                                "description": "Already present.",
                                "status": "pending",
                                "created_at": "2026-05-10T10:00:00Z",
                                "updated_at": "2026-05-10T10:00:00Z",
                                "current_run_id": None,
                                "runs": [],
                            },
                            {
                                "id": "new-experiment",
                                "title": "New experiment",
                                "description": "Created after retry.",
                                "status": "pending",
                                "created_at": "2026-05-12T12:00:00Z",
                                "updated_at": "2026-05-12T12:00:00Z",
                                "current_run_id": None,
                                "runs": [],
                            },
                        ]
                    )
                return MagicMock(is_success=True, stdout="designed", stderr="")

            mock_send.side_effect = _send_message

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code == 0
    assert mock_send.call_count == 2
    first_call = mock_send.call_args_list[0]
    second_call = mock_send.call_args_list[1]
    assert first_call.args[0] is second_call.args[0]
    assert first_call.kwargs["continue_session"] is False
    assert second_call.kwargs["continue_session"] is True
    assert "must submit exactly one experiment" in second_call.args[1]


def test_design_raises_click_exception_when_retry_does_not_create_experiment(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:
            mock_send.return_value = MagicMock(is_success=True, stdout="designed", stderr="")

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code != 0
    assert mock_send.call_count == 2
    assert "did not create a new experiment after one retry" in result.output


def test_design_strips_stdout_once_and_echoes_trimmed_output(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_registry([])
        stdout_text = _CountingStdout("  designed output  ")

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "new-experiment",
                            "title": "New experiment",
                            "description": "Created by the agent.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout=stdout_text, stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code == 0
    assert result.output == "designed output\n"
    assert stdout_text.strip_call_count == 1


def test_design_falls_back_to_submission_message_for_blank_stdout(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"), alias="explicit-alias")
        _write_registry([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_registry(
                    [
                        {
                            "id": "new-experiment",
                            "title": "New experiment",
                            "description": "Created by the agent.",
                            "status": "pending",
                            "created_at": "2026-05-12T12:00:00Z",
                            "updated_at": "2026-05-12T12:00:00Z",
                            "current_run_id": None,
                            "runs": [],
                        }
                    ]
                )
                return MagicMock(is_success=True, stdout="   ", stderr="")

            mock_send.side_effect = _create_experiment

            result = runner.invoke(
                cli,
                [
                    "autoresearch",
                    "design",
                    "Improve eval throughput",
                    "--config",
                    "project.config.toml",
                ],
            )

    assert result.exit_code == 0
    assert result.output == "Submitted design request using agentic CLI: explicit-alias\n"
