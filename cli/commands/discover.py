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
    run_task_with_retry,
)

DEFAULT_MODEL = "gpt-5-mini"
DISCOVER_CACHE_PATH = Path(".cache/discover/hf_papers.md")


def run_discover(
    config_path: str | None = None,
    transcript_file: str | None = None,
) -> None:
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
            "Use cached file to get latest relevant papers quickly.",
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
    result = run_task_with_retry(
        task_name="discover",
        copilot_session=copilot_session,
        prompt=full_prompt,
        retry_prompt=get_task_rescue_prompt(
            project_config,
            "discover",
            fallback=_build_discover_retry_prompt(),
        ),
        success_check=lambda: calculate_file_digest(ideas_path) != digest_before,
        failure_message="Discover agent did not update docs/ideas.md after one retry.",
        transcript_path=Path(transcript_file) if transcript_file is not None else None,
        non_retriable_error_prefix=(
            "Discover agent returned a non-retriable provider error without retry"
        ),
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
