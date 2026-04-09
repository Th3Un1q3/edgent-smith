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

Run:
    python evals/smoke.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext, IsInstance
from pydantic_evals.reporting import EvaluationReport

from agents.edge import AgentOutput

_BASELINE_DIR = Path(__file__).parent


def baseline_file(model_name: str) -> Path:
    """Return the path to the baseline file for *model_name*.

    Baseline files are kept separate per model so that score changes caused by
    a model upgrade are not conflated with agent-logic improvements.

    Example::

        baseline_file("gpt-4o-mini-2024-07-18")
        # → evals/gpt-4o-mini-2024-07-18.baseline.json
    """
    safe_name = model_name.replace("/", "_").replace(":", "_")
    return _BASELINE_DIR / f"{safe_name}.baseline.json"


def _read_baseline(path: Path) -> tuple[int, list[str], dict[str, Any]]:
    """Return (score, passing_cases, raw_data) from the given baseline file.

    ``score`` is the count of fully-passing cases recorded at the last baseline
    update.  ``passing_cases`` is the list of their names — any case in this
    list that fails in the current run is treated as a regression.

    If the file does not exist yet (first run for a new model), returns
    sensible defaults that allow any score to pass.
    """
    if not path.exists():
        return 0, [], {"score": 0, "passing_cases": []}
    data = json.loads(path.read_text())
    return int(data["score"]), list(data.get("passing_cases", [])), data


def case_pass_results(report: EvaluationReport) -> dict[str, bool]:
    """Return ``{case_name: passed}`` for every case in *report*.

    A case is considered fully passing when:

    * it did not raise an exception during execution (not in ``report.failures``), AND
    * all of its boolean assertions are ``True``, AND
    * all of its numeric scores equal ``1.0``.

    Cases that appear in ``report.failures`` are recorded as ``False``.
    """
    results: dict[str, bool] = {f.name: False for f in report.failures}
    for case in report.cases:
        assertions_ok = all(r.value for r in case.assertions.values())
        scores_ok = all(v.value >= 1.0 for v in case.scores.values()) if case.scores else True
        results[case.name] = assertions_ok and scores_ok
    return results


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

    from agents.edge import _MODEL as _EDGE_MODEL
    from evals.runner import build_ollama_model, run_eval

    _parser = argparse.ArgumentParser(description="Run smoke evaluations for the edge agent.")
    _parser.add_argument(
        "--score-file",
        metavar="PATH",
        help="Write JSON score report to this file (for CI use).",
    )
    _parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="Overwrite the model-specific baseline when the new score exceeds it.",
    )
    _args = _parser.parse_args()

    run_eval(
        build_ollama_model(),
        baseline_key=_EDGE_MODEL,
        provider="ollama",
        score_file=_args.score_file,
        update_baseline=_args.update_baseline,
    )
