from __future__ import annotations

import click

from cli.services.copilot_session import DISCOVER_TOOLSET
from cli.services.hf_papers import fetch_papers, format_papers_context
from cli.services.project_config import load_project_config

from .command_context import build_command_context
from .task_runner import (
    calculate_file_digest,
    load_task_prompt_config,
    send_task_message,
)

DEFAULT_MODEL = "gpt-5-mini"


def run_discover(config_path: str | None = None) -> None:
    """Refresh docs/ideas.md from the latest edge-relevant agentic papers."""
    project_config = load_project_config(config_path, required=False)
    if project_config is None:
        raise click.ClickException("No project config found for discover prompt.")

    prompt_body, prompt_agent = load_task_prompt_config(project_config, "discover")

    papers_context = format_papers_context(fetch_papers())
    full_prompt = f"{prompt_body}\n\n---\n\n## Pre-fetched paper search results\n\n{papers_context}"

    command_context = build_command_context(
        config_path=project_config.path,
        required=False,
        model=DEFAULT_MODEL,
        toolset=DISCOVER_TOOLSET,
        agent=prompt_agent,
    )
    copilot_session = command_context.copilot_session

    ideas_path = project_config.path.parent / "docs" / "ideas.md"
    digest_before = calculate_file_digest(ideas_path)

    result = send_task_message(copilot_session, full_prompt)

    if calculate_file_digest(ideas_path) == digest_before:
        follow_up = _build_discover_retry_prompt()
        result = send_task_message(copilot_session, follow_up, continue_session=True)
        if calculate_file_digest(ideas_path) == digest_before:
            raise click.ClickException(
                "Discover agent did not update docs/ideas.md after one retry."
            )

    output_text = result.stdout.strip()
    if output_text:
        click.echo(output_text)
    else:
        click.echo(f"Submitted discover request using agentic CLI: {copilot_session.alias}")


def _build_discover_retry_prompt() -> str:
    return "\n\n".join(
        [
            "You must update docs/ideas.md now.",
            "The file was not changed in your previous response.",
            "Add, revise, or consolidate at least one idea entry backed by a paper you reviewed.",
            "Do not reply without writing to docs/ideas.md.",
        ]
    )
