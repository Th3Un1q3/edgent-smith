from __future__ import annotations

import click

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


def main() -> None:
    cli()
