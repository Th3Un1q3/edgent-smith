"""Fast benchmark eval suite – run on experiment candidates.

IMMUTABLE JUDGE: Do not modify during experiment cycles.
See EXPERIMENT_RULES.md.
"""

from __future__ import annotations

from eval.harness import EvalCase

BENCHMARK_CASES: list[EvalCase] = [
    EvalCase(
        case_id="bench-001",
        suite="benchmark",
        prompt="Convert 100 Fahrenheit to Celsius. Show only the numeric result.",
        expected_keywords=["37"],
        max_latency_seconds=20.0,
        tags=["arithmetic", "unit-conversion"],
    ),
    EvalCase(
        case_id="bench-002",
        suite="benchmark",
        prompt="List the first 5 prime numbers, comma-separated.",
        expected_keywords=["2", "3", "5", "7", "11"],
        max_latency_seconds=20.0,
        tags=["math", "listing"],
    ),
    EvalCase(
        case_id="bench-003",
        suite="benchmark",
        prompt="What is the output of: len('hello world')? Answer with just the number.",
        expected_keywords=["11"],
        max_latency_seconds=20.0,
        tags=["code", "python"],
    ),
    EvalCase(
        case_id="bench-004",
        suite="benchmark",
        prompt='Given JSON: {"name": "Alice", "age": 30}, what is the value of "name"?',
        expected_keywords=["alice"],
        max_latency_seconds=20.0,
        tags=["extraction", "json"],
    ),
    EvalCase(
        case_id="bench-005",
        suite="benchmark",
        prompt="Who is credited with inventing the telephone?",
        expected_keywords=["bell"],
        max_latency_seconds=20.0,
        tags=["factual", "history"],
    ),
    EvalCase(
        case_id="bench-006",
        suite="benchmark",
        prompt="What programming language is this code written in? `def hello(): pass`",
        expected_keywords=["python"],
        max_latency_seconds=15.0,
        tags=["code", "classification"],
    ),
    EvalCase(
        case_id="bench-007",
        suite="benchmark",
        prompt="What is 15% of 200? Answer with just the number.",
        expected_keywords=["30"],
        max_latency_seconds=15.0,
        tags=["arithmetic", "percentage"],
    ),
    EvalCase(
        case_id="bench-008",
        suite="benchmark",
        prompt="What major events happened on March 15, 2099? Be honest if you don't know.",
        must_abstain=True,
        max_latency_seconds=15.0,
        tags=["abstain", "future"],
    ),
    EvalCase(
        case_id="bench-009",
        suite="benchmark",
        prompt="Translate 'hello' to Spanish. Answer with just the word.",
        expected_keywords=["hola"],
        max_latency_seconds=15.0,
        tags=["language", "translation"],
    ),
    EvalCase(
        case_id="bench-010",
        suite="benchmark",
        prompt="What does HTTP stand for? Give only the expansion.",
        expected_keywords=["hypertext", "transfer", "protocol"],
        max_latency_seconds=15.0,
        tags=["tech", "acronym"],
    ),
]
