from __future__ import annotations

import pathlib
from unittest.mock import MagicMock, patch

from click.testing import CliRunner

from cli.main import cli
from cli.services.copilot_session import PERMISSIVE_TOOLSET
from cli.services.experiment_storage import FileSystemExperimentStorage


class _CountingStdout:
    def __init__(self, raw_text: str) -> None:
        self._raw_text = raw_text
        self.strip_call_count = 0

    def strip(self) -> str:
        self.strip_call_count += 1
        return self._raw_text.strip()


def _write_project_config(config_path: pathlib.Path, *, alias: str = "copilot") -> None:
    config_path.write_text(
        "\n".join(
            [
                'name = "test-project"',
                f'agentic_cli_alias = "{alias}"',
                "",
                "[task_prompts.design]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow the task instructions in '
                '.github/prompts/create-experiment-from-ideas.prompt.md"',
            ]
        )
        + "\n"
    )


def _write_storage_experiments(experiments: list[dict[str, object]]) -> None:
    FileSystemExperimentStorage().save_experiments(experiments)


def test_design_uses_configured_prompt_verbatim(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_storage_experiments([])
        assert pathlib.Path("experiments/index.json").exists()

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
    assert (
        "Strictly follow the task instructions in "
        ".github/prompts/create-experiment-from-ideas.prompt.md" in prompt
    )
    assert "User brief: Improve eval throughput" in prompt


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
        _write_storage_experiments([])

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


def test_design_uses_configured_agent_from_project_config(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_path = pathlib.Path("project.config.toml")
        config_path.write_text(
            "\n".join(
                [
                    'name = "test-project"',
                    'agentic_cli_alias = "configured-alias"',
                    "",
                    "[task_prompts.design]",
                    'agent = "custom-architect"',
                    'prompt = "Use this configured design instruction."',
                ]
            )
            + "\n"
        )
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
    assert "Use this configured design instruction." in prompt


def test_design_treats_path_like_prompt_text_as_literal_prompt(
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
                    'prompt = ".github/prompts/create-experiment-from-ideas.prompt.md"',
                    'agent = "implement"',
                ]
            )
            + "\n"
        )
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
    assert ".github/prompts/create-experiment-from-ideas.prompt.md" in prompt


def test_design_without_brief_instructs_agent_to_choose_one_topic(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
        _write_storage_experiments(
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
        assert pathlib.Path("experiments/index.json").exists()

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
            assert pathlib.Path("experiments/index.json").exists()

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
        _write_storage_experiments(
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
                    _write_storage_experiments(
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


def test_design_uses_configured_resque_prompt_for_retry(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_path = pathlib.Path("project.config.toml")
        _write_project_config(config_path)
        config_path.write_text(
            config_path.read_text()
            + "\n"
            + 'resque_prompt = "Retry now and execute just autoresearch experiment create."\n'
        )
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:
            call_count = 0

            def _send_message(*args: object, **kwargs: object) -> MagicMock:
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    _write_storage_experiments(
                        [
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
    second_call = mock_send.call_args_list[1]
    assert second_call.args[1] == "Retry now and execute just autoresearch experiment create."


def test_design_does_not_retry_for_non_retriable_rate_limit_error(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:
            mock_send.return_value = MagicMock(
                is_success=True,
                stdout="❌ Error: (rate_limit) You've reached your weekly rate limit.",
                stderr="",
            )

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
    assert mock_send.call_count == 1
    assert "rate limit" in result.output.lower()
    assert "without retry" in result.output.lower()


def test_design_raises_click_exception_when_retry_does_not_create_experiment(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_project_config(pathlib.Path("project.config.toml"))
        _write_storage_experiments([])

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
        _write_storage_experiments([])
        stdout_text = _CountingStdout("  designed output  ")

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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
        _write_storage_experiments([])

        with patch(
            "cli.services.copilot_session.CopilotSessionService.send_message",
            autospec=True,
        ) as mock_send:

            def _create_experiment(*args: object, **kwargs: object) -> MagicMock:
                _write_storage_experiments(
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


# ---------------------------------------------------------------------------
# run_discover tests
# ---------------------------------------------------------------------------


def _write_discover_project_config(config_path: pathlib.Path, *, alias: str = "copilot") -> None:
    config_path.write_text(
        "\n".join(
            [
                'name = "test-project"',
                f'agentic_cli_alias = "{alias}"',
                "",
                "[task_prompts.discover]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow the task instructions in '
                '.github/prompts/explore-edge-agent-ideas.prompt.md"',
            ]
        )
        + "\n"
    )


def test_discover_calls_hf_papers(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial content.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers") as mock_fetch,
            patch("cli.commands.discover.format_papers_context") as mock_format,
        ):
            mock_format.return_value = "## Trending papers\n\nPaper A"

            def _update_ideas(*args: object, **kwargs: object) -> MagicMock:
                ideas_path.write_text("# Ideas\n\nUpdated content.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _update_ideas

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

            cache_path = pathlib.Path(".cache/discover/hf_papers.md")
            assert cache_path.exists()
            assert cache_path.read_text() == "## Trending papers\n\nPaper A"

    assert result.exit_code == 0, result.output
    mock_fetch.assert_called_once()
    prompt = mock_send.call_args.args[1]
    assert "Cached Hugging Face paper search results are stored at" in prompt
    assert ".cache/discover/hf_papers.md" in prompt
    assert "Paper A" not in prompt


def test_discover_uses_discover_toolset(tmp_path: pathlib.Path) -> None:

    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial content.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):

            def _update_ideas(*args: object, **kwargs: object) -> MagicMock:
                ideas_path.write_text("# Ideas\n\nUpdated.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _update_ideas

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    session = mock_send.call_args.args[0]
    assert session.toolset.allow_all is False
    assert "read_file" in session.toolset.allowed_tools
    assert "write_file" in session.toolset.allowed_tools


def test_discover_sends_followup_when_ideas_unchanged(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial content.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):
            call_count = 0

            def _write_on_second_call(*args: object, **kwargs: object) -> MagicMock:
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    ideas_path.write_text("# Ideas\n\nUpdated on retry.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _write_on_second_call

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    assert mock_send.call_count == 2
    second_prompt = mock_send.call_args_list[1].args[1]
    assert "You must update docs/ideas.md now." in second_prompt


def test_discover_uses_configured_rescue_prompt_for_retry(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        config_path = pathlib.Path("project.config.toml")
        _write_discover_project_config(config_path)
        config_path.write_text(
            config_path.read_text() + '\nresque_prompt = "Update docs/ideas.md immediately."\n'
        )
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial content.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):
            call_count = 0

            def _write_on_second_call(*args: object, **kwargs: object) -> MagicMock:
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    ideas_path.write_text("# Ideas\n\nUpdated on retry.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _write_on_second_call

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    assert mock_send.call_count == 2
    second_prompt = mock_send.call_args_list[1].args[1]
    assert second_prompt == "Update docs/ideas.md immediately."


def test_discover_does_not_retry_for_non_retriable_rate_limit_error(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        pathlib.Path("docs/ideas.md").write_text("# Ideas\n\nInitial content.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):
            mock_send.return_value = MagicMock(
                is_success=True,
                stdout="❌ Error: (rate_limit) You've reached your weekly rate limit.",
                stderr="",
            )

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code != 0
    assert mock_send.call_count == 1
    assert "rate limit" in result.output.lower()
    assert "without retry" in result.output.lower()


def test_discover_raises_when_ideas_unchanged_after_retry(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nNever changes.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):
            mock_send.return_value = MagicMock(is_success=True, stdout="ok", stderr="")

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code != 0
    assert "did not update docs/ideas.md" in result.output
    assert mock_send.call_count == 2


def test_discover_succeeds_when_ideas_changes_on_first_send(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):

            def _update_on_first(*args: object, **kwargs: object) -> MagicMock:
                ideas_path.write_text("# Ideas\n\nUpdated immediately.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _update_on_first

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    assert mock_send.call_count == 1


def test_discover_succeeds_when_ideas_changes_on_retry(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))
        pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
        ideas_path = pathlib.Path("docs/ideas.md")
        ideas_path.write_text("# Ideas\n\nInitial.\n")

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):
            call_count = 0

            def _update_on_retry(*args: object, **kwargs: object) -> MagicMock:
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    ideas_path.write_text("# Ideas\n\nUpdated on retry.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _update_on_retry

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    assert mock_send.call_count == 2


def test_discover_handles_missing_ideas_file(tmp_path: pathlib.Path) -> None:
    """No docs/ideas.md initially — agent creating it counts as a change."""
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _write_discover_project_config(pathlib.Path("project.config.toml"))

        with (
            patch(
                "cli.services.copilot_session.CopilotSessionService.send_message",
                autospec=True,
            ) as mock_send,
            patch("cli.commands.discover.fetch_papers"),
            patch("cli.commands.discover.format_papers_context", return_value="papers"),
        ):

            def _create_ideas(*args: object, **kwargs: object) -> MagicMock:
                pathlib.Path("docs").mkdir(parents=True, exist_ok=True)
                pathlib.Path("docs/ideas.md").write_text("# Ideas\n\nNew file.\n")
                return MagicMock(is_success=True, stdout="ok", stderr="")

            mock_send.side_effect = _create_ideas

            result = runner.invoke(
                cli, ["autoresearch", "discover", "--config", "project.config.toml"]
            )

    assert result.exit_code == 0, result.output
    assert mock_send.call_count == 1
