from __future__ import annotations

from pathlib import Path

import click

from cli.services.copilot_session import (
    PERMISSIVE_TOOLSET,
    CopilotSessionService,
    SessionResult,
)
from cli.services.project_config import (
    ProjectConfig,
    TaskPromptConfig,
    load_project_config,
)

from .command_context import build_command_context
from .experiment import format_experiment_context, get_experiment_count

DEFAULT_MODEL = "gpt-5-mini"


def run_design(brief: str | None, config_path: str | None = None) -> None:
    """Generate and submit an experiment design through the registry CLI."""
    project_config = load_project_config(config_path, required=False)
    prompt_body, prompt_agent = _resolve_design_prompt(project_config)
    command_context = build_command_context(
        config_path=project_config.path if project_config is not None else config_path,
        required=False,
        model=DEFAULT_MODEL,
        toolset=PERMISSIVE_TOOLSET,
        agent=prompt_agent,
    )
    experiment_count_before = get_experiment_count()
    prompt = _build_design_prompt(brief, format_experiment_context(), prompt_body)
    copilot_session = command_context.copilot_session
    result = _send_design_message(copilot_session, prompt)

    if get_experiment_count() <= experiment_count_before:
        follow_up_prompt = _build_retry_prompt()
        result = _send_design_message(
            copilot_session,
            follow_up_prompt,
            continue_session=True,
        )
        if get_experiment_count() <= experiment_count_before:
            raise click.ClickException(
                "Design agent did not create a new experiment after one retry."
            )

    output_text = result.stdout.strip()
    if output_text:
        click.echo(output_text)
    else:
        click.echo(f"Submitted design request using agentic CLI: {copilot_session.alias}")


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


def _resolve_design_prompt(project_config: ProjectConfig | None) -> tuple[str, str | None]:
    if project_config is None:
        raise click.ClickException(
            "Design prompt configuration missing: define task_prompts.design in the project config."
        )

    configured_prompt = project_config.task_prompts.get("design")
    if configured_prompt is None:
        raise click.ClickException(
            "Design prompt configuration missing: define task_prompts.design in the project config."
        )

    return _load_configured_design_prompt(project_config, configured_prompt)


def _load_configured_design_prompt(
    project_config: ProjectConfig,
    configured_prompt: TaskPromptConfig,
) -> tuple[str, str | None]:
    if configured_prompt.kind == "inline":
        return (configured_prompt.text or "").strip(), configured_prompt.agent

    return _load_design_prompt(_resolve_prompt_path(project_config, configured_prompt.path or ""))


def _resolve_prompt_path(project_config: ProjectConfig, configured_path: str) -> Path:
    path = Path(configured_path)
    if path.is_absolute():
        return path

    return project_config.path.parent / path


def _load_design_prompt(prompt_path: Path) -> tuple[str, str | None]:
    frontmatter_lines, prompt_body = _split_yaml_frontmatter(prompt_path.read_text())
    return prompt_body.strip(), _extract_frontmatter_agent(frontmatter_lines)


def _split_yaml_frontmatter(prompt_text: str) -> tuple[list[str], str]:
    lines = prompt_text.splitlines()
    if not lines or lines[0].strip() != "---":
        return [], prompt_text

    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return lines[1:index], "\n".join(lines[index + 1 :])

    return [], prompt_text


def _extract_frontmatter_agent(frontmatter_lines: list[str]) -> str | None:
    for line in frontmatter_lines:
        key, separator, value = line.partition(":")
        if separator != ":" or key.strip() != "agent":
            continue

        stripped_value = value.strip()
        if not stripped_value:
            return None

        if stripped_value[:1] in {'"', "'"} and stripped_value[-1:] == stripped_value[:1]:
            stripped_value = stripped_value[1:-1].strip()

        return stripped_value or None

    return None


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
    copilot_session: CopilotSessionService,
    prompt: str,
    *,
    continue_session: bool = False,
) -> SessionResult:
    result = copilot_session.send_message(
        prompt,
        output_format="json",
        continue_session=continue_session,
    )
    if not result.is_success:
        detail = result.stderr.strip() or "Design request failed."
        raise click.ClickException(f"Design request failed: {detail}")
    return result
