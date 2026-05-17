from __future__ import annotations

import hashlib
from pathlib import Path

import click

from cli.services.copilot_session import CopilotSessionService, SessionResult
from cli.services.project_config import ProjectConfig, TaskPromptConfig


def split_yaml_frontmatter(prompt_text: str) -> tuple[list[str], str]:
    """Split YAML frontmatter from prompt text.

    Returns:
        Tuple of (frontmatter_lines, prompt_body).
    """
    lines = prompt_text.splitlines()
    if not lines or lines[0].strip() != "---":
        return [], prompt_text

    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return lines[1:index], "\n".join(lines[index + 1 :])

    return [], prompt_text


def extract_frontmatter_agent(frontmatter_lines: list[str]) -> str | None:
    """Extract the 'agent' field from YAML frontmatter lines.

    Args:
        frontmatter_lines: List of YAML lines (without the --- delimiters).

    Returns:
        Agent name string or None if not found or empty.
    """
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


def calculate_file_digest(file_path: Path) -> bytes | None:
    """Return SHA-256 digest of file, or None if the file does not exist."""
    if not file_path.exists():
        return None
    with file_path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").digest()


def resolve_prompt_path(project_config: ProjectConfig, configured_path: str) -> Path:
    """Resolve a prompt path relative to the project config location.

    Args:
        project_config: Loaded project configuration.
        configured_path: Path string (absolute or relative).

    Returns:
        Resolved absolute Path.
    """
    path = Path(configured_path)
    if path.is_absolute():
        return path

    return project_config.path.parent / path


def load_prompt_file(prompt_path: Path) -> tuple[str, str | None]:
    """Load a prompt from a file and extract frontmatter.

    Args:
        prompt_path: Path to the prompt file.

    Returns:
        Tuple of (prompt_body, agent_name_or_none).
    """
    frontmatter_lines, prompt_body = split_yaml_frontmatter(prompt_path.read_text())
    return prompt_body.strip(), extract_frontmatter_agent(frontmatter_lines)


def load_configured_task_prompt(
    project_config: ProjectConfig,
    configured_prompt: TaskPromptConfig,
) -> tuple[str, str | None]:
    """Load a configured task prompt from inline text or file.

    Args:
        project_config: Loaded project configuration.
        configured_prompt: Task prompt configuration.

    Returns:
        Tuple of (prompt_body, agent_name_or_none).
    """
    if configured_prompt.kind == "inline":
        return (configured_prompt.text or "").strip(), configured_prompt.agent

    return load_prompt_file(resolve_prompt_path(project_config, configured_prompt.path or ""))


def load_task_prompt_config(
    project_config: ProjectConfig | None,
    task_name: str,
) -> tuple[str, str | None]:
    """Load a task prompt from config by task name.

    Args:
        project_config: Loaded project config (or None).
        task_name: Task name (e.g., "design", "discover").

    Returns:
        Tuple of (prompt_body, agent_name_or_none).

    Raises:
        ClickException: If config is None or task_name not in task_prompts.
    """
    if project_config is None:
        raise click.ClickException(f"No project config found for {task_name} prompt.")

    configured_prompt = project_config.task_prompts.get(task_name)
    if configured_prompt is None:
        msg = (
            f"{task_name} prompt configuration missing: "
            f"define task_prompts.{task_name} in the project config."
        )
        raise click.ClickException(msg)

    return load_configured_task_prompt(project_config, configured_prompt)


def send_task_message(
    copilot_session: CopilotSessionService,
    prompt: str,
    *,
    continue_session: bool = False,
) -> SessionResult:
    """Send a task message through the copilot session with error handling.

    Args:
        copilot_session: The copilot session service.
        prompt: The prompt/message to send.
        continue_session: Whether to continue the session.

    Returns:
        SessionResult from the copilot session.

    Raises:
        ClickException: If session response is not successful.
    """
    result = copilot_session.send_message(
        prompt,
        output_format="json",
        continue_session=continue_session,
    )
    if not result.is_success:
        detail = result.stderr.strip() or "Task request failed."
        raise click.ClickException(f"Task request failed: {detail}")
    return result
