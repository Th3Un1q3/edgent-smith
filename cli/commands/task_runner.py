from __future__ import annotations

import hashlib
import re
from pathlib import Path

import click

from cli.services.copilot_session import CopilotSessionService, SessionResult
from cli.services.project_config import ProjectConfig, TaskPromptConfig

NON_RETRIABLE_AGENT_ERROR_PATTERNS = (
    re.compile(r"\brate[_ -]?limit\b", re.IGNORECASE),
    re.compile(r"\b429\b", re.IGNORECASE),
    re.compile(r"\bquota\s+exceeded\b", re.IGNORECASE),
)


def calculate_file_digest(file_path: Path) -> bytes | None:
    """Return SHA-256 digest of file, or None if the file does not exist."""
    if not file_path.exists():
        return None
    with file_path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").digest()


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
    configured_prompt = get_task_prompt(project_config, task_name)
    return configured_prompt.prompt, configured_prompt.agent


def get_task_prompt(project_config: ProjectConfig | None, task_name: str) -> TaskPromptConfig:
    """Return task prompt config for a task name."""
    if project_config is None:
        raise click.ClickException(f"No project config found for {task_name} prompt.")

    configured_prompt = project_config.task_prompts.get(task_name)
    if configured_prompt is None:
        msg = (
            f"{task_name} prompt configuration missing: "
            f"define task_prompts.{task_name} in the project config."
        )
        raise click.ClickException(msg)

    return configured_prompt


def get_task_rescue_prompt(
    project_config: ProjectConfig | None,
    task_name: str,
    *,
    fallback: str,
) -> str:
    """Return configured rescue prompt for a task, or fallback text."""
    resque_prompt = get_task_prompt(project_config, task_name).resque_prompt
    if resque_prompt is None:
        return fallback
    return resque_prompt


def is_non_retriable_agent_error_text(text: str) -> bool:
    """Return True when output looks like a non-retriable agent/provider error."""
    return any(pattern.search(text) is not None for pattern in NON_RETRIABLE_AGENT_ERROR_PATTERNS)


def non_retriable_agent_error_detail(result: SessionResult) -> str | None:
    """Return matching error detail when output appears to be non-retriable."""
    combined_output = "\n".join(
        part.strip() for part in (result.stdout, result.stderr) if part.strip()
    )
    if not combined_output:
        return None
    if is_non_retriable_agent_error_text(combined_output):
        return combined_output
    return None


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
