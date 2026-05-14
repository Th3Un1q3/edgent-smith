from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from cli.services.copilot_session import CopilotSessionService, Toolset
from cli.services.project_config import (
    DEFAULT_AGENTIC_CLI_ALIAS,
    ProjectConfig,
    load_project_config,
)

__all__ = ["CommandContext", "build_command_context"]


@dataclass(frozen=True)
class CommandContext:
    project_config: ProjectConfig | None
    copilot_session: CopilotSessionService


def build_command_context(
    config_path: str | Path | None,
    *,
    required: bool,
    model: str,
    toolset: Toolset | None = None,
    agent: str | None = None,
) -> CommandContext:
    project_config = load_project_config(config_path, required=required)
    cli_alias = (
        project_config.agentic_cli_alias
        if project_config is not None
        else DEFAULT_AGENTIC_CLI_ALIAS
    )

    return CommandContext(
        project_config=project_config,
        copilot_session=CopilotSessionService(
            alias=cli_alias,
            model=model,
            toolset=toolset,
            agent=agent,
        ),
    )
