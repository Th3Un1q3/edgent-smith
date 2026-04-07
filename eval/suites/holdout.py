"""Holdout eval suite – promotion gate, run last.

IMMUTABLE JUDGE: Do not modify during experiment cycles.
See EXPERIMENT_RULES.md.

These cases are not revealed to the experiment loop until promotion stage.
"""

from __future__ import annotations

from eval.harness import EvalCase

HOLDOUT_CASES: list[EvalCase] = [
    EvalCase(
        case_id="holdout-001",
        suite="holdout",
        prompt=(
            "You have a 3-litre jug and a 5-litre jug. How do you measure exactly 4 litres? "
            "Give a concise step-by-step answer."
        ),
        expected_keywords=["5", "3", "4"],
        max_latency_seconds=30.0,
        tags=["reasoning", "bounded-context"],
    ),
    EvalCase(
        case_id="holdout-002",
        suite="holdout",
        prompt="Sort this list in ascending order: [5, 2, 8, 1, 9]. Output only the sorted list.",
        expected_keywords=["1", "2", "5", "8", "9"],
        max_latency_seconds=15.0,
        tags=["sorting", "structured-output"],
    ),
    EvalCase(
        case_id="holdout-003",
        suite="holdout",
        prompt=(
            "Context: 'The meeting is on Tuesday at 3pm in room B.' "
            "Question: What room is the meeting in?"
        ),
        expected_keywords=["b"],
        max_latency_seconds=15.0,
        tags=["retrieval", "short-context"],
    ),
    EvalCase(
        case_id="holdout-004",
        suite="holdout",
        prompt="What is the airspeed velocity of an unladen African swallow? Be honest if unsure.",
        must_abstain=True,
        max_latency_seconds=15.0,
        tags=["abstain", "trick-question"],
    ),
    EvalCase(
        case_id="holdout-005",
        suite="holdout",
        prompt="Count the vowels in the word 'elephant'. Answer with just the number.",
        expected_keywords=["3"],
        max_latency_seconds=15.0,
        tags=["counting", "language"],
    ),
    EvalCase(
        case_id="holdout-006",
        suite="holdout",
        prompt=(
            "Given: x = 5, y = 3. What is x squared minus y? "
            "Show only the final number."
        ),
        expected_keywords=["22"],
        max_latency_seconds=15.0,
        tags=["arithmetic", "algebra"],
    ),
    EvalCase(
        case_id="holdout-007",
        suite="holdout",
        prompt=(
            "Instruction: Respond with exactly one word. "
            "What color is the sky on a clear day?"
        ),
        expected_keywords=["blue"],
        max_tokens_budget=10,
        max_latency_seconds=15.0,
        tags=["instruction-following", "low-token-budget"],
    ),
    EvalCase(
        case_id="holdout-008",
        suite="holdout",
        prompt=(
            "Is this statement true or false: "
            "'All squares are rectangles.' Answer true or false only."
        ),
        expected_keywords=["true"],
        max_latency_seconds=15.0,
        tags=["logic", "boolean"],
    ),
]
