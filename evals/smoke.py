"""Smoke evaluation dataset for the edge agent.

Uses pydantic_evals (shipped with pydantic-ai[evals]) – no custom wrapper code.

Run:
    python evals/smoke.py
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext, IsInstance

from agents.edge import AgentOutput, run_agent

_BASELINE_FILE = Path(__file__).parent / "baseline.json"


def _read_baseline() -> float:
    """Return the current baseline score from evals/baseline.json."""
    return float(json.loads(_BASELINE_FILE.read_text())["score"])


# ── Custom evaluator ───────────────────────────────────────────────────────────


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

# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    _parser = argparse.ArgumentParser(description="Run smoke evaluations for the edge agent.")
    _parser.add_argument(
        "--score-file",
        metavar="PATH",
        help="Write JSON score report to this file (for CI use).",
    )
    _args = _parser.parse_args()

    _report = smoke_dataset.evaluate_sync(run_agent)
    _report.print(include_input=True, include_output=True)

    _avg = _report.averages()
    _score = float(_avg.assertions) if _avg and _avg.assertions is not None else 0.0
    _baseline = _read_baseline()
    print(f"\nCI score: {_score:.4f}  (baseline: {_baseline})", flush=True)

    if _args.score_file:
        _result = {
            "score": round(_score, 4),
            "baseline": _baseline,
            "passed": _score >= _baseline,
            "cases_total": len(smoke_dataset.cases),
        }
        Path(_args.score_file).write_text(json.dumps(_result, indent=2))
