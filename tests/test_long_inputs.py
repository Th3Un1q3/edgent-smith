"""Tests for the long-inputs evaluation dataset.

This test uses a small fake runner that returns deterministic `AgentOutput`
objects matching the expected answers so the custom evaluators can be
exercised in CI without calling a real model.
"""
from __future__ import annotations

from pydantic_ai import models

from agents.edge import AgentOutput
from evals.long_inputs import long_inputs_dataset

# Prevent accidental real model requests in CI
models.ALLOW_MODEL_REQUESTS = False


def _fake_run(prompt: str) -> AgentOutput:
    """Return an appropriate fake AgentOutput depending on the prompt content.

    The dataset provides the entire post-mortem as the prompt; select which
    synthetic answer to return by detecting keywords unique to each case.
    """
    lower = prompt.lower()
    if "summarize the post-mortem" in lower or "summarize" in lower:
        # Concise summary under 100 words containing key terms
        ans = (
            "A regression in the merge queue's squash merge logic introduced by "
            "deployment v2026.04.23.1 (PR #88392) caused silent data integrity "
            "failures affecting 2,092 PRs; mitigation involved reverting the change "
            "and deploying a global hotfix."
        )
        return AgentOutput(answer=ans, confidence="high")
    if "what's the total duration" in lower or "use hh:mm" in lower or "total duration" in lower:
        return AgentOutput(answer="04:38", confidence="high")
    # deployment cause fallback
    return AgentOutput(
        answer=(
            "Deployment of release v2026.04.23.1 (PR #88392: mq_optimized_base_computation_v2)"
        ),
        confidence="high",
    )


def test_fake_run_returns_expected_outputs() -> None:
    summary = _fake_run("Please summarize the post-mortem.")
    assert summary == AgentOutput(
        answer=(
            "A regression in the merge queue's squash merge logic introduced by "
            "deployment v2026.04.23.1 (PR #88392) caused silent data integrity "
            "failures affecting 2,092 PRs; mitigation involved reverting the change "
            "and deploying a global hotfix."
        ),
        confidence="high",
    )

    duration = _fake_run("What's the total duration? Use HH:MM.")
    assert duration == AgentOutput(answer="04:38", confidence="high")

    deployment_cause = _fake_run("What deployment caused the incident?")
    assert deployment_cause == AgentOutput(
        answer=(
            "Deployment of release v2026.04.23.1 (PR #88392: mq_optimized_base_computation_v2)"
        ),
        confidence="high",
    )


def test_long_inputs_dataset_evaluates() -> None:
    report = long_inputs_dataset.evaluate_sync(_fake_run, max_concurrency=1, repeat=1)

    assert report.cases, "Expected the long-inputs evaluation to produce cases"

    # A case is considered passing when all boolean assertions are True and
    # all numeric scores equal 1.0 (mirrors runner.case_pass_results logic).
    for case in report.cases:
        for assertion_name, assertion in case.assertions.items():
            assert assertion.value is True, f"Case {case.name} assertion {assertion_name} failed"
        for score_name, score in case.scores.items():
            assert score.value == 1.0, f"Case {case.name} score {score_name} was {score.value}"
