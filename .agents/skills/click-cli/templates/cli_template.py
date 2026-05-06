from __future__ import annotations

import click


@click.group()
@click.option("--debug/--no-debug", default=False, help="Enable debug mode.")
@click.pass_context
def cli(ctx, debug: bool) -> None:
    """Root command group for the CLI.

    Stores shared state in `ctx.obj` and enables an optional debug flag.
    """
    ctx.ensure_object(dict)
    ctx.obj["DEBUG"] = debug
    if debug:
        click.echo("Debug mode is on")


@cli.command()
@click.option("--name", default="world", help="Name to greet.")
@click.pass_context
def hello(ctx, name: str) -> None:
    """Print a friendly greeting."""
    click.echo(f"Hello, {name}!")


@cli.command()
@click.option("--count", default=1, type=int, help="Number of repeats.")
@click.argument("text", type=str)
@click.pass_context
def repeat(ctx, count: int, text: str) -> None:
    """Repeat a given text multiple times."""
    for _ in range(count):
        click.echo(text)


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
