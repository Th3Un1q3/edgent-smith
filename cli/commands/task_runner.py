from __future__ import annotations

import hashlib
import re
from collections.abc import Callable
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
        continue_session=continue_session,
    )
    if not result.is_success:
        detail = result.stderr.strip() or "Task request failed."
        raise click.ClickException(f"Task request failed: {detail}")
    return result


def run_task_with_retry(
    task_name: str,
    copilot_session: CopilotSessionService,
    prompt: str,
    retry_prompt: str,
    success_check: Callable[[], bool],
    failure_message: str,
    *,
    transcript_path: Path | None = None,
    non_retriable_error_prefix: str | None = None,
) -> SessionResult:
    """Send a task prompt once, then retry once in the same session if needed."""
    _emit_task_progress(
        task_name,
        phase="send",
        attempt=1,
        total_attempts=2,
        message="running agent with the prompt",
    )
    result = send_task_message(copilot_session, prompt)
    _append_task_transcript(transcript_path, task_name, 1, prompt, result)

    if success_check():
        _emit_task_progress(
            task_name,
            phase="success",
            attempt=1,
            total_attempts=2,
            message="success",
        )
        return result

    non_retriable_error = non_retriable_agent_error_detail(result)
    if non_retriable_error is not None and non_retriable_error_prefix is not None:
        _emit_task_progress(
            task_name,
            phase="failure",
            attempt=1,
            total_attempts=2,
            message="failed with non-retriable provider error",
        )
        raise click.ClickException(f"{non_retriable_error_prefix}: {non_retriable_error}")

    _emit_task_progress(
        task_name,
        phase="retry",
        attempt=1,
        total_attempts=2,
        message="retry requested after first attempt",
    )
    _emit_task_progress(
        task_name,
        phase="send",
        attempt=2,
        total_attempts=2,
        message="running agent with the prompt again in same session",
    )
    result = send_task_message(
        copilot_session,
        retry_prompt,
        continue_session=True,
    )
    _append_task_transcript(transcript_path, task_name, 2, retry_prompt, result)

    if success_check():
        _emit_task_progress(
            task_name,
            phase="success",
            attempt=2,
            total_attempts=2,
            message="success",
        )
        return result

    _emit_task_progress(
        task_name,
        phase="failure",
        attempt=2,
        total_attempts=2,
        message="failed after retry",
    )
    raise click.ClickException(failure_message)


def _emit_task_progress(
    task_name: str,
    *,
    phase: str,
    attempt: int,
    total_attempts: int,
    message: str,
) -> None:
    progress_message = (
        f"[task={task_name} phase={phase} attempt={attempt}/{total_attempts}] {message}"
    )
    try:
        click.echo(progress_message, err=True)
    except TypeError:
        click.echo(progress_message)


def _append_task_transcript(
    transcript_path: Path | None,
    task_name: str,
    turn_number: int,
    prompt: str,
    result: SessionResult,
) -> None:
    if transcript_path is None:
        return

    transcript_path.parent.mkdir(parents=True, exist_ok=True)
    transcript_path.open("a", encoding="utf-8").write(
        "\n".join(
            [
                f"## {task_name} turn {turn_number}",
                "Prompt:",
                _format_transcript_text(prompt),
                "",
                "Assistant output:",
                _format_transcript_text(result.stdout),
                "",
                "Session stderr:",
                _format_transcript_text(result.stderr),
                "",
            ]
        )
    )


def _format_transcript_text(text: str) -> str:
    normalized = text.rstrip()
    if normalized:
        return normalized
    return "(empty)"
