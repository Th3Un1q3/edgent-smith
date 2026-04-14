"""Tests for evals/runner.py scoring and baseline behavior."""

from __future__ import annotations

import json
from typing import Any

import pytest
from pydantic_ai.models.test import TestModel
from pydantic_evals.reporting import EvaluationReport, ReportCase

from config import ModelConfig
from evals import runner


class DummyEvaluationResult:
    def __init__(self, value: Any) -> None:
        self.value = value


class DummyAgent:
    async def run(self, prompt: str) -> Any:
        return type("Result", (), {"output": None})()


class DummyDataset:
    def __init__(self, report: EvaluationReport) -> None:
        self.report = report
        self.cases = report.cases

    def evaluate_sync(self, task: Any, **kwargs: Any) -> EvaluationReport:
        return self.report


@pytest.mark.anyio
async def test_run_eval_scores_with_regression_penalty_and_time(tmp_path, monkeypatch) -> None:
    baseline_path = tmp_path / "edge_agent_default.baseline.json"
    candidate_path = tmp_path / "edge_agent_default.baseline-candidate.json"
    baseline_path.write_text(
        json.dumps(
            {
                "score": 40,
                "passing_cases": [
                    "arithmetic",
                    "factual_geography",
                    "extraction",
                    "summarization",
                ],
                "avg_passing_case_seconds": 10,
            }
        )
    )

    monkeypatch.setattr(runner, "baseline_file", lambda baseline_id: baseline_path)
    monkeypatch.setattr(runner, "baseline_candidate_file", lambda baseline_id: candidate_path)
    monkeypatch.setattr(runner, "build_edge_agent", lambda edge_model_config=None: DummyAgent())

    report = EvaluationReport(
        name="smoke",
        cases=[
            ReportCase(
                name="arithmetic",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(True)},
                task_duration=5.0,
                total_duration=5.0,
            ),
            ReportCase(
                name="factual_geography",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(False)},
                task_duration=5.0,
                total_duration=5.0,
            ),
            ReportCase(
                name="extraction",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(True)},
                task_duration=5.0,
                total_duration=5.0,
            ),
            ReportCase(
                name="summarization",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(True)},
                task_duration=5.0,
                total_duration=5.0,
            ),
        ],
        failures=[],
    )

    monkeypatch.setattr(runner, "smoke_dataset", DummyDataset(report))

    result = runner.run_eval(
        ModelConfig(alias="edge_agent_default", model=TestModel(), model_settings=None),
        baseline_id="edge_agent_default",
    )

    assert result is True

    candidate_data = json.loads(candidate_path.read_text())
    assert candidate_data["score"] == 40
    assert candidate_data["avg_passing_case_seconds"] == 5.0
    assert candidate_data["regressions"] == ["factual_geography"]
    assert candidate_data["passed"] is True
    assert candidate_data["baseline_id"] == "edge_agent_default"


@pytest.mark.anyio
async def test_run_eval_no_regression_penalty_without_prior_baseline(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        runner, "_read_baseline", lambda path: (0, [], {"score": 0, "passing_cases": []})
    )
    monkeypatch.setattr(
        runner, "baseline_file", lambda baseline_id: tmp_path / "edge_agent_default.baseline.json"
    )
    monkeypatch.setattr(
        runner,
        "baseline_candidate_file",
        lambda baseline_id: tmp_path / "edge_agent_default.baseline-candidate.json",
    )
    monkeypatch.setattr(runner, "build_edge_agent", lambda edge_model_config=None: DummyAgent())

    report = EvaluationReport(
        name="smoke",
        cases=[
            ReportCase(
                name="arithmetic",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(True)},
                task_duration=5.0,
                total_duration=5.0,
            ),
            ReportCase(
                name="factual_geography",
                inputs="",
                metadata=None,
                expected_output=None,
                output="ok",
                metrics={},
                attributes={},
                scores={},
                labels={},
                assertions={"ok": DummyEvaluationResult(False)},
                task_duration=5.0,
                total_duration=5.0,
            ),
        ],
        failures=[],
    )

    monkeypatch.setattr(runner, "smoke_dataset", DummyDataset(report))

    result = runner.run_eval(
        ModelConfig(alias="edge_agent_default", model=TestModel(), model_settings=None),
        baseline_id="edge_agent_default",
    )

    assert result is True

    candidate_data = json.loads(
        (tmp_path / "edge_agent_default.baseline-candidate.json").read_text()
    )
    assert candidate_data["score"] == 20
    assert candidate_data["avg_passing_case_seconds"] == 5.0
    assert candidate_data["regressions"] == []
    assert candidate_data["effective_baseline_passing_count"] == 1
    assert candidate_data["regression_penalty"] == 0
    assert candidate_data["passed"] is True
