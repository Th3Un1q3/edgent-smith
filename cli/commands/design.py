from __future__ import annotations

import click

from cli.services.copilot_session import (
    PERMISSIVE_TOOLSET,
    CopilotSessionService,
    SessionResult,
)

from .command_context import build_command_context
from .experiment import format_experiment_context, get_experiment_count

DEFAULT_MODEL = "gpt-5-mini"
EDGE_ARCHITECT_AGENT = "edge-architect"


def run_design(brief: str | None, config_path: str | None = None) -> None:
    """Generate and submit an experiment design through the registry CLI."""
    context = build_command_context(
        config_path=config_path,
        required=False,
        model=DEFAULT_MODEL,
        toolset=PERMISSIVE_TOOLSET,
        agent=EDGE_ARCHITECT_AGENT,
    )
    experiment_count_before = get_experiment_count()
    prompt = _build_design_prompt(brief, format_experiment_context())
    service = context.service
    result = _send_design_message(service, prompt)

    if get_experiment_count() <= experiment_count_before:
        follow_up_prompt = _build_retry_prompt()
        result = _send_design_message(service, follow_up_prompt, continue_session=True)
        if get_experiment_count() <= experiment_count_before:
            raise click.ClickException(
                "Design agent did not create a new experiment after one retry."
            )

    if result.stdout.strip():
        click.echo(result.stdout.strip())
    else:
        click.echo(f"Submitted design request using agentic CLI: {service.alias}")


def _build_design_prompt(brief: str | None, experiment_context: str) -> str:
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
            "Design exactly one experiment specification for this repository.",
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


def _send_design_message(
    service: CopilotSessionService,
    prompt: str,
    *,
    continue_session: bool = False,
) -> SessionResult:
    result = service.send_message(prompt, output_format="json", continue_session=continue_session)
    if not result.is_success:
        detail = result.stderr.strip() or "Design request failed."
        raise click.ClickException(f"Design request failed: {detail}")
    return result
