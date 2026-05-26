from __future__ import annotations

from secrets import choice

import click

from cli.commands.command_context import build_command_context
from cli.services.copilot_session import CopilotSessionService, SessionResult

MISSING_CONFIG_MESSAGE = (
    "No .config.toml file found in the current directory. "
    "Pass --config PATH or add a *.config.toml file; when omitted, validate "
    "auto-discovers the lexicographically first *.config.toml file in the current directory."
)


def _send_validation_message(
    copilot_session: CopilotSessionService,
    prompt: str,
    *,
    failure_prefix: str,
) -> SessionResult:
    session_result = copilot_session.send_message(prompt)
    if not session_result.is_success:
        raise click.ClickException(f"{failure_prefix}: {session_result.stderr}")
    return session_result


def run_validate(config_path: str | None = None) -> None:
    """Logic for the autoresearch validate command."""
    try:
        command_context = build_command_context(
            config_path=config_path,
            required=True,
            model="gpt-5-mini",
        )
    except click.ClickException as exc:
        if (
            config_path is None
            and str(exc) == "No .config.toml file found in the current directory."
        ):
            raise click.ClickException(MISSING_CONFIG_MESSAGE) from exc
        raise

    project_config = command_context.project_config
    if project_config is None:
        raise click.ClickException(MISSING_CONFIG_MESSAGE)

    click.echo(f"Found configuration: {project_config.path}")
    click.echo(
        f"Validating project '{project_config.name}' using agentic CLI: "
        f"{project_config.agentic_cli_alias}"
    )

    copilot_session = command_context.copilot_session

    validation_secret = "".join(choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))

    click.echo("Sending first message...")
    _send_validation_message(
        copilot_session,
        f'My pet is called "{validation_secret}". do nothing for now.',
        failure_prefix="First message failed",
    )

    click.echo("Sending second message...")
    pet_name_response = _send_validation_message(
        copilot_session,
        "what's the name of my pet?",
        failure_prefix="Second message failed",
    )

    click.echo(f"Agent response: {pet_name_response.stdout}")

    if validation_secret.lower() in pet_name_response.stdout.lower():
        click.echo("Validation successful: Agent remembered the secret across messages.")
    else:
        click.echo("Validation warning: Agent did not clearly repeat the secret.")
