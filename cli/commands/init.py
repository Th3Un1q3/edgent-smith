from __future__ import annotations

import os
import re

import click

from cli.services.copilot_session import CopilotSessionService


def run_init(name: str) -> None:
    """Logic for the autoresearch init command."""
    if not name.strip():
        raise click.ClickException("Project name cannot be empty.")

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise click.ClickException("Project name contains invalid characters.")

    filename = f"{name}.config.toml"

    if os.path.exists(filename):
        raise click.ClickException(f"Configuration file {filename} already exists.")

    # Configuration values
    cli_type = "copilot_cli"
    cli_alias = "copilot"

    # Verification of agentic CLI
    click.echo(f"Verifying agentic CLI ({cli_alias}) installation and authentication...")

    service = CopilotSessionService(alias=cli_alias, model="gpt-5-mini")
    result = service.send_message("hi")

    if not result.is_success:
        error_detail = result.stderr.strip() or "Verification check failed."
        raise click.ClickException(
            f"Agentic CLI verification failed for alias '{cli_alias}'. Details: {error_detail}"
        )

    with open(filename, "w") as f:
        f.write(f'name = "{name}"\n')
        f.write(f'agentic_cli_type = "{cli_type}"\n')
        f.write(f"agentic_cli_alias = '{cli_alias}'\n")
    click.echo(f"Created project configuration: {filename}")
