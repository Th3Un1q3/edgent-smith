from __future__ import annotations

import os
import subprocess
from typing import Annotated

import click
from pydantic import BaseModel, StringConstraints, ValidationError

from cli.services.copilot_session import CopilotSessionService
from cli.services.project_config import (
    DEFAULT_AGENTIC_CLI_ALIAS,
    DEFAULT_AGENTIC_CLI_TYPE,
    DEFAULT_BASELINE_EVAL_MODEL,
    project_config_filename,
    render_project_config,
)

_IDENTIFIER_PATTERN = r"^[a-zA-Z0-9_-]+$"

IdentifierInput = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, pattern=_IDENTIFIER_PATTERN),
]


class InitCommandInputs(BaseModel):
    name: IdentifierInput
    baseline_id: IdentifierInput
    eval_model: IdentifierInput


def run_init(
    name: str,
    *,
    baseline_id: str | None = None,
    eval_model: str = DEFAULT_BASELINE_EVAL_MODEL,
) -> None:
    """Logic for the autoresearch init command."""
    try:
        inputs = InitCommandInputs.model_validate(
            {
                "name": name,
                "baseline_id": baseline_id if baseline_id is not None else name,
                "eval_model": eval_model,
            }
        )
    except ValidationError as exc:
        raise click.ClickException(_render_validation_error(exc)) from None

    resolved_baseline_id = inputs.baseline_id

    filename = project_config_filename(inputs.name)

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
        f.write(
            render_project_config(
                inputs.name,
                cli_type=cli_type,
                cli_alias=cli_alias,
                baseline_id=resolved_baseline_id,
                baseline_eval_model=inputs.eval_model,
            )
        )
    click.echo(f"Created project configuration: {filename}")


def _render_validation_error(exc: ValidationError) -> str:
    first_error = exc.errors()[0]
    error_location = first_error["loc"]
    error_type = first_error["type"]

    if error_location == ("name",):
        if error_type == "string_too_short":
            return "Project name cannot be empty."
        if error_type == "string_pattern_mismatch":
            return "Project name contains invalid characters."

    if error_location == ("baseline_id",):
        if error_type == "string_too_short":
            return "Baseline ID cannot be empty."
        if error_type == "string_pattern_mismatch":
            return "Baseline ID contains invalid characters."

    if error_location == ("eval_model",):
        if error_type == "string_too_short":
            return "Evaluation model cannot be empty."
        if error_type == "string_pattern_mismatch":
            return "Evaluation model contains invalid characters."

    message = first_error["msg"]
    value_error_prefix = "Value error, "
    if message.startswith(value_error_prefix):
        return message[len(value_error_prefix) :]
    return message
