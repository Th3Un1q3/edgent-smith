from __future__ import annotations

import click

from cli.commands.design import run_design
from cli.commands.experiment import (
    run_experiment_create,
    run_experiment_finish,
    run_experiment_list,
    run_experiment_show,
    run_experiment_start,
)
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
@click.option(
    "--baseline-id",
    help="Baseline identifier to store in the config. Defaults to the project name.",
)
@click.option(
    "--eval-model",
    default="edge_agent_default",
    show_default=True,
    help="Evaluation model alias stored in the config baseline section.",
)
def init(name: str, baseline_id: str | None, eval_model: str) -> None:
    """Initialize a new auto-research project configuration."""
    run_init(name, baseline_id=baseline_id, eval_model=eval_model)


@autoresearch.command()
@click.option(
    "--config",
    "config_path",
    help=(
        "Path to the project .config.toml file. When omitted, validate auto-discovers "
        "the lexicographically first *.config.toml file in the current directory."
    ),
)
def validate(config_path: str | None) -> None:
    """Validate the agentic CLI environment and session persistence."""
    run_validate(config_path=config_path)


@autoresearch.command()
@click.argument("brief", required=False)
@click.option(
    "--config",
    "config_path",
    help="Path to the project .config.toml file. Defaults to auto-discovery.",
)
def design(brief: str | None, config_path: str | None) -> None:
    """Generate or refine an experiment design specification."""
    run_design(brief, config_path=config_path)


@autoresearch.command()
@click.option(
    "--config",
    "config_path",
    help="Path to the project .config.toml file. Defaults to auto-discovery.",
)
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
def fix(
    config_path: str | None,
    autofix_config: str,
    continue_session: bool,
    parallel: bool,
) -> None:
    """Run the config-driven staged autofix workflow."""
    run_fix(
        autofix_config,
        config_path=config_path,
        continue_session=continue_session,
        parallel=parallel,
    )


@autoresearch.group()
def experiment() -> None:
    """Manage local experiment registry CRUD only.

    This command does not run experiment execution.

    create uses named inputs; start, finish, and show use positional
    experiment_id values; list remains the non-targeting exception.
    """
    pass


@experiment.command("create")
@click.option("--title", required=True, help="Human-readable experiment title.")
@click.option("--description", required=True, help="Experiment description.")
def experiment_create(title: str, description: str) -> None:
    """Create a pending experiment."""
    run_experiment_create(title, description)


@experiment.command("start")
@click.argument("experiment_id")
@click.option("--baseline-id", required=True, help="Baseline identifier captured for the run.")
@click.option("--before-score", required=True, type=float, help="Baseline score before the run.")
@click.option("--rerun-of", "rerun_of_run_id", help="Link the new run to a prior run ID.")
def experiment_start(
    experiment_id: str,
    baseline_id: str,
    before_score: float,
    rerun_of_run_id: str | None,
) -> None:
    """Start a new run for an experiment."""
    run_experiment_start(experiment_id, baseline_id, before_score, rerun_of_run_id)


@experiment.command("finish")
@click.argument("experiment_id")
@click.option(
    "--status",
    "run_status",
    required=True,
    type=click.Choice(["completed", "failed", "cancelled"], case_sensitive=True),
    help="Terminal status for the current run.",
)
@click.option("--after-score", type=float, help="Score after a completed run.")
def experiment_finish(
    experiment_id: str,
    run_status: str,
    after_score: float | None,
) -> None:
    """Finish the current run for an experiment."""
    run_experiment_finish(experiment_id, run_status, after_score)


@experiment.command("list")
@click.option(
    "--status",
    type=click.Choice(["pending", "running", "completed"], case_sensitive=True),
    help="Filter by experiment status.",
)
@click.option("--baseline-id", help="Filter experiments by run baseline ID.")
@click.option(
    "--outcome",
    type=click.Choice(["improved", "regressed", "no_change"], case_sensitive=True),
    help="Filter experiments by run outcome.",
)
@click.option("--limit", type=click.IntRange(min=1), help="Maximum number of experiments.")
@click.option(
    "--sort",
    type=click.Choice(["asc", "desc"], case_sensitive=True),
    default="desc",
    show_default=True,
    help="Sort direction.",
)
@click.option(
    "--sort-by",
    type=click.Choice(["created_at", "updated_at"], case_sensitive=True),
    default="updated_at",
    show_default=True,
    help="Timestamp field used for sorting.",
)
def experiment_list(
    status: str | None,
    baseline_id: str | None,
    outcome: str | None,
    limit: int | None,
    sort: str,
    sort_by: str,
) -> None:
    """List experiments from the local registry."""
    run_experiment_list(status, baseline_id, outcome, limit, sort, sort_by)


@experiment.command("show")
@click.argument("experiment_id")
def experiment_show(experiment_id: str) -> None:
    """Show full details for one experiment."""
    run_experiment_show(experiment_id)


def main() -> None:
    cli()
