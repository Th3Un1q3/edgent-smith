from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest

from cli.services import copilot_session as copilot_session_module
from scripts import experiment
from scripts.validate_workflow_security import (
    EDGE_ARCHITECT_AGENT_PATH,
    WORKFLOW_PATH,
    draft_contract_matches_workflow_parser,
    replenishment_runs_for_queue_count,
)

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_run_bootstraps_missing_baseline_before_copilot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline_path = tmp_path / "auto_research.baseline.json"
    candidate_path = tmp_path / "auto_research.baseline-candidate.json"
    state_path = tmp_path / "experiments" / "17.state.json"
    calls: list[str] = []

    monkeypatch.setattr(experiment, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(experiment, "baseline_candidate_file", lambda baseline_id: candidate_path)

    def fake_eval(baseline_id: str, eval_model: str | None = None) -> None:
        calls.append(f"eval:{baseline_id}:{eval_model}")
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
        "eval:auto_research:None",
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

    def fake_eval(baseline_id: str, eval_model: str | None = None) -> None:
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

    assert args.model == "gpt-5-mini"
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


def test_build_copilot_command_uses_shared_allow_all_deny_git_policy() -> None:
    args = experiment.build_copilot_command(
        agent="implement",
        model="gpt-5-mini",
        prompt="Probe",
        session_name="experiment-issue-9-attempt-2",
        resume_session=False,
    )

    policy_flags = [
        arg for arg in args if arg == "--allow-all-tools" or arg.startswith("--deny-tool=")
    ]

    assert policy_flags == copilot_session_module.allow_all_deny_git_toolset().to_flags(
        inline_assignment=True
    )


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

    def fake_eval(baseline_id: str, eval_model: str | None = None) -> None:
        calls.append(f"eval:{baseline_id}:{eval_model}")
        baseline_path.write_text(json.dumps({"score": 12}) + "\n")

    def fake_promote(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
        calls.append(f"promote:{baseline_id}")

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "promote_baseline", fake_promote)

    state: dict[str, object] = {"attempts": []}
    attempt: dict[str, object] = {"attempt": 1, "baseline_bootstrapped": False}
    experiment.ensure_baseline(
        baseline_id="test",
        state_path=state_path,
        state=state,
        attempt=attempt,
    )

    assert any(call.startswith("eval:test") for call in calls)
    assert "promote:test" in calls
    assert attempt.get("baseline_invalidated") is True
    reasons = attempt.get("baseline_invalidation_reasons", [])
    assert isinstance(reasons, list)
    assert any("git SHA changed" in r for r in reasons)


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

    def fake_eval(baseline_id: str, eval_model: str | None = None) -> None:
        calls.append(f"eval:{baseline_id}:{eval_model}")
        baseline_path.write_text(json.dumps({"score": 12}) + "\n")

    def fake_promote(baseline_id: str, *, source_experiment_id: str | None = None) -> None:
        calls.append(f"promote:{baseline_id}")

    monkeypatch.setattr(experiment, "just_eval_ci", fake_eval)
    monkeypatch.setattr(experiment, "promote_baseline", fake_promote)

    state: dict[str, object] = {"attempts": []}
    attempt: dict[str, object] = {"attempt": 1, "baseline_bootstrapped": False}
    experiment.ensure_baseline(
        baseline_id="test",
        state_path=state_path,
        state=state,
        attempt=attempt,
    )

    assert any(call.startswith("eval:test") for call in calls)
    assert "promote:test" in calls
    assert attempt.get("baseline_invalidated") is True
    reasons = attempt.get("baseline_invalidation_reasons", [])
    assert isinstance(reasons, list)
    assert any("eval set changed" in r for r in reasons)


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

    state: dict[str, object] = {"attempts": []}
    attempt: dict[str, object] = {"attempt": 1, "baseline_bootstrapped": False}
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


def test_local_loop_alias_flags_converge_in_parse_args() -> None:
    preferred = experiment.parse_args(
        [
            "local-loop",
            "--model-alias",
            "edge_agent_local_openrouter",
            "--max-experiments",
            "2",
        ]
    )
    compatible = experiment.parse_args(
        [
            "local-loop",
            "--model",
            "edge_agent_local_openrouter",
            "--max-iterations",
            "2",
        ]
    )

    assert preferred.model == compatible.model == "edge_agent_local_openrouter"
    assert preferred.max_experiments == compatible.max_experiments == 2


def test_local_loop_main_preserves_explicit_baseline_id_with_public_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_run_local_loop(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return {
            "status": "completed",
            "baseline_id": str(kwargs["baseline_id"]),
            "model": str(kwargs["model"]),
            "iterations_completed": 1,
            "stop_reason": "max_experiments",
            "last_result": {"status": "failed"},
        }

    monkeypatch.setattr(experiment, "run_local_loop", fake_run_local_loop)

    exit_code = experiment.main(
        [
            "local-loop",
            "--model-alias",
            "edge_agent_local_openrouter",
            "--baseline-id",
            "local_openrouter",
            "--max-experiments",
            "1",
            "--dry",
        ]
    )

    assert exit_code == 0
    assert captured["model"] == "edge_agent_local_openrouter"
    assert captured["baseline_id"] == "local_openrouter"
    assert captured["max_experiments"] == 1


@pytest.mark.parametrize("hooks_set", ["../bad", "bad/child", r"bad\\child"])
def test_local_loop_hooks_reject_non_basename_sets(hooks_set: str) -> None:
    with pytest.raises(ValueError):
        experiment.resolve_hook_set_dir(hooks_set)


def test_local_loop_hooks_require_existing_set(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    hooks_root = tmp_path / "hooks"
    hooks_root.mkdir()
    monkeypatch.setattr(experiment, "HOOKS_ROOT", hooks_root)

    with pytest.raises(FileNotFoundError):
        experiment.resolve_hook_set_dir("local")


def test_local_loop_hooks_run_around_checkpoint_and_log_completion_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    hooks_root = tmp_path / "hooks"
    hooks_dir = hooks_root / "local"
    hooks_dir.mkdir(parents=True)
    (hooks_dir / experiment.GENERATED_HOOK_NAME).write_text("#!/usr/bin/env bash\n")
    (hooks_dir / experiment.COMPLETE_HOOK_NAME).write_text("#!/usr/bin/env bash\n")

    draft_path = tmp_path / "local_idea_draft.yaml"
    title_path = tmp_path / "local_idea_title.txt"
    body_path = tmp_path / "local_idea_body.md"
    candidate_path = tmp_path / "candidate.md"
    state_path = tmp_path / "manual.state.json"
    draft_path.write_text("title: experiment: Hook title\nbody: |\n  Hook body\n")

    calls: list[str] = []
    hook_envs: dict[str, dict[str, str]] = {}
    logs: list[str] = []

    monkeypatch.setattr(experiment, "HOOKS_ROOT", hooks_root)
    monkeypatch.setattr(experiment, "log", logs.append)

    def fake_run_hook_script(hook_path: Path, env: dict[str, str]) -> None:
        calls.append(hook_path.name)
        hook_envs[hook_path.name] = env.copy()
        if hook_path.name == experiment.COMPLETE_HOOK_NAME:
            raise subprocess.CalledProcessError(returncode=7, cmd=[str(hook_path)])

    def fake_checkpoint_local_spec(
        *,
        title_path: Path,
        body_path: Path,
        candidate_path: Path,
        draft_path: Path,
    ) -> None:
        calls.append("checkpoint")
        candidate_path.write_text(
            '---\ntitle: "experiment: Hook title"\ndate: 2026-05-06T00:00:00Z\n---\n\nHook body\n'
        )

    def fake_run_experiment(**_: object) -> dict[str, object]:
        calls.append("run_experiment")
        return {
            "status": "candidate_ready",
            "baseline_score": 10,
            "candidate_score": 12,
            "candidate_path": str(candidate_path),
        }

    monkeypatch.setattr(experiment, "run_hook_script", fake_run_hook_script)
    monkeypatch.setattr(experiment, "checkpoint_local_spec", fake_checkpoint_local_spec)
    monkeypatch.setattr(experiment, "run_experiment", fake_run_experiment)
    monkeypatch.setattr(
        experiment,
        "promote_baseline",
        lambda baseline_id, *, source_experiment_id=None: calls.append(f"promote:{baseline_id}"),
    )

    result = experiment.run_local_loop_iteration(
        iteration=1,
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set="local",
        prepare_cmd=None,
        draft_path=draft_path,
        title_path=title_path,
        body_path=body_path,
        candidate_path=candidate_path,
        state_path=state_path,
        dry_run=False,
    )

    assert calls == [
        experiment.GENERATED_HOOK_NAME,
        "checkpoint",
        "run_experiment",
        "promote:local",
        experiment.COMPLETE_HOOK_NAME,
    ]
    assert result["status"] == "succeeded"
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_HOOK_SET"] == "local"
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_BASELINE_ID"] == "local"
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_ITERATION"] == "1"
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_DRAFT_PATH"] == str(
        draft_path.resolve()
    )
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_TITLE_PATH"] == str(
        title_path.resolve()
    )
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_BODY_PATH"] == str(
        body_path.resolve()
    )
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_CANDIDATE_PATH"] == str(
        candidate_path.resolve()
    )
    assert "EXPERIMENT_STATUS" not in hook_envs[experiment.GENERATED_HOOK_NAME]
    assert "EXPERIMENT_IMPROVED" not in hook_envs[experiment.GENERATED_HOOK_NAME]
    assert "EXPERIMENT_BASELINE_SCORE" not in hook_envs[experiment.GENERATED_HOOK_NAME]
    assert "EXPERIMENT_CANDIDATE_SCORE" not in hook_envs[experiment.GENERATED_HOOK_NAME]
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_DRAFT_PATH"] == str(
        draft_path.resolve()
    )
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_TITLE_PATH"] == str(
        title_path.resolve()
    )
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_BODY_PATH"] == str(
        body_path.resolve()
    )
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_CANDIDATE_PATH"] == str(
        candidate_path.resolve()
    )
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_STATUS"] == "succeeded"
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_IMPROVED"] == "true"
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_BASELINE_SCORE"] == "10"
    assert hook_envs[experiment.COMPLETE_HOOK_NAME]["EXPERIMENT_CANDIDATE_SCORE"] == "12"
    assert any(experiment.COMPLETE_HOOK_NAME in message for message in logs)


def test_local_loop_hooks_generation_failure_aborts_before_checkpoint(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    hooks_root = tmp_path / "hooks"
    hooks_dir = hooks_root / "local"
    hooks_dir.mkdir(parents=True)
    (hooks_dir / experiment.GENERATED_HOOK_NAME).write_text("#!/usr/bin/env bash\n")

    draft_path = tmp_path / "local_idea_draft.yaml"
    title_path = tmp_path / "local_idea_title.txt"
    body_path = tmp_path / "local_idea_body.md"
    candidate_path = tmp_path / "candidate.md"
    state_path = tmp_path / "manual.state.json"
    draft_path.write_text("title: experiment: Hook title\nbody: |\n  Hook body\n")

    calls: list[str] = []

    monkeypatch.setattr(experiment, "HOOKS_ROOT", hooks_root)

    def fake_run_hook_script(hook_path: Path, env: dict[str, str]) -> None:
        del env
        calls.append(hook_path.name)
        raise subprocess.CalledProcessError(returncode=3, cmd=[str(hook_path)])

    monkeypatch.setattr(experiment, "run_hook_script", fake_run_hook_script)
    monkeypatch.setattr(
        experiment,
        "checkpoint_local_spec",
        lambda **_: calls.append("checkpoint"),
    )

    with pytest.raises(subprocess.CalledProcessError):
        experiment.run_local_loop_iteration(
            iteration=1,
            agent="implement",
            model="gpt-5",
            baseline_id="local",
            hooks_set="local",
            prepare_cmd=None,
            draft_path=draft_path,
            title_path=title_path,
            body_path=body_path,
            candidate_path=candidate_path,
            state_path=state_path,
            dry_run=False,
        )

    assert calls == [experiment.GENERATED_HOOK_NAME]


def test_local_loop_stop_count_applies_between_iterations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    iterations: list[int] = []

    def fake_iteration(**kwargs: Any) -> dict[str, object]:
        assert isinstance(kwargs["iteration"], int)
        iterations.append(kwargs["iteration"])
        return {"status": "failed", "improved": False}

    monkeypatch.setattr(experiment, "run_local_loop_iteration", fake_iteration)

    result = experiment.run_local_loop(
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd=None,
        max_experiments=2,
        max_minutes=None,
        dry_run=True,
    )

    assert iterations == [1, 2]
    assert result["iterations_completed"] == 2
    assert result["stop_reason"] == "max_experiments"


def test_local_loop_zero_max_experiments_stops_before_first_iteration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        experiment,
        "run_local_loop_iteration",
        lambda **_: pytest.fail("iteration should not run when max_experiments is zero"),
    )

    result = experiment.run_local_loop(
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd=None,
        max_experiments=0,
        max_minutes=None,
        dry_run=True,
    )

    assert result["iterations_completed"] == 0
    assert result["stop_reason"] == "max_experiments"
    assert result["last_result"] is None


def test_local_loop_stop_duration_applies_after_current_iteration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    iterations: list[int] = []
    monotonic_values = iter([0.0, 61.0])

    def fake_iteration(**kwargs: Any) -> dict[str, object]:
        assert isinstance(kwargs["iteration"], int)
        iterations.append(kwargs["iteration"])
        return {"status": "failed", "improved": False}

    monkeypatch.setattr(experiment, "run_local_loop_iteration", fake_iteration)
    monkeypatch.setattr("scripts.experiment.time.monotonic", lambda: next(monotonic_values))

    result = experiment.run_local_loop(
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd=None,
        max_experiments=None,
        max_minutes=1.0,
        dry_run=True,
    )

    assert iterations == [1]
    assert result["iterations_completed"] == 1
    assert result["stop_reason"] == "max_minutes"


def test_local_loop_zero_max_minutes_stops_after_first_iteration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    iterations: list[int] = []
    monotonic_values = iter([100.0, 100.0])

    def fake_iteration(**kwargs: Any) -> dict[str, object]:
        assert isinstance(kwargs["iteration"], int)
        iterations.append(kwargs["iteration"])
        return {"status": "failed", "improved": False}

    monkeypatch.setattr(experiment, "run_local_loop_iteration", fake_iteration)
    monkeypatch.setattr("scripts.experiment.time.monotonic", lambda: next(monotonic_values))

    result = experiment.run_local_loop(
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd=None,
        max_experiments=None,
        max_minutes=0.0,
        dry_run=True,
    )

    assert iterations == [1]
    assert result["iterations_completed"] == 1
    assert result["stop_reason"] == "max_minutes"


def test_local_loop_prepare_and_file_input_flow_remain_supported(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft_path = tmp_path / "local_idea_draft.yaml"
    title_path = tmp_path / "local_idea_title.txt"
    body_path = tmp_path / "local_idea_body.md"
    candidate_path = tmp_path / "candidate.md"
    state_path = tmp_path / "manual.state.json"
    calls: list[str] = []

    def fake_prepare(command: str) -> None:
        calls.append(f"prepare:{command}")
        draft_path.write_text("title: experiment: Prepared title\nbody: |\n  Prepared body\n")

    def fake_stage_checkpoint_files(paths: list[Path]) -> None:
        calls.append("stage")
        assert paths == [draft_path, title_path, body_path, candidate_path]

    def fake_run_experiment(**_: object) -> dict[str, object]:
        calls.append("run_experiment")
        return {
            "status": "failed",
            "baseline_score": 10,
            "candidate_score": 9,
            "candidate_path": str(candidate_path),
        }

    monkeypatch.setattr(experiment, "run_prepare_command", fake_prepare)
    monkeypatch.setattr(experiment, "stage_checkpoint_files", fake_stage_checkpoint_files)
    monkeypatch.setattr(experiment, "run_experiment", fake_run_experiment)

    result = experiment.run_local_loop_iteration(
        iteration=1,
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd="./scripts/generate-local-idea.sh",
        draft_path=draft_path,
        title_path=title_path,
        body_path=body_path,
        candidate_path=candidate_path,
        state_path=state_path,
        dry_run=True,
    )

    assert calls == ["prepare:./scripts/generate-local-idea.sh", "stage", "run_experiment"]
    assert title_path.read_text() == "experiment: Prepared title\n"
    assert body_path.read_text() == "Prepared body\n"
    assert "Prepared body" in candidate_path.read_text()
    assert result["status"] == "failed"


def test_local_loop_prepare_and_file_input_flow_remain_supported_with_hooks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    hooks_root = tmp_path / "hooks"
    hooks_dir = hooks_root / "local"
    hooks_dir.mkdir(parents=True)
    (hooks_dir / experiment.GENERATED_HOOK_NAME).write_text("#!/usr/bin/env bash\n")
    (hooks_dir / experiment.COMPLETE_HOOK_NAME).write_text("#!/usr/bin/env bash\n")

    draft_path = tmp_path / "local_idea_draft.yaml"
    title_path = tmp_path / "local_idea_title.txt"
    body_path = tmp_path / "local_idea_body.md"
    candidate_path = tmp_path / "candidate.md"
    state_path = tmp_path / "manual.state.json"
    calls: list[str] = []
    hook_envs: dict[str, dict[str, str]] = {}

    monkeypatch.setattr(experiment, "HOOKS_ROOT", hooks_root)

    def fake_prepare(command: str) -> None:
        calls.append(f"prepare:{command}")
        draft_path.write_text("title: experiment: Prepared title\nbody: |\n  Prepared body\n")

    def fake_run_hook_script(hook_path: Path, env: dict[str, str]) -> None:
        calls.append(hook_path.name)
        hook_envs[hook_path.name] = env.copy()

    def fake_stage_checkpoint_files(paths: list[Path]) -> None:
        calls.append("stage")
        assert paths == [draft_path, title_path, body_path, candidate_path]

    def fake_run_experiment(**_: object) -> dict[str, object]:
        calls.append("run_experiment")
        return {
            "status": "failed",
            "baseline_score": 10,
            "candidate_score": 9,
            "candidate_path": str(candidate_path),
        }

    monkeypatch.setattr(experiment, "run_prepare_command", fake_prepare)
    monkeypatch.setattr(experiment, "run_hook_script", fake_run_hook_script)
    monkeypatch.setattr(experiment, "stage_checkpoint_files", fake_stage_checkpoint_files)
    monkeypatch.setattr(experiment, "run_experiment", fake_run_experiment)

    result = experiment.run_local_loop_iteration(
        iteration=1,
        agent="implement",
        model="gpt-5",
        baseline_id="local",
        hooks_set="local",
        prepare_cmd="./scripts/generate-local-idea.sh",
        draft_path=draft_path,
        title_path=title_path,
        body_path=body_path,
        candidate_path=candidate_path,
        state_path=state_path,
        dry_run=True,
    )

    assert calls == [
        "prepare:./scripts/generate-local-idea.sh",
        experiment.GENERATED_HOOK_NAME,
        "stage",
        "run_experiment",
        experiment.COMPLETE_HOOK_NAME,
    ]
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_DRAFT_PATH"] == str(
        draft_path.resolve()
    )
    assert hook_envs[experiment.GENERATED_HOOK_NAME]["EXPERIMENT_TITLE_PATH"] == str(
        title_path.resolve()
    )
    assert title_path.read_text() == "experiment: Prepared title\n"
    assert body_path.read_text() == "Prepared body\n"
    assert "Prepared body" in candidate_path.read_text()
    assert result["status"] == "failed"


def test_local_loop_baseline_id_remains_literal_with_model_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str]] = []
    monotonic_values = iter([0.0, 0.0])

    def fake_iteration(**kwargs: Any) -> dict[str, object]:
        calls.append((str(kwargs["baseline_id"]), str(kwargs["model"])))
        return {"status": "failed", "improved": False}

    monkeypatch.setattr(experiment, "run_local_loop_iteration", fake_iteration)
    monkeypatch.setattr("scripts.experiment.time.monotonic", lambda: next(monotonic_values))

    experiment.run_local_loop(
        agent="implement",
        model="edge_agent_local_openrouter",
        baseline_id="local",
        hooks_set=None,
        prepare_cmd=None,
        max_experiments=1,
        max_minutes=None,
        dry_run=True,
    )

    assert calls == [("local", "edge_agent_local_openrouter")]


def test_run_experiment_loop_recipe_uses_local_loop_owner() -> None:
    justfile = (REPO_ROOT / "justfile").read_text()

    assert "run-experiment-loop *ARGS:" in justfile
    assert "alias experiment-loop := run-experiment-loop" in justfile
    assert "scripts/experiment.py local-loop" in justfile


def test_edge_agent_recipe_uses_local_openrouter_without_ollama_bootstrap() -> None:
    justfile = (REPO_ROOT / "justfile").read_text()
    match = re.search(r"^edge-agent prompt:.*?(?=^\S|\Z)", justfile, re.MULTILINE | re.DOTALL)

    assert match is not None
    recipe = match.group(0)

    assert "edge_agent_local_openrouter" in recipe
    assert "pull-ollama-model" not in recipe
    assert "ollama-status" not in recipe


@pytest.mark.parametrize(
    ("relative_path", "expected_fragments"),
    [
        (
            Path("hooks/local/experiment_generated.sh"),
            [
                "EXPERIMENT_DRAFT_PATH",
                "EXPERIMENT_TITLE_PATH",
                "EXPERIMENT_BODY_PATH",
            ],
        ),
        (
            Path("hooks/local/experiment_complete.sh"),
            [
                "EXPERIMENT_STATUS",
                "EXPERIMENT_IMPROVED",
                "local_loop_history.log",
            ],
        ),
    ],
)
def test_local_hook_templates_exist_with_minimal_contract_markers(
    relative_path: Path,
    expected_fragments: list[str],
) -> None:
    hook_path = REPO_ROOT / relative_path

    assert hook_path.exists()
    content = hook_path.read_text()

    for fragment in expected_fragments:
        assert fragment in content
