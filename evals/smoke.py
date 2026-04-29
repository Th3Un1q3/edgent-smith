"""Smoke evaluation dataset for the edge agent.

Uses pydantic_evals (shipped with pydantic-ai[evals]) – no custom wrapper code.

Scoring
-------
The CI score is computed from the baseline pass count adjusted for timing
and regression penalty.
A case is fully passing when all of its assertions are ``True`` *and* all of
its keyword-match scores equal ``1.0``.

This means:

* Adding a new case that passes → can improve the average execution time.
* Adding a new case that fails  → does not automatically block promotion;
  regressions incur a fixed penalty and are reflected in the score.
* Regression counts are applied as a penalty rather than a simple boolean
  blocker.
"""

from __future__ import annotations

import re
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext, IsInstance

from agents.edge import AgentOutput

# ── Custom evaluators ──────────────────────────────────────────────────────────


class KeywordsPresent(Evaluator[str, AgentOutput]):
    """Pass if all expected keywords appear in the answer (case-insensitive).

    Matching uses word-boundary-aware regular expressions to avoid partial
    substring matches (for example, matching `3` won't match `13`).
    """

    def __init__(self, *keywords: str) -> None:
        self.keywords = list(keywords)

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        answer = ctx.output.answer
        if not self.keywords:
            return 1.0
        hits = 0
        for kw in self.keywords:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, answer, flags=re.IGNORECASE):
                hits += 1
        return hits / len(self.keywords)


class Abstains(Evaluator[str, AgentOutput]):
    """Score 1.0 if the agent sets confidence to 'abstain', else 0.0."""

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        return 1.0 if ctx.output.confidence == "abstain" else 0.0


# ── Smoke dataset ──────────────────────────────────────────────────────────────

smoke_dataset: Dataset[str, AgentOutput] = Dataset(
    name="smoke",
    cases=[
        Case(
            name="arithmetic",
            inputs="What is 512 + 1024? Answer with just the number.",
            evaluators=(IsInstance(type_name="AgentOutput"), KeywordsPresent("1536")),
        ),
        Case(
            name="factual_geography",
            inputs="What is the capital of France? Answer with just the city name.",
            evaluators=(IsInstance(type_name="AgentOutput"), KeywordsPresent("paris")),
        ),
        Case(
            name="extraction",
            inputs="Extract only the numbers from: 'There are 3 cats and 7 dogs.'",
            evaluators=(IsInstance(type_name="AgentOutput"), KeywordsPresent("3", "7")),
        ),
        Case(
            name="abstain_future_event",
            inputs="Who won the 2099 FIFA World Cup? Be honest if you don't know.",
            evaluators=(Abstains(),),
        ),
        Case(
            name="summarization",
            inputs=(
                "Summarize in one sentence: "
                "'The sun is a star at the center of the solar system. "
                "It provides light and heat.'"
            ),
            evaluators=(IsInstance(type_name="AgentOutput"), KeywordsPresent("sun", "star")),
        ),
    ],
)
