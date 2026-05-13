from __future__ import annotations

import os
import re
import subprocess

import click

from cli.services.copilot_session import CopilotSessionService
from cli.services.project_config import (
    DEFAULT_AGENTIC_CLI_ALIAS,
    DEFAULT_AGENTIC_CLI_TYPE,
    project_config_filename,
    render_project_config,
)


def run_init(name: str) -> None:
    """Logic for the autoresearch init command."""
    if not name.strip():
        raise click.ClickException("Project name cannot be empty.")

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise click.ClickException("Project name contains invalid characters.")

    filename = project_config_filename(name)

    if os.path.exists(filename):
        raise click.ClickException(f"Configuration file {filename} already exists.")

    # Configuration values
    cli_type = DEFAULT_AGENTIC_CLI_TYPE
    cli_alias = DEFAULT_AGENTIC_CLI_ALIAS

    # Verification of agentic CLI
    click.echo(f"Verifying agentic CLI ({cli_alias}) installation...")

    while True:
        try:
            subprocess.run([cli_alias, "--version"], capture_output=True, check=True)
            break
        except (subprocess.CalledProcessError, FileNotFoundError):
            install_cmd = (
                "npm install -g @github/copilot"
                if cli_alias == "copilot"
                else f"Check installation for {cli_alias}"
            )
            if click.confirm(
                f"Agentic CLI '{cli_alias}' not found. "
                "Do you want to try providing a different alias?",
                default=True,
            ):
                cli_alias = click.prompt("Enter the correct CLI alias")
                continue
            else:
                click.echo(f"To install the GitHub Copilot CLI, run:\n  {install_cmd}")
                raise click.ClickException(f"Missing required tool: {cli_alias}") from None

    click.echo(f"Verifying authentication for {cli_alias}...")
    service = CopilotSessionService(alias=cli_alias)
    result = service.send_message("Simply respond with 'OK'", output_format="json")

    if not result.is_success:
        error_detail = result.stderr.strip() or "Verification check failed."
        raise click.ClickException(
            f"Agentic CLI verification failed for alias '{cli_alias}'. Details: {error_detail}"
        )

    with open(filename, "w") as f:
        f.write(render_project_config(name, cli_type=cli_type, cli_alias=cli_alias))
    click.echo(f"Created project configuration: {filename}")
