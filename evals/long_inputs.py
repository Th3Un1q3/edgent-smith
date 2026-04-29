"""Long-input evaluation set for the fake post-mortem.

Includes three tasks applied to the long post-mortem in
`evals/assets/fake-post-mortem.md`:

- Summarize the post-mortem in under 100 words.
- Extract the duration of the incident.
- Identify which deployment / change caused the incident.

This module follows the style used in `evals/smoke.py` and provides a
small set of custom evaluators appropriate for these extraction tasks.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext, IsInstance

from agents.edge import AgentOutput

# Load the long post-mortem text once at import-time so cases remain small.
_ASSETS = Path(__file__).parent / "assets"
_PM_PATH = _ASSETS / "fake-post-mortem.md"
_POSTMORTEM_TEXT = _PM_PATH.read_text(encoding="utf-8")


class SummaryUnder100Words(Evaluator[str, AgentOutput]):
    """Score summary answers that are under 100 words and mention key terms.

    Returns a score in [0.0, 1.0] equal to the fraction of expected keywords
    that appear in the answer if the word-count constraint is satisfied,
    otherwise 0.0.
    """

    KEYWORDS = [
        "merge queue",
        "squash",
        "data integrity",
        "revert",
        "deployment",
        "mitigat",
    ]

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        answer = (ctx.output.answer or "").strip()
        if not answer:
            return 0.0
        words = answer.split()
        if len(words) > 100:
            return 0.0
        text = answer.lower()
        hits = 0
        for kw in self.KEYWORDS:
            if kw in text:
                hits += 1
        return hits / len(self.KEYWORDS) if self.KEYWORDS else 1.0


class DurationContains(Evaluator[str, AgentOutput]):
    """Simple evaluator that checks for the presence of an expected HH:mm string.

    Returns 1.0 when the expected string (case-insensitive) appears in the
    agent answer, otherwise 0.0.
    """

    def __init__(self, expected_hhmm: str) -> None:
        self.expected = (expected_hhmm or "").strip()

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        answer = (ctx.output.answer or "").strip().lower()
        if not answer or not self.expected:
            return 0.0
        return 1.0 if self.expected.lower() in answer else 0.0


class ContainMatchingTokens(Evaluator[str, AgentOutput]):
    """Evaluator that checks for token matches in an answer.

    Configurable behaviour:
    - If `require_all` is True, returns 1.0 only when every token is present.
    - If `require_all` is False (default), returns a fractional score: either
      `hits / total_tokens` (default) or `min(hits * per_token_score, 1.0)` when
      `per_token_score` is provided. This allows, for example, scoring 0.3 for
      1 out of 3 tokens when `per_token_score=0.3`.
    """

    def __init__(
        self,
        tokens: Iterable[str],
        require_all: bool = False,
        per_token_score: float | None = None,
    ) -> None:
        self.tokens = [t.lower() for t in list(tokens)]
        self.require_all = bool(require_all)
        self.per_token_score = float(per_token_score) if per_token_score is not None else None

    def evaluate(self, ctx: EvaluatorContext[str, AgentOutput]) -> float:
        if not isinstance(ctx.output, AgentOutput):
            return 0.0
        text = (ctx.output.answer or "").lower()
        if not self.tokens:
            return 0.0

        hits = 0
        for t in self.tokens:
            if t in text:
                hits += 1

        if self.require_all:
            return 1.0 if hits == len(self.tokens) else 0.0
        # Partial scoring
        if self.per_token_score is not None:
            return min(hits * self.per_token_score, 1.0)
        return hits / len(self.tokens)


# ── Dataset ───────────────────────────────────────────────────────────────────

long_inputs_dataset: Dataset[str, AgentOutput] = Dataset(
    name="long_inputs",
    cases=[
        Case(
            name="summarize_postmortem",
            inputs=(
                "Summarize the post-mortem in under 100 words. "
                "Incident content below:\n\n" + _POSTMORTEM_TEXT
            ),
            evaluators=(IsInstance(type_name="AgentOutput"), SummaryUnder100Words()),
        ),
        Case(
            name="extract_duration",
            inputs=(
                "What's the total duration of the incident? Use HH:mm format to output result. "
                "Incident content below:\n\n" + _POSTMORTEM_TEXT
            ),
            expected_output=AgentOutput(answer="04:38"),
            evaluators=(
                IsInstance(type_name="AgentOutput"),
                DurationContains(expected_hhmm="04:38"),
            ),
        ),
        Case(
            name="deployment_cause",
            inputs=(
                "Which deployment caused the incident? Provide release id and PR number. "
                "Incident content below:\n\n" + _POSTMORTEM_TEXT
            ),
            expected_output=AgentOutput(
                answer="v2026.04.23.1 (PR #88392: mq_optimized_base_computation_v2)"
            ),
            evaluators=(
                IsInstance(type_name="AgentOutput"),
                # Partial matches allowed by default; require_all can be True
                ContainMatchingTokens(
                    tokens=(
                        "v2026.04.23.1",
                        "pr #88392",
                        "mq_optimized_base_computation_v2",
                    )
                ),
            ),
        ),
    ],
)
