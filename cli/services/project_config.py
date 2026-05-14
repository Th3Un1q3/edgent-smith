from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

import click

PROJECT_CONFIG_SUFFIX = ".config.toml"
DEFAULT_AGENTIC_CLI_TYPE = "copilot_cli"
DEFAULT_AGENTIC_CLI_ALIAS = "copilot"
DEFAULT_BASELINE_EVAL_MODEL = "edge_agent_default"


@dataclass(frozen=True)
class ProjectConfig:
    path: Path
    name: str
    agentic_cli_type: str
    agentic_cli_alias: str
    baseline_id: str
    baseline_eval_model: str


def project_config_filename(name: str) -> str:
    return f"{name}{PROJECT_CONFIG_SUFFIX}"


def render_project_config(
    name: str,
    *,
    cli_type: str = DEFAULT_AGENTIC_CLI_TYPE,
    cli_alias: str = DEFAULT_AGENTIC_CLI_ALIAS,
    baseline_id: str | None = None,
    baseline_eval_model: str = DEFAULT_BASELINE_EVAL_MODEL,
) -> str:
    resolved_baseline_id = baseline_id or name
    return (
        "\n".join(
            [
                f'name = "{name}"',
                f'agentic_cli_type = "{cli_type}"',
                f'agentic_cli_alias = "{cli_alias}"',
                "",
                "[baseline]",
                f'id = "{resolved_baseline_id}"',
                f'eval_model = "{baseline_eval_model}"',
            ]
        )
        + "\n"
    )


def load_project_config(
    config_path: str | Path | None = None,
    *,
    required: bool,
) -> ProjectConfig | None:
    resolved_path = _resolve_project_config_path(config_path, required=required)
    if resolved_path is None:
        return None

    try:
        with resolved_path.open("rb") as config_file:
            raw_config = tomllib.load(config_file)
    except tomllib.TOMLDecodeError as exc:
        raise click.ClickException(f"Invalid project config: {exc}") from exc

    if not isinstance(raw_config, dict):
        raise click.ClickException("Invalid project config: expected a TOML table.")

    baseline_config = raw_config.get("baseline")
    if not isinstance(baseline_config, dict):
        baseline_config = {}

    resolved_name = _string_value(raw_config.get("name"), fallback="unknown")

    return ProjectConfig(
        path=resolved_path,
        name=resolved_name,
        agentic_cli_type=_string_value(
            raw_config.get("agentic_cli_type"),
            fallback=DEFAULT_AGENTIC_CLI_TYPE,
        ),
        agentic_cli_alias=_string_value(
            raw_config.get("agentic_cli_alias"),
            fallback=DEFAULT_AGENTIC_CLI_ALIAS,
        ),
        baseline_id=_string_value(
            baseline_config.get("id"),
            fallback=resolved_name,
        ),
        baseline_eval_model=_string_value(
            baseline_config.get("eval_model"),
            fallback=DEFAULT_BASELINE_EVAL_MODEL,
        ),
    )


def _resolve_project_config_path(
    config_path: str | Path | None,
    *,
    required: bool,
) -> Path | None:
    if config_path is not None:
        explicit_path = Path(config_path)
        if not explicit_path.is_file():
            raise click.ClickException(f"Project config not found: {explicit_path}")
        return explicit_path

    discovered_paths = sorted(Path.cwd().glob(f"*{PROJECT_CONFIG_SUFFIX}"))
    if discovered_paths:
        return discovered_paths[0]

    if required:
        raise click.ClickException("No .config.toml file found in the current directory.")

    return None


def _string_value(value: object, *, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback
