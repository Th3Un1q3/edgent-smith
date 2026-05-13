from __future__ import annotations

import importlib


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
