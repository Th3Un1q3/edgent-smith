from __future__ import annotations

import click

from cli.commands.fix import run_fix
from cli.commands.init import run_init
from cli.commands.validate import run_validate


@click.group()
def cli() -> None:
    """Command line interface for edgent-smith."""
    pass


@cli.command()
@click.option("--name", default="world", help="Name to greet.")
def hello(name: str) -> None:
    """Print a friendly greeting."""
    click.echo(f"Hello, {name}!")


@cli.group()
def autoresearch() -> None:
    """Auto-research related commands."""
    pass


@autoresearch.command()
@click.option("--name", required=True, help="Internal name for the project configuration.")
def init(name: str) -> None:
    """Initialize a new auto-research project configuration."""
    run_init(name)


@autoresearch.command()
def validate() -> None:
    """Validate the agentic CLI environment and session persistence."""
    run_validate()


@autoresearch.command()
@click.option(
    "--autofix-config",
    default="autofix.toml",
    show_default=True,
    help="Path to the TOML workflow config that defines autofix hooks.",
)
@click.option(
    "--continue",
    "continue_session",
    is_flag=True,
    help="Resume the first Copilot fallback turn from the prior CLI session when available.",
)
@click.option(
    "--parallel",
    is_flag=True,
    help=(
        "Run the first validation pass for all autofix hooks concurrently before "
        "one batched remediation turn."
    ),
)
def fix(autofix_config: str, continue_session: bool, parallel: bool) -> None:
    """Run the config-driven staged autofix workflow."""
    run_fix(autofix_config, continue_session=continue_session, parallel=parallel)


def main() -> None:
    cli()
