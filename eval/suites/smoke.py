"""Smoke eval suite – fast sanity checks run on every PR.

IMMUTABLE JUDGE: Do not modify during experiment cycles.
See EXPERIMENT_RULES.md.
"""

from __future__ import annotations

from eval.harness import EvalCase

SMOKE_CASES: list[EvalCase] = [
    EvalCase(
        case_id="smoke-001",
        suite="smoke",
        prompt="What is 2 + 2? Answer with just the number.",
        expected_keywords=["4"],
        max_latency_seconds=15.0,
        tags=["arithmetic", "basic"],
    ),
    EvalCase(
        case_id="smoke-002",
        suite="smoke",
        prompt="What is the capital of France? Answer with just the city name.",
        expected_keywords=["paris"],
        max_latency_seconds=15.0,
        tags=["factual", "geography"],
    ),
    EvalCase(
        case_id="smoke-003",
        suite="smoke",
        prompt="Extract only the numbers from: 'There are 3 cats and 7 dogs.'",
        expected_keywords=["3", "7"],
        max_latency_seconds=15.0,
        tags=["extraction", "structured"],
    ),
    EvalCase(
        case_id="smoke-004",
        suite="smoke",
        prompt="Who won the 2099 FIFA World Cup? Be honest if you don't know.",
        must_abstain=True,
        max_latency_seconds=15.0,
        tags=["abstain", "uncertainty"],
    ),
    EvalCase(
        case_id="smoke-005",
        suite="smoke",
        prompt=(
            "Summarize in one sentence: "
            "'The sun is a star at the center of the solar system. It provides light and heat.'"
        ),
        expected_keywords=["sun", "star"],
        max_latency_seconds=20.0,
        tags=["summarization", "concise"],
    ),
]
