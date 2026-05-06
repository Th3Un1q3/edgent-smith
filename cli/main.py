from __future__ import annotations

import click


@click.group()
def cli() -> None:
    """Command line interface for edgent-smith."""
    pass


@cli.command()
@click.option("--name", default="world", help="Name to greet.")
def hello(name: str) -> None:
    """Print a friendly greeting."""
    click.echo(f"Hello, {name}!")


def main() -> None:
    cli()
