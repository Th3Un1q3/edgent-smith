from __future__ import annotations

from secrets import choice

import click

from cli.commands.command_context import build_command_context

MISSING_CONFIG_MESSAGE = (
    "No .config.toml file found in the current directory. "
    "Pass --config PATH or add a *.config.toml file; when omitted, validate "
    "auto-discovers the lexicographically first *.config.toml file in the current directory."
)


def run_validate(config_path: str | None = None) -> None:
    """Logic for the autoresearch validate command."""
    try:
        context = build_command_context(
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

    project_config = context.project_config
    if project_config is None:
        raise click.ClickException(MISSING_CONFIG_MESSAGE)

    click.echo(f"Found configuration: {project_config.path}")
    click.echo(
        f"Validating project '{project_config.name}' using agentic CLI: "
        f"{project_config.agentic_cli_alias}"
    )

    service = context.service

    # Generate a random secret for testing (e.g., using uuid4 or a random string)
    secret = "".join(choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))

    # Message 1
    click.echo("Sending first message...")
    res1 = service.send_message(
        f'My pet is called "{secret}". do nothing for now.', output_format="json"
    )
    if not res1.is_success:
        raise click.ClickException(f"First message failed: {res1.stderr}")

    # Message 2
    click.echo("Sending second message...")
    res2 = service.send_message("what's the name of my pet?", output_format="json")
    if not res2.is_success:
        raise click.ClickException(f"Second message failed: {res2.stderr}")

    click.echo(f"Agent response: {res2.stdout}")

    if secret.lower() in res2.stdout.lower():
        click.echo("Validation successful: Agent remembered the secret across messages.")
    else:
        click.echo("Validation warning: Agent did not clearly repeat the secret.")
