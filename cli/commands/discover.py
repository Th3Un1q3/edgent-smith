from __future__ import annotations

from pathlib import Path

import click

from cli.services.copilot_session import DISCOVER_TOOLSET
from cli.services.hf_papers import fetch_papers, format_papers_context
from cli.services.project_config import load_project_config

from .command_context import build_command_context
from .task_runner import (
    calculate_file_digest,
    get_task_rescue_prompt,
    load_task_prompt_config,
    non_retriable_agent_error_detail,
    send_task_message,
)

DEFAULT_MODEL = "gpt-5-mini"
DISCOVER_CACHE_PATH = Path(".cache/discover/hf_papers.md")


def run_discover(config_path: str | None = None) -> None:
    """Refresh docs/ideas.md from the latest edge-relevant agentic papers."""
    project_config = load_project_config(config_path, required=False)
    if project_config is None:
        raise click.ClickException(
            "Project config not found. Run this command from a project directory containing "
            ".config.toml or pass a config path with --config."
        )
    prompt_body, prompt_agent = load_task_prompt_config(project_config, "discover")

    papers_context = format_papers_context(fetch_papers())
    papers_cache_path = project_config.path.parent / DISCOVER_CACHE_PATH
    papers_cache_path.parent.mkdir(parents=True, exist_ok=True)
    papers_cache_path.write_text(papers_context)

    full_prompt = "\n\n".join(
        [
            prompt_body,
            (
                "Cached Hugging Face paper search results are stored at "
                f"{DISCOVER_CACHE_PATH.as_posix()}."
            ),
            "Read that file before updating docs/ideas.md.",
        ]
    )

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
        non_retriable_error = non_retriable_agent_error_detail(result)
        if non_retriable_error is not None:
            raise click.ClickException(
                "Discover agent returned a non-retriable provider error without retry: "
                f"{non_retriable_error}"
            )

        follow_up = get_task_rescue_prompt(
            project_config,
            "discover",
            fallback=_build_discover_retry_prompt(),
        )
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
