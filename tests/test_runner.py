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

    monkeypatch.setattr(runner, "baseline_file", lambda model_name: baseline_path)
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
        score_file=tmp_path / "score.json",
        update_baseline=False,
    )

    assert result is True

    score_data = json.loads((tmp_path / "score.json").read_text())
    assert score_data["score"] == 40
    assert score_data["avg_passing_case_seconds"] == 5.0
    assert score_data["regressions"] == ["factual_geography"]
    assert score_data["passed"] is True


@pytest.mark.anyio
async def test_run_eval_no_regression_penalty_without_prior_baseline(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        runner, "_read_baseline", lambda path: (0, [], {"score": 0, "passing_cases": []})
    )
    monkeypatch.setattr(
        runner, "baseline_file", lambda model_name: tmp_path / "edge_agent_default.baseline.json"
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
        score_file=tmp_path / "score.json",
        update_baseline=False,
    )

    assert result is True

    score_data = json.loads((tmp_path / "score.json").read_text())
    assert score_data["score"] == 20
    assert score_data["avg_passing_case_seconds"] == 5.0
    assert score_data["regressions"] == []
    assert score_data["effective_baseline_passing_count"] == 1
    assert score_data["regression_penalty"] == 0
    assert score_data["passed"] is True


@pytest.mark.anyio
async def test_run_eval_updates_baseline_metadata_when_improved(tmp_path, monkeypatch) -> None:
    baseline_path = tmp_path / "edge_agent_default.baseline.json"
    baseline_path.write_text(
        json.dumps(
            {
                "score": 30,
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

    monkeypatch.setattr(runner, "baseline_file", lambda model_name: baseline_path)
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
                assertions={"ok": DummyEvaluationResult(True)},
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
        score_file=None,
        update_baseline=True,
    )

    assert result is True

    updated = json.loads(baseline_path.read_text())
    assert updated["score"] == 80
    assert updated["avg_passing_case_seconds"] == 5.0
    assert updated["passing_cases"] == [
        "arithmetic",
        "factual_geography",
        "extraction",
        "summarization",
    ]
