from __future__ import annotations

from pathlib import Path

import click
import pytest

from cli.commands import task_runner
from cli.commands.task_runner import is_non_retriable_agent_error_text
from cli.services.project_config import ProjectConfig, TaskPromptConfig


def test_non_retriable_detector_matches_rate_limit_sample() -> None:
    text = "❌ Error: (rate_limit) You've reached your weekly rate limit..."

    assert is_non_retriable_agent_error_text(text) is True


def test_non_retriable_detector_matches_quota_and_429_phrases() -> None:
    assert is_non_retriable_agent_error_text("HTTP 429 Too Many Requests") is True
    assert is_non_retriable_agent_error_text("Request failed because quota exceeded") is True


def test_non_retriable_detector_does_not_match_unrelated_text() -> None:
    assert is_non_retriable_agent_error_text("No experiments were created yet.") is False


def test_load_task_prompt_config_returns_prompt_and_agent() -> None:
    project_config = ProjectConfig(
        path=Path("project.config.toml"),
        name="demo",
        agentic_cli_type="copilot_cli",
        agentic_cli_alias="copilot",
        baseline_id="demo",
        baseline_eval_model="edge_agent_default",
        task_prompts={
            "design": TaskPromptConfig(
                agent="edge-architect",
                prompt="Strict prompt body",
            )
        },
    )

    prompt, agent = task_runner.load_task_prompt_config(project_config, "design")

    assert prompt == "Strict prompt body"
    assert agent == "edge-architect"


def test_load_task_prompt_config_delegates_missing_config_error_to_get_task_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise_canonical_error(
        project_config: ProjectConfig | None, task_name: str
    ) -> TaskPromptConfig:
        raise click.ClickException(f"canonical handling for {task_name}")

    monkeypatch.setattr(task_runner, "get_task_prompt", _raise_canonical_error)

    with pytest.raises(click.ClickException, match="canonical handling for design"):
        task_runner.load_task_prompt_config(None, "design")
