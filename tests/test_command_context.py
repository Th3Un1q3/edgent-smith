from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from cli.commands.command_context import CommandContext, build_command_context
from cli.services.copilot_session import RESTRICTED_TOOLSET, CopilotSessionService


def test_command_context_uses_explicit_copilot_session_field() -> None:
    copilot_session = CopilotSessionService(alias="gh-copilot")

    command_context = CommandContext(project_config=None, copilot_session=copilot_session)

    assert command_context.project_config is None
    assert command_context.copilot_session is copilot_session
    assert not hasattr(command_context, "service")

    with pytest.raises(FrozenInstanceError):
        command_context.copilot_session = CopilotSessionService(alias="other")


def test_build_command_context_populates_explicit_copilot_session_field(
    tmp_path,
) -> None:
    config_path = tmp_path / "project.config.toml"
    config_path.write_text('name = "demo"\nagentic_cli_alias = "explicit-alias"\n')

    command_context = build_command_context(
        config_path,
        required=False,
        model="gpt-5-mini",
    )

    assert command_context.project_config is not None
    assert command_context.project_config.path == config_path
    assert command_context.project_config.agentic_cli_alias == "explicit-alias"
    assert command_context.copilot_session.alias == "explicit-alias"
    assert command_context.copilot_session.model == "gpt-5-mini"
    assert command_context.copilot_session.toolset is RESTRICTED_TOOLSET
    assert not hasattr(command_context, "service")
