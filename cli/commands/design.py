from __future__ import annotations

from pathlib import Path

import click

from cli.services.copilot_session import PERMISSIVE_TOOLSET
from cli.services.project_config import load_project_config

from .command_context import build_command_context
from .experiment import format_experiment_context, get_experiment_count
from .task_runner import (
    get_task_rescue_prompt,
    load_task_prompt_config,
    run_task_with_retry,
)

DEFAULT_MODEL = "gpt-5-mini"


def run_design(
    brief: str | None,
    config_path: str | None = None,
    transcript_file: str | None = None,
) -> None:
    """Generate and submit an experiment design through the registry CLI."""
    project_config = load_project_config(config_path, required=False)
    prompt_body, prompt_agent = load_task_prompt_config(project_config, "design")
    command_context = build_command_context(
        config_path=project_config.path if project_config is not None else config_path,
        required=False,
        model=DEFAULT_MODEL,
        toolset=PERMISSIVE_TOOLSET,
        agent=prompt_agent,
    )
    experiment_count_before = get_experiment_count()
    prompt = _build_design_prompt(brief, format_experiment_context(), prompt_body)
    result = run_task_with_retry(
        task_name="design",
        copilot_session=command_context.copilot_session,
        prompt=prompt,
        retry_prompt=get_task_rescue_prompt(
            project_config,
            "design",
            fallback=_build_retry_prompt(),
        ),
        success_check=lambda: get_experiment_count() > experiment_count_before,
        failure_message="Design agent did not create a new experiment after one retry.",
        transcript_path=Path(transcript_file) if transcript_file is not None else None,
        non_retriable_error_prefix=(
            "Design agent returned a non-retriable provider error without retry"
        ),
    )

    output_text = result.stdout.strip()
    if output_text:
        click.echo(output_text)
    else:
        click.echo(
            f"Submitted design request using agentic CLI: {command_context.copilot_session.alias}"
        )


def _build_design_prompt(brief: str | None, experiment_context: str, base_prompt: str) -> str:
    if brief is None:
        brief_section = "\n\n".join(
            [
                "Choose exactly one experiment topic yourself.",
                "Inspect docs/ideas.md first as the primary source of candidate directions.",
                (
                    "You may also inspect current repository code and docs, and relevant "
                    "library docs if they suggest a stronger experiment."
                ),
            ]
        )
    else:
        brief_section = f"User brief: {brief}"

    return "\n\n".join(
        [
            base_prompt,
            brief_section,
            "Local experiment context from the registry:",
            experiment_context,
            (
                "Create exactly one new experiment with "
                '`just autoresearch experiment create --title "<title>" '
                '--description "<markdown body>"`.'
            ),
            "Do not use the legacy candidate-file workflow.",
            "Use the existing repository workflow and keep the change minimal.",
        ]
    )


def _build_retry_prompt() -> str:
    return "\n\n".join(
        [
            "You must submit exactly one experiment now.",
            (
                'Create it with `just autoresearch experiment create --title "<title>" '
                '--description "<markdown body>"` in this repository.'
            ),
            "Do not reply without submitting the experiment.",
        ]
    )
