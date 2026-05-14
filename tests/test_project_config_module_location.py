from __future__ import annotations

import importlib
from pathlib import Path


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
