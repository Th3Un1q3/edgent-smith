"""Smoke evaluation dataset for the edge agent.

Uses pydantic_evals (shipped with pydantic-ai[evals]) – no custom wrapper code.

Scoring
-------
The CI score is the **count of fully-passing cases** (not an average ratio).
A case is fully passing when all of its assertions are ``True`` *and* all of
its keyword-match scores equal ``1.0``.

This means:

* Adding a new case that passes → score increases (improvement).
* Adding a new case that fails  → score is unchanged (no penalty for growth).
* An existing case starts failing → score decreases AND a regression is
  flagged, which blocks promotion regardless of the total count.
"""

from __future__ import annotations

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext, IsInstance

from agents.edge import AgentOutput

# ── Custom evaluators ──────────────────────────────────────────────────────────


class KeywordsPresent(Evaluator[str, AgentOutput]):
    """Pass if all expected keywords appear in the answer (case-insensitive)."""

    def __init__(self, *keywords: str) -> None:
        self.keywords = [k.lower() for k in keywords]

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        answer = ctx.output.answer.lower()
        hits = sum(1 for kw in self.keywords if kw in answer)
        return hits / len(self.keywords) if self.keywords else 1.0


class Abstains(Evaluator[str, AgentOutput]):
    """Pass if the agent sets confidence to 'abstain'."""

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> bool:
        if not isinstance(ctx.output, AgentOutput):
            return False
        return ctx.output.confidence == "abstain"


# ── Smoke dataset ──────────────────────────────────────────────────────────────

smoke_dataset: Dataset[str, AgentOutput] = Dataset(
    name="smoke",
    cases=[
        Case(
            name="arithmetic",
            inputs="What is 2 + 2? Answer with just the number.",
            evaluators=(IsInstance(type_name="AgentOutput"), KeywordsPresent("4")),
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
