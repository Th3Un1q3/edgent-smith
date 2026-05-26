from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import cast

import click
import pytest

from cli.commands import task_runner
from cli.commands.task_runner import is_non_retriable_agent_error_text
from cli.services.copilot_session import CopilotSessionService, SessionResult
from cli.services.project_config import ProjectConfig, TaskPromptConfig

_PROGRESS_SCHEMA = re.compile(
    r"^\[task=(?P<task>[a-z0-9_-]+) "
    r"phase=(?P<phase>[a-z0-9_-]+) "
    r"attempt=(?P<attempt>[0-9]+/[0-9]+)\] "
    r"(?P<message>.+)$",
    re.IGNORECASE,
)


class _FakeCopilotSession:
    def __init__(self, results: list[SessionResult]) -> None:
        self._results = list(results)
        self.calls: list[dict[str, object]] = []
        self.alias = "fake-copilot"

    def send_message(
        self,
        prompt: str,
        *,
        continue_session: bool = False,
    ) -> SessionResult:
        self.calls.append(
            {
                "prompt": prompt,
                "continue_session": continue_session,
            }
        )
        return self._results.pop(0)


def _progress_events(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, bool]]:
    events: list[tuple[str, bool]] = []

    def _echo(message: object = "", **kwargs: object) -> None:
        events.append((str(message), bool(kwargs.get("err", False))))

    monkeypatch.setattr(click, "echo", _echo)
    return events


def _assert_progress_schema(
    events: list[tuple[str, bool]],
    *,
    task_name: str,
    expected_attempts: list[str],
    required_message_terms: list[str],
    required_phase_message_terms: dict[str, list[str]] | None = None,
) -> None:
    assert events, "expected progress events"
    assert all(
        is_err is True for _, is_err in events
    ), "progress events must be emitted on stderr via click.echo(err=True)"

    parsed_events: list[dict[str, str]] = []
    for line, _is_err in events:
        match = _PROGRESS_SCHEMA.match(line)
        assert match is not None, (
            "progress line must follow structured schema: "
            "[task=<name> phase=<phase> attempt=<n>/<total>] <message>"
        )
        parsed_events.append(match.groupdict())

    assert [event["task"].lower() for event in parsed_events] == [
        task_name.lower()
    ] * len(parsed_events)
    assert [event["attempt"] for event in parsed_events] == expected_attempts

    messages = [event["message"].lower() for event in parsed_events]
    for required_term in required_message_terms:
        assert any(required_term in message for message in messages)

    if required_phase_message_terms is None:
        return

    for phase, required_terms in required_phase_message_terms.items():
        phase_messages = [
            event["message"].lower()
            for event in parsed_events
            if event["phase"].lower() == phase.lower()
        ]
        assert phase_messages, f"expected progress events for phase '{phase}'"
        for required_term in required_terms:
            assert any(required_term in message for message in phase_messages)


def _success_check(outcomes: list[bool]) -> Callable[[], bool]:
    iterator = iter(outcomes)

    def _check() -> bool:
        return next(iterator)

    return _check


def test_non_retriable_detector_matches_rate_limit_sample() -> None:
    text = "❌ Error: (rate_limit) You've reached your weekly rate limit..."

    assert is_non_retriable_agent_error_text(text) is True


def test_non_retriable_detector_matches_quota_and_429_phrases() -> None:
    assert is_non_retriable_agent_error_text("HTTP 429 Too Many Requests") is True
    assert is_non_retriable_agent_error_text("Request failed because quota exceeded") is True


def test_non_retriable_detector_does_not_match_unrelated_text() -> None:
    assert is_non_retriable_agent_error_text("No experiments were created yet.") is False


def test_load_task_prompt_config_returns_prompt_and_agent() -> None:
    project_config = ProjectConfig(
        path=Path("project.config.toml"),
        name="demo",
        agentic_cli_type="copilot_cli",
        agentic_cli_alias="copilot",
        baseline_id="demo",
        baseline_eval_model="edge_agent_default",
        task_prompts={
            "design": TaskPromptConfig(
                agent="edge-architect",
                prompt="Strict prompt body",
            )
        },
    )

    prompt, agent = task_runner.load_task_prompt_config(project_config, "design")

    assert prompt == "Strict prompt body"
    assert agent == "edge-architect"


def test_load_task_prompt_config_delegates_missing_config_error_to_get_task_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise_canonical_error(
        project_config: ProjectConfig | None, task_name: str
    ) -> TaskPromptConfig:
        raise click.ClickException(f"canonical handling for {task_name}")

    monkeypatch.setattr(task_runner, "get_task_prompt", _raise_canonical_error)

    with pytest.raises(click.ClickException, match="canonical handling for design"):
        task_runner.load_task_prompt_config(None, "design")


def test_run_task_with_retry_reports_progress_and_writes_transcript_on_first_success(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transcript_path = tmp_path / "design-transcript.txt"
    events = _progress_events(monkeypatch)
    fake_copilot_session = _FakeCopilotSession(
        [SessionResult(stdout="created experiment", stderr="", returncode=0)]
    )
    copilot_session = cast(CopilotSessionService, fake_copilot_session)

    result = task_runner.run_task_with_retry(
        task_name="design",
        copilot_session=copilot_session,
        prompt="initial design prompt",
        retry_prompt="retry design prompt",
        success_check=_success_check([True]),
        failure_message="Design agent did not create a new experiment after one retry.",
        transcript_path=transcript_path,
    )

    assert result.stdout == "created experiment"
    assert fake_copilot_session.calls == [
        {
            "prompt": "initial design prompt",
            "continue_session": False,
        }
    ]
    _assert_progress_schema(
        events,
        task_name="design",
        expected_attempts=["1/2", "1/2"],
        required_message_terms=["success"],
        required_phase_message_terms={"send": ["running agent with the prompt"]},
    )
    transcript_text = transcript_path.read_text()
    assert "initial design prompt" in transcript_text
    assert "created experiment" in transcript_text
    assert "retry design prompt" not in transcript_text


def test_run_task_with_retry_uses_continue_session_on_retry_and_appends_transcript(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transcript_path = tmp_path / "discover-transcript.txt"
    events = _progress_events(monkeypatch)
    fake_copilot_session = _FakeCopilotSession(
        [
            SessionResult(stdout="first discover response", stderr="", returncode=0),
            SessionResult(stdout="second discover response", stderr="", returncode=0),
        ]
    )
    copilot_session = cast(CopilotSessionService, fake_copilot_session)

    result = task_runner.run_task_with_retry(
        task_name="discover",
        copilot_session=copilot_session,
        prompt="initial discover prompt",
        retry_prompt="retry discover prompt",
        success_check=_success_check([False, True]),
        failure_message="Discover agent did not update docs/ideas.md after one retry.",
        transcript_path=transcript_path,
    )

    assert result.stdout == "second discover response"
    assert fake_copilot_session.calls == [
        {
            "prompt": "initial discover prompt",
            "continue_session": False,
        },
        {
            "prompt": "retry discover prompt",
            "continue_session": True,
        },
    ]
    _assert_progress_schema(
        events,
        task_name="discover",
        expected_attempts=["1/2", "1/2", "2/2", "2/2"],
        required_message_terms=["retry", "success"],
        required_phase_message_terms={"send": ["running agent with the prompt"]},
    )
    transcript_text = transcript_path.read_text()
    assert "initial discover prompt" in transcript_text
    assert "first discover response" in transcript_text
    assert "retry discover prompt" in transcript_text
    assert "second discover response" in transcript_text


def test_run_task_with_retry_reports_failure_after_retry_and_keeps_transcript(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transcript_path = tmp_path / "failed-discover-transcript.txt"
    events = _progress_events(monkeypatch)
    fake_copilot_session = _FakeCopilotSession(
        [
            SessionResult(stdout="first discover response", stderr="", returncode=0),
            SessionResult(stdout="second discover response", stderr="", returncode=0),
        ]
    )
    copilot_session = cast(CopilotSessionService, fake_copilot_session)

    with pytest.raises(
        click.ClickException,
        match="Discover agent did not update docs/ideas.md after one retry.",
    ):
        task_runner.run_task_with_retry(
            task_name="discover",
            copilot_session=copilot_session,
            prompt="initial discover prompt",
            retry_prompt="retry discover prompt",
            success_check=_success_check([False, False]),
            failure_message="Discover agent did not update docs/ideas.md after one retry.",
            transcript_path=transcript_path,
        )

    assert fake_copilot_session.calls == [
        {
            "prompt": "initial discover prompt",
            "continue_session": False,
        },
        {
            "prompt": "retry discover prompt",
            "continue_session": True,
        },
    ]
    _assert_progress_schema(
        events,
        task_name="discover",
        expected_attempts=["1/2", "1/2", "2/2", "2/2"],
        required_message_terms=["retry", "fail"],
        required_phase_message_terms={"send": ["running agent with the prompt"]},
    )
    transcript_text = transcript_path.read_text()
    assert "initial discover prompt" in transcript_text
    assert "first discover response" in transcript_text
    assert "retry discover prompt" in transcript_text
    assert "second discover response" in transcript_text
