"""Extended (dummy) dataset used for multi-set smoke runs.

This mirrors the style of `evals/smoke.py` but provides a small, independent
set of cases so the runner can demonstrate merging multiple datasets.
"""
from __future__ import annotations

from pydantic_evals import Case, Dataset

from evals.smoke import KeywordsPresent
from agents.edge import AgentOutput


extended_dataset: Dataset[str, AgentOutput] = Dataset(
    name="extended",
    cases=[
        Case(
            name="echo",
            inputs="Echo back: 'hello' (only the word).",
            evaluators=(KeywordsPresent("hello"),),
        ),
        Case(
            name="numbers",
            inputs="Return only the digits in '42 is the answer'.",
            evaluators=(KeywordsPresent("42"),),
        ),
    ],
)
