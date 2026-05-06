from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts import experiment
from scripts.validate_workflow_security import (
    EDGE_ARCHITECT_AGENT_PATH,
    WORKFLOW_PATH,
    draft_contract_matches_workflow_parser,
    replenishment_runs_for_queue_count,
)


def test_run_bootstraps_missing_baseline_before_copilot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "17.state.json"
    calls: list[str] = []

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    def fake_eval(baseline_id: str) -> None:
        calls.append(f"eval:{baseline_id}")
        score = 11 if len([call for call in calls if call.startswith("eval:")]) == 1 else 13
        candidate_path.write_text(json.dumps({"score": score}) + "\n")

    def fake_promote(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
        calls.append(f"promote:{baseline_id}")
        baseline_path.write_text(candidate_path.read_text())
        candidate_path.unlink()

    def fake_invoke(
        *,
        agent: str,
        model: str,
        prompt: str,
        session_name: str,
        resume_session: bool,
        dry_run: bool,
    ) -> None:
        calls.append(f"copilot:{session_name}:{resume_session}")

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "promote_baseline", fake_promote)
    monkeypatch.setattr(experiment, "invoke_copilot", fake_invoke)
    monkeypatch.setattr(experiment, "just_fix", lambda: calls.append("fix"))

    result = experiment.run_experiment(
        prompt="Improve the experiment.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=0,
        dry_run=False,
        issue_number=17,
        workflow_run_id="wf-001",
        state_path=state_path,
    )

    assert calls[:3] == [
        "eval:auto_research",
        "promote:auto_research",
        "copilot:experiment-issue-17-attempt-1:False",
    ]
    assert result["status"] == "candidate_ready"
    assert result["baseline_score"] == 11
    assert result["candidate_score"] == 13
    assert result["baseline_bootstrapped"] is True

    state = json.loads(state_path.read_text())
    assert state["attempts"][0]["workflow_run_id"] == "wf-001"
    assert state["attempts"][0]["baseline_bootstrapped"] is True
    assert state["attempts"][0]["status"] == "candidate_ready"


def test_run_marks_stale_nonterminal_attempt_crashed_on_rerun(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "17.state.json"

    baseline_path.write_text(json.dumps({"score": 10}) + "\n")
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps(
            {
                "issue_number": 17,
                "attempts": [
                    {
                        "attempt": 1,
                        "workflow_run_id": "wf-old",
                        "status": "running",
                        "session_name": "experiment-issue-17-attempt-1",
                    }
                ],
            }
        )
        + "\n"
    )

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    result = experiment.run_experiment(
        prompt="Dry run.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=0,
        dry_run=True,
        issue_number=17,
        workflow_run_id="wf-new",
        state_path=state_path,
    )

    assert result["attempt"] == 2
    state = json.loads(state_path.read_text())
    assert state["attempts"][0]["status"] == "crashed"
    assert state["attempts"][1]["status"] == "failed"
    assert state["attempts"][1]["workflow_run_id"] == "wf-new"


@pytest.mark.parametrize(
    "workflow_status",
    [
        "candidate_ready",
        "promotion_failed",
        "post_candidate_failed",
        "succeeded",
        "timed_out",
        "cancelled",
    ],
)
def test_run_preserves_workflow_handoff_and_terminal_statuses_on_rerun(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    workflow_status: str,
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "17.state.json"

    baseline_path.write_text(json.dumps({"score": 10}) + "\n")
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps(
            {
                "issue_number": 17,
                "attempts": [
                    {
                        "attempt": 1,
                        "workflow_run_id": "wf-old",
                        "status": workflow_status,
                        "session_name": "experiment-issue-17-attempt-1",
                    }
                ],
            }
        )
        + "\n"
    )

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    result = experiment.run_experiment(
        prompt="Dry run.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=0,
        dry_run=True,
        issue_number=17,
        workflow_run_id="wf-new",
        state_path=state_path,
    )

    assert result["attempt"] == 2
    state = json.loads(state_path.read_text())
    assert state["attempts"][0]["status"] == workflow_status
    assert state["attempts"][1]["status"] == "failed"


def test_edge_architect_draft_contract_matches_workflow_parser_expectations() -> None:
    workflow_raw = WORKFLOW_PATH.read_text()
    agent_raw = EDGE_ARCHITECT_AGENT_PATH.read_text()

    assert (
        draft_contract_matches_workflow_parser(
            workflow_raw,
            agent_raw,
        )
        is True
    )


def test_replenishment_gate_is_derived_from_queue_depth_mapping() -> None:
    workflow_raw = WORKFLOW_PATH.read_text()

    assert replenishment_runs_for_queue_count(workflow_raw, 0) is True
    assert replenishment_runs_for_queue_count(workflow_raw, 1) is False


def test_run_reuses_named_session_for_single_followup_attempt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "17.state.json"
    copilot_calls: list[tuple[str, bool]] = []
    eval_count = 0

    baseline_path.write_text(json.dumps({"score": 10}) + "\n")

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    def fake_eval(baseline_id: str) -> None:
        nonlocal eval_count
        assert baseline_id == "auto_research"
        eval_count += 1
        score = 10 if eval_count == 1 else 12
        candidate_path.write_text(json.dumps({"score": score}) + "\n")

    def fake_invoke(
        *,
        agent: str,
        model: str,
        prompt: str,
        session_name: str,
        resume_session: bool,
        dry_run: bool,
    ) -> None:
        assert agent == "implement"
        assert model == "gpt-5"
        assert dry_run is False
        copilot_calls.append((session_name, resume_session))

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "invoke_copilot", fake_invoke)
    monkeypatch.setattr(experiment, "just_fix", lambda: None)

    result = experiment.run_experiment(
        prompt="Improve the experiment.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=1,
        dry_run=False,
        issue_number=17,
        workflow_run_id="wf-001",
        state_path=state_path,
    )

    assert copilot_calls == [
        ("experiment-issue-17-attempt-1", False),
        ("experiment-issue-17-attempt-1", True),
    ]
    assert result["status"] == "candidate_ready"
    assert result["candidate_score"] == 12

    state = json.loads(state_path.read_text())
    assert state["attempts"][0]["session_name"] == "experiment-issue-17-attempt-1"
    assert state["attempts"][0]["status"] == "candidate_ready"


def test_local_flag_defaults_false_in_parse_args() -> None:
    args = experiment.parse_args(["run", "--prompt", "Test"])
    assert args.local is False


def test_local_flag_sets_true_in_parse_args() -> None:
    args = experiment.parse_args(["run", "--prompt", "Test", "--local"])
    assert args.local is True


def test_local_flag_propagates_to_result(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "manual.state.json"

    baseline_path.write_text('{"score": 10}\n')
    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    result = experiment.run_experiment(
        prompt="Test.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=0,
        dry_run=True,
        local_mode=True,
        state_path=state_path,
    )

    assert result["local_mode"] is True


def test_local_flag_false_by_default_in_result(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "manual.state.json"

    baseline_path.write_text('{"score": 10}\n')
    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    result = experiment.run_experiment(
        prompt="Test.",
        agent="implement",
        model="gpt-5",
        baseline_id="auto_research",
        followup_limit=0,
        dry_run=True,
        state_path=state_path,
    )

    assert result["local_mode"] is False


def test_build_copilot_command_uses_named_sessions_and_resume() -> None:
    args = experiment.parse_args(["run", "--prompt", "Probe"])
    initial = experiment.build_copilot_command(
        agent=args.agent,
        model=args.model,
        prompt="Probe",
        session_name="experiment-issue-9-attempt-2",
        resume_session=False,
    )
    followup = experiment.build_copilot_command(
        agent=args.agent,
        model=args.model,
        prompt="Follow up",
        session_name="experiment-issue-9-attempt-2",
        resume_session=True,
    )

    assert args.model == "gpt-5"
    assert initial[:3] == ["copilot", "-p", "Probe"]
    assert "--name" in initial
    assert "experiment-issue-9-attempt-2" in initial
    assert "--continue" not in initial
    assert "--resume" not in initial
    assert "--no-ask-user" in initial
    assert "--output-format" in initial
    assert followup[:3] == ["copilot", "-p", "Follow up"]
    assert "--resume" in followup
    assert "experiment-issue-9-attempt-2" in followup
    assert "--name" not in followup
    assert "--continue" not in followup


def test_main_emits_machine_readable_json_result(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "21.state.json"

    baseline_path.write_text(json.dumps({"score": 10}) + "\n")

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    exit_code = experiment.main(
        [
            "run",
            "--prompt",
            "Probe",
            "--baseline-id",
            "auto_research",
            "--issue-number",
            "21",
            "--state-path",
            str(state_path),
            "--workflow-run-id",
            "wf-json",
            "--dry",
        ]
    )

    captured = capsys.readouterr()
    output_lines = [line for line in captured.out.splitlines() if line.strip()]

    assert exit_code == 1
    assert len(output_lines) == 1

    result = json.loads(output_lines[0])
    assert result == {
        "attempt": 1,
        "baseline_bootstrapped": False,
        "baseline_id": "auto_research",
        "baseline_invalidated": False,
        "baseline_score": 10,
        "candidate_path": str(candidate_path),
        "candidate_score": 9,
        "issue_number": 21,
        "local_mode": False,
        "score_delta": -1,
        "state_path": str(state_path),
        "status": "failed",
    }

    state = json.loads(state_path.read_text())
    assert state["attempts"][0]["status"] == "failed"


def test_ensure_baseline_rebootstraps_on_git_sha_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "test.baseline.json"
    state_path = tmp_path / "experiments" / "manual.state.json"
    baseline_path.write_text(
        json.dumps(
            {
                "score": 10,
                "_provenance": {
                    "git_sha": "aabbccdd1234",
                    "eval_set_version": "abcd1234",
                    "source_experiment_id": None,
                },
            }
        )
        + "\n"
    )
    calls: list[str] = []

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "git_head_sha", lambda: "deadbeef5678")
    monkeypatch.setattr(experiment, "eval_set_version", lambda: "abcd1234")

    def fake_eval(baseline_id: str) -> None:
        calls.append(f"eval:{baseline_id}")
        baseline_path.write_text(json.dumps({"score": 12}) + "\n")

    def fake_promote(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
        calls.append(f"promote:{baseline_id}")

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "promote_baseline", fake_promote)

    state: dict = {"attempts": []}
    attempt: dict = {"attempt": 1, "baseline_bootstrapped": False}
    experiment.ensure_baseline(
        baseline_id="test",
        state_path=state_path,
        state=state,
        attempt=attempt,
    )

    assert "eval:test" in calls
    assert "promote:test" in calls
    assert attempt.get("baseline_invalidated") is True
    assert any("git SHA changed" in r for r in attempt.get("baseline_invalidation_reasons", []))


def test_ensure_baseline_rebootstraps_on_eval_version_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "test.baseline.json"
    state_path = tmp_path / "experiments" / "manual.state.json"
    baseline_path.write_text(
        json.dumps(
            {
                "score": 10,
                "_provenance": {
                    "git_sha": "aabbccdd1234",
                    "eval_set_version": "oldversion",
                    "source_experiment_id": None,
                },
            }
        )
        + "\n"
    )
    calls: list[str] = []

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "git_head_sha", lambda: "aabbccdd1234")
    monkeypatch.setattr(experiment, "eval_set_version", lambda: "newversion")

    def fake_eval(baseline_id: str) -> None:
        calls.append(f"eval:{baseline_id}")
        baseline_path.write_text(json.dumps({"score": 12}) + "\n")

    def fake_promote(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
        calls.append(f"promote:{baseline_id}")

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "promote_baseline", fake_promote)

    state: dict = {"attempts": []}
    attempt: dict = {"attempt": 1, "baseline_bootstrapped": False}
    experiment.ensure_baseline(
        baseline_id="test",
        state_path=state_path,
        state=state,
        attempt=attempt,
    )

    assert "eval:test" in calls
    assert "promote:test" in calls
    assert attempt.get("baseline_invalidated") is True
    assert any("eval set changed" in r for r in attempt.get("baseline_invalidation_reasons", []))


def test_ensure_baseline_skips_invalidation_when_no_provenance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "test.baseline.json"
    state_path = tmp_path / "experiments" / "manual.state.json"
    baseline_path.write_text(json.dumps({"score": 10}) + "\n")
    calls: list[str] = []

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "git_head_sha", lambda: "deadbeef5678")
    monkeypatch.setattr(experiment, "eval_set_version", lambda: "newversion")
    monkeypatch.setattr(experiment, "just_eval_ci", lambda baseline_id: calls.append("eval"))
    monkeypatch.setattr(
        experiment,
        "promote_baseline",
        lambda baseline_id, *, source_experiment_id=None: calls.append("promote"),
    )

    state: dict = {"attempts": []}
    attempt: dict = {"attempt": 1, "baseline_bootstrapped": False}
    score = experiment.ensure_baseline(
        baseline_id="test",
        state_path=state_path,
        state=state,
        attempt=attempt,
    )

    assert score == 10
    assert calls == []
    assert attempt.get("baseline_invalidated") is None


def test_promote_baseline_writes_provenance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "test.baseline.json"
    baseline_path.write_text(json.dumps({"score": 15}) + "\n")

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "git_head_sha", lambda: "cafebabe1234")
    monkeypatch.setattr(experiment, "eval_set_version", lambda: "12345678")
    monkeypatch.setattr(experiment, "run_cmd", lambda cmd: None)

    experiment.promote_baseline("test", source_experiment_id="exp-42")

    data = json.loads(baseline_path.read_text())
    assert data["_provenance"]["git_sha"] == "cafebabe1234"
    assert data["_provenance"]["eval_set_version"] == "12345678"
    assert data["_provenance"]["source_experiment_id"] == "exp-42"
    assert data["score"] == 15


def test_promote_baseline_subcommand_writes_provenance_end_to_end(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """promote-baseline subcommand calls promote_baseline() and writes _provenance."""
    candidate_path = tmp_path / "test.baseline-candidate.json"
    baseline_path = tmp_path / "test.baseline.json"
    candidate_path.write_text(json.dumps({"score": 20}) + "\n")
    baseline_path.write_text(json.dumps({"score": 10}) + "\n")

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)
    monkeypatch.setattr(experiment, "git_head_sha", lambda: "deadbeef0000")
    monkeypatch.setattr(experiment, "eval_set_version", lambda: "aabbccdd")
    # Stub out the shell script call; the Python wrapper still annotates the file.
    monkeypatch.setattr(experiment, "run_cmd", lambda cmd: None)

    exit_code = experiment.main(
        ["promote-baseline", "--baseline-id", "test", "--source-experiment-id", "exp-99"]
    )

    assert exit_code == 0
    data = json.loads(baseline_path.read_text())
    assert data["_provenance"]["git_sha"] == "deadbeef0000"
    assert data["_provenance"]["eval_set_version"] == "aabbccdd"
    assert data["_provenance"]["source_experiment_id"] == "exp-99"
