from __future__ import annotations

import os
import secrets
import tomllib

import click

from cli.services.copilot_session import CopilotSessionService


def run_validate() -> None:
    """Logic for the autoresearch validate command."""
    # Find config file
    config_files = [f for f in os.listdir(".") if f.endswith(".config.toml")]
    if not config_files:
        raise click.ClickException("No .config.toml file found in the current directory.")

    config_path = config_files[0]
    click.echo(f"Found configuration: {config_path}")

    with open(config_path, "rb") as f:
        config = tomllib.load(f)

    name = config.get("name", "unknown")
    cli_alias = config.get("agentic_cli_alias", "copilot")

    click.echo(f"Validating project '{name}' using agentic CLI: {cli_alias}")

    service = CopilotSessionService(alias=cli_alias, model="gpt-5-mini")

    # Generate a random secret for testing (e.g., using uuid4 or a random string)
    secret = "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))

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
