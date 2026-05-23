from __future__ import annotations

import importlib
from pathlib import Path

import pytest


def test_project_config_module_is_available_under_services() -> None:
    module = importlib.import_module("cli.services.project_config")

    assert module.project_config_filename("demo") == "demo.config.toml"


def test_legacy_project_config_module_reexports_services_symbols() -> None:
    legacy = importlib.import_module("cli.project_config")
    services = importlib.import_module("cli.services.project_config")

    assert legacy.load_project_config is services.load_project_config
    assert legacy.ProjectConfig is services.ProjectConfig


def test_command_context_loads_project_config_from_services_module() -> None:
    command_context = importlib.import_module("cli.commands.command_context")

    assert command_context.load_project_config.__module__ == "cli.services.project_config"


def test_load_project_config_defaults_baseline_section_for_legacy_files(tmp_path: Path) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "legacy.config.toml"
    config_path.write_text(
        "\n".join(
            [
                'name = "legacy"',
                'agentic_cli_type = "copilot_cli"',
                'agentic_cli_alias = "copilot"',
            ]
        )
        + "\n"
    )

    project_config = services.load_project_config(config_path, required=True)

    assert project_config is not None
    assert project_config.baseline_id == "legacy"
    assert project_config.baseline_eval_model == "edge_agent_default"


def test_load_project_config_rejects_legacy_root_design_prompt(
    tmp_path: Path,
) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    config_path.write_text(
        "\n".join(
            [
                'name = "demo"',
                'design_prompt = "prompts/custom.prompt.md"',
            ]
        )
        + "\n"
    )

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert "unsupported top-level keys: design_prompt" in str(exc_info.value)


def test_load_project_config_reads_task_prompts_mapping(tmp_path: Path) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    config_path.write_text(
        "\n".join(
            [
                'name = "demo"',
                "",
                "[task_prompts.design]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"',
                'resque_prompt = "Execute just autoresearch experiment create now."',
                "",
                "[task_prompts.execute_experiment]",
                'agent = "implement"',
                'prompt = "Execute the queued experiment now."',
            ]
        )
        + "\n"
    )

    project_config = services.load_project_config(config_path, required=True)

    assert project_config is not None
    assert project_config.task_prompts["design"].agent == "edge-architect"
    assert (
        project_config.task_prompts["design"].prompt
        == "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"
    )
    assert (
        project_config.task_prompts["design"].resque_prompt
        == "Execute just autoresearch experiment create now."
    )
    assert project_config.task_prompts["execute_experiment"].agent == "implement"
    assert (
        project_config.task_prompts["execute_experiment"].prompt
        == "Execute the queued experiment now."
    )
    assert project_config.task_prompts["execute_experiment"].resque_prompt is None


def test_load_project_config_accepts_resque_prompt(tmp_path: Path) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    config_path.write_text(
        "\n".join(
            [
                'name = "demo"',
                "",
                "[task_prompts.design]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"',
                'resque_prompt = "Execute just autoresearch experiment create now."',
            ]
        )
        + "\n"
    )

    project_config = services.load_project_config(config_path, required=True)

    assert project_config is not None
    assert project_config.task_prompts["design"].agent == "edge-architect"
    assert (
        project_config.task_prompts["design"].prompt
        == "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"
    )
    assert (
        project_config.task_prompts["design"].resque_prompt
        == "Execute just autoresearch experiment create now."
    )


@pytest.mark.parametrize("missing_key", ["agent", "prompt"])
def test_load_project_config_requires_strict_task_prompt_keys(
    tmp_path: Path,
    missing_key: str,
) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    task_prompt_lines = {
        "agent": 'agent = "edge-architect"',
        "prompt": 'prompt = "Strictly follow '
        '.github/prompts/create-experiment-from-ideas.prompt.md"',
    }
    task_prompt_lines.pop(missing_key)

    config_path.write_text(
        "\n".join(['name = "demo"', "", "[task_prompts.design]", *task_prompt_lines.values()])
        + "\n",
    )

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert "must define required keys: agent, prompt" in str(exc_info.value)


@pytest.mark.parametrize(
    "invalid_key",
    ["prompt_file", "kind", "path", "rescue_prompt"],
)
def test_load_project_config_rejects_unknown_task_prompt_keys(
    tmp_path: Path,
    invalid_key: str,
) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    invalid_line_by_key = {
        "prompt_file": 'prompt_file = "prompts/design.prompt.md"',
        "kind": 'kind = "inline"',
        "path": 'path = "prompts/design.prompt.md"',
        "rescue_prompt": 'rescue_prompt = "Retry with side effects now."',
    }

    config_path.write_text(
        "\n".join(
            [
                'name = "demo"',
                "",
                "[task_prompts.design]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"',
                invalid_line_by_key[invalid_key],
            ]
        )
        + "\n"
    )

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert "supports only keys: agent, prompt, resque_prompt" in str(exc_info.value)


def test_load_project_config_rejects_legacy_root_design_prompt_even_when_task_prompt_exists(
    tmp_path: Path,
) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    config_path.write_text(
        "\n".join(
            [
                'name = "demo"',
                'design_prompt = "prompts/legacy.prompt.md"',
                "",
                "[task_prompts.design]",
                'agent = "edge-architect"',
                'prompt = "Strictly follow .github/prompts/create-experiment-from-ideas.prompt.md"',
            ]
        )
        + "\n"
    )

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert "unsupported top-level keys: design_prompt" in str(exc_info.value)
