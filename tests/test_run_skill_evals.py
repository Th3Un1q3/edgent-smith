"""Fallback retry behavior of scripts/run_skill_evals.py run_case."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from scripts import run_skill_evals


@pytest.fixture
def skill_dir(tmp_path: Path) -> Path:
    d = tmp_path / "skill"
    d.mkdir()
    return d


def _install(
    monkeypatch: pytest.MonkeyPatch,
    primary: tuple[str, str, int],
    fallback: tuple[str, str, int],
) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []

    def fake_run_opencode(
        prompt: str,
        bin_path: str,
        timeout: int,
        model: str | None = None,
        agent: str | None = None,
        raw_path: Path | None = None,
        fallback_model: str | None = None,
        session_id: str | None = None,
        title: str | None = None,
    ) -> tuple[str, str, int, float, str | None]:
        text, stderr, rc = fallback if model == "fallback/model" else primary
        calls.append({"prompt": prompt, "model": model, "session_id": session_id, "title": title})
        return text, stderr, rc, 1.0, "ses-1"

    monkeypatch.setattr(run_skill_evals, "run_opencode", fake_run_opencode)
    return calls


def _run(skill_dir: Path) -> dict[str, Any]:
    return run_skill_evals.run_case(
        {"id": 1, "prompt": "do the thing"},
        skill_dir,
        "opencode",
        10,
        "primary/model",
        fallback_model="fallback/model",
    )


@pytest.mark.parametrize(
    ("primary", "fallback"),
    [
        (("", "timeout", 124), ("fallback answer", "", 0)),
        (("", "", 0), ("fallback answer", "", 0)),
    ],
    ids=["timeout", "empty-text"],
)
def test_run_case_retries_same_turn_with_fallback(
    monkeypatch: pytest.MonkeyPatch,
    skill_dir: Path,
    primary: tuple[str, str, int],
    fallback: tuple[str, str, int],
) -> None:
    calls = _install(monkeypatch, primary, fallback)

    result = _run(skill_dir)

    assert result["fallback_used"] is True
    assert result["output"] == "fallback answer"
    assert result["rc"] == 0
    assert result["error"] is None
    assert [c["model"] for c in calls] == ["primary/model", "fallback/model"]
    assert calls[1]["session_id"] is None
    assert "do the thing" in calls[1]["prompt"]


def test_run_case_skips_fallback_when_output_is_present(
    monkeypatch: pytest.MonkeyPatch, skill_dir: Path
) -> None:
    calls = _install(monkeypatch, ("primary answer", "", 0), ("fallback answer", "", 0))

    result = _run(skill_dir)

    assert result["fallback_used"] is False
    assert result["output"] == "primary answer"
    assert [c["model"] for c in calls] == ["primary/model"]


def test_run_case_uses_fallback_only_once(monkeypatch: pytest.MonkeyPatch, skill_dir: Path) -> None:
    calls = _install(monkeypatch, ("", "", 0), ("", "", 0))

    result = _run(skill_dir)

    assert result["fallback_used"] is True
    assert [c["model"] for c in calls] == ["primary/model", "fallback/model"]
    assert result["error"] == "empty output"


def test_case_run_carries_deterministic_title(
    monkeypatch: pytest.MonkeyPatch, skill_dir: Path
) -> None:
    calls = _install(monkeypatch, ("primary answer", "", 0), ("fallback answer", "", 0))

    _run(skill_dir)

    assert calls[0]["title"] == "eval-case-1"


def test_invoke_opencode_passes_title_and_no_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_run(cmd: list[str], **kwargs: Any) -> Any:
        captured["cmd"] = cmd
        captured["timeout"] = kwargs.get("timeout")
        return type("P", (), {"stdout": "", "stderr": "", "returncode": 0})()

    monkeypatch.setattr(run_skill_evals.subprocess, "run", fake_run)

    run_skill_evals._invoke_opencode("p", "opencode", None, "m", None, title="eval-case-7")

    assert captured["cmd"][captured["cmd"].index("--title") + 1] == "eval-case-7"
    assert captured["timeout"] is None


def test_runtime_config_defaults_without_timeout_or_parallelism(
    tmp_path: Path,
) -> None:
    args = run_skill_evals.argparse.Namespace(
        model=None,
        agent=None,
        fallback_model=None,
        grader_model=None,
        grader_fallback_model=None,
        opencode_bin=None,
        timeout=None,
        workers=None,
        max_turns=None,
        grade=None,
        config=None,
    )

    run_skill_evals.resolve_runtime_config(args, tmp_path / "skill", tmp_path)

    assert args.timeout is None
    assert args.workers == 1


def _capture_grader_prompt(monkeypatch: pytest.MonkeyPatch, captured: dict[str, Any]) -> None:
    def fake_run_opencode(prompt: str, *args: Any, **kwargs: Any) -> Any:
        captured["prompt"] = prompt
        return "[]", "", 0, 0.0, None

    monkeypatch.setattr(run_skill_evals, "run_opencode", fake_run_opencode)


def test_grade_case_points_grader_at_transcripts(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, Any] = {}
    _capture_grader_prompt(monkeypatch, captured)
    paths = [str(tmp_path / "s-1-case1.raw.txt"), str(tmp_path / "s-1-case1.raw-turn2.txt")]

    run_skill_evals.grade_case(
        {"id": 1, "prompt": "do the thing", "assertions": [{"text": "did it"}]},
        "A" * 20000,
        bin_path="opencode",
        timeout=None,
        model="grader/model",
        grade="auto",
        transcripts=paths,
    )

    prompt = captured["prompt"]
    assert all(p in prompt for p in paths)
    assert "do the thing" in prompt
    assert "A" * 100 not in prompt


def test_grade_case_truncates_output_without_transcripts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _capture_grader_prompt(monkeypatch, captured)
    output = "A" * 8000 + "B" * 4000

    run_skill_evals.grade_case(
        {"id": 1, "prompt": "do the thing", "assertions": [{"text": "did it"}]},
        output,
        bin_path="opencode",
        timeout=None,
        model="grader/model",
        grade="auto",
    )

    prompt = captured["prompt"]
    assert "A" * 8000 in prompt
    assert "B" not in prompt


_GRADE_JSON = '[{"text": "did it", "passed": true, "evidence": "read_memory called"}]'


def _install_grader(
    monkeypatch: pytest.MonkeyPatch,
    responses: dict[str | None, tuple[str, str, int]],
) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []

    def fake_run_opencode(
        prompt: str,
        bin_path: str,
        timeout: int | None,
        model: str | None = None,
        agent: str | None = None,
        **kwargs: Any,
    ) -> tuple[str, str, int, float, str | None]:
        calls.append({"prompt": prompt, "model": model, "timeout": timeout})
        text, stderr, rc = responses[model]
        return text, stderr, rc, 1.0, None

    monkeypatch.setattr(run_skill_evals, "run_opencode", fake_run_opencode)
    return calls


def _grade(
    timeout: int | None = 600, fallback: str | None = "fallback/model"
) -> list[dict[str, Any]]:
    return run_skill_evals.grade_case(
        {"id": 1, "prompt": "do the thing", "assertions": [{"text": "did it"}]},
        "answer",
        bin_path="opencode",
        timeout=timeout,
        model="grader/model",
        grade="auto",
        fallback_model=fallback,
        transcripts=["results/s-1-case1.raw.txt"],
    )


@pytest.mark.parametrize(
    ("primary", "fallback"),
    [
        (("", "timeout", 124), (_GRADE_JSON, "", 0)),
        (("", "", 0), (_GRADE_JSON, "", 0)),
    ],
    ids=["timeout", "empty-text"],
)
def test_grade_case_retries_grader_with_fallback(
    monkeypatch: pytest.MonkeyPatch,
    primary: tuple[str, str, int],
    fallback: tuple[str, str, int],
) -> None:
    calls = _install_grader(monkeypatch, {"grader/model": primary, "fallback/model": fallback})

    rows = _grade()

    assert [c["model"] for c in calls] == ["grader/model", "fallback/model"]
    assert {c["timeout"] for c in calls} == {600}
    assert rows[0]["passed"] is True
    assert rows[0]["grading_fallback_used"] is True


def test_grade_case_skips_grader_fallback_when_model_is_same(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _install_grader(monkeypatch, {"grader/model": ("", "timeout", 124)})

    rows = _grade(fallback="grader/model")

    assert [c["model"] for c in calls] == ["grader/model"]
    assert rows[0]["grading_fallback_used"] is False


def test_grade_case_passes_none_timeout_to_grader(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _install_grader(
        monkeypatch,
        {"grader/model": ("", "timeout", 124), "fallback/model": (_GRADE_JSON, "", 0)},
    )

    _grade(timeout=None)

    assert [c["timeout"] for c in calls] == [None, None]


def test_grade_case_prompt_greps_tool_names_for_excerpts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _capture_grader_prompt(monkeypatch, captured)

    run_skill_evals.grade_case(
        {"id": 1, "prompt": "do the thing", "assertions": [{"text": "did it"}]},
        "answer",
        bin_path="opencode",
        timeout=600,
        model="grader/model",
        grade="auto",
        transcripts=["results/s-1-case1.raw.txt"],
    )

    prompt = captured["prompt"]
    for tool in ("list_memories", "read_memory", "write_memory", "edit_memory"):
        assert tool in prompt
    assert "grep" in prompt
    assert "excerpt" in prompt


@pytest.mark.parametrize(
    "phrase",
    [
        "no write_memory was issued",
        "nothing was persisted",
        "no memories exist",
        "no write was",
        "plan-only",
        "did not write",
    ],
)
def test_needs_continuation_flags_plan_only_write_reports(phrase: str) -> None:
    text = (
        "<task_contract>\ntask: store the lesson\n</task_contract>\n\n"
        f"The run was {phrase} and the memory set stayed as it was. " + "detail " * 40
    )

    assert run_skill_evals._needs_continuation(text) is True
