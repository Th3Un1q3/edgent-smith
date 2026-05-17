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
                'kind = "file"',
                'path = "prompts/design.prompt.md"',
                "",
                "[task_prompts.execute_experiment]",
                'text = "Execute something"',
                'agent = "implement"',
            ]
        )
        + "\n"
    )

    project_config = services.load_project_config(config_path, required=True)

    assert project_config is not None
    assert project_config.task_prompts["design"].kind == "file"
    assert project_config.task_prompts["design"].path == "prompts/design.prompt.md"
    assert project_config.task_prompts["design"].text is None
    assert project_config.task_prompts["design"].agent is None
    assert project_config.task_prompts["execute_experiment"].kind == "inline"
    assert project_config.task_prompts["execute_experiment"].text == "Execute something"
    assert project_config.task_prompts["execute_experiment"].agent == "implement"
    assert project_config.task_prompts["execute_experiment"].path is None


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
                'kind = "file"',
                'path = "prompts/design.prompt.md"',
            ]
        )
        + "\n"
    )

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert "unsupported top-level keys: design_prompt" in str(exc_info.value)


@pytest.mark.parametrize(
    ("task_prompt_lines", "expected_message"),
    [
        (
            [
                "[task_prompts.design]",
                'text = "Inline design prompt body."',
                'path = "prompts/design.prompt.md"',
            ],
            "must not define both text and path",
        ),
        (
            [
                "[task_prompts.design]",
                'kind = "vscode-file"',
                'path = "prompts/design.prompt.md"',
            ],
            "unknown kind",
        ),
    ],
)
def test_load_project_config_rejects_invalid_task_prompt_shapes(
    tmp_path: Path,
    task_prompt_lines: list[str],
    expected_message: str,
) -> None:
    services = importlib.import_module("cli.services.project_config")
    config_path = tmp_path / "project.config.toml"
    config_path.write_text("\n".join(['name = "demo"', "", *task_prompt_lines]) + "\n")

    with pytest.raises(Exception) as exc_info:
        services.load_project_config(config_path, required=True)

    assert expected_message in str(exc_info.value)
