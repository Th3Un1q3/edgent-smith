"""Immutable evaluation harness for edgent-smith.

THIS FILE IS PART OF THE IMMUTABLE JUDGE.
Do not modify during experiment cycles. See EXPERIMENT_RULES.md.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

import structlog

logger = structlog.get_logger(__name__)

AgentRunner = Callable[[str], Awaitable[Any]]


@dataclass
class EvalCase:
    """A single evaluation case."""

    case_id: str
    suite: str  # smoke | benchmark | holdout
    prompt: str
    expected_keywords: list[str] = field(default_factory=list)
    must_abstain: bool = False
    max_tokens_budget: int = 512
    max_latency_seconds: float = 30.0
    tags: list[str] = field(default_factory=list)


@dataclass
class EvalResult:
    """Result for a single evaluation case."""

    case_id: str
    suite: str
    passed: bool
    latency_seconds: float
    answer: str
    confidence: str
    tool_calls_used: int
    tokens_used: int | None
    error: str | None = None
    score: float = 0.0
    notes: str = ""


@dataclass
class SuiteResult:
    """Aggregated results for an evaluation suite."""

    suite: str
    timestamp: str
    cases_total: int
    cases_passed: int
    cases_failed: int
    avg_latency_seconds: float
    pass_rate: float
    composite_score: float
    results: list[EvalResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "suite": self.suite,
            "timestamp": self.timestamp,
            "cases_total": self.cases_total,
            "cases_passed": self.cases_passed,
            "cases_failed": self.cases_failed,
            "avg_latency_seconds": round(self.avg_latency_seconds, 3),
            "pass_rate": round(self.pass_rate, 4),
            "composite_score": round(self.composite_score, 4),
            "results": [
                {
                    "case_id": r.case_id,
                    "suite": r.suite,
                    "passed": r.passed,
                    "latency_seconds": round(r.latency_seconds, 3),
                    "confidence": r.confidence,
                    "tool_calls_used": r.tool_calls_used,
                    "tokens_used": r.tokens_used,
                    "score": round(r.score, 4),
                    "error": r.error,
                    "notes": r.notes,
                }
                for r in self.results
            ],
        }


class EvalHarness:
    """Runs evaluation suites against an agent runner function.

    IMMUTABLE JUDGE: This class defines scoring logic. Do not modify
    during experiment cycles. See EXPERIMENT_RULES.md.
    """

    def __init__(
        self,
        agent_runner: AgentRunner,
        results_dir: str = "experiments/results",
    ) -> None:
        self._runner = agent_runner
        self._results_dir = Path(results_dir)
        self._results_dir.mkdir(parents=True, exist_ok=True)

    async def run_suite(self, cases: list[EvalCase], suite_name: str) -> SuiteResult:
        """Run a list of eval cases and return aggregated results."""
        results: list[EvalResult] = []
        ts = datetime.now(tz=timezone.utc).isoformat()

        for case in cases:
            result = await self._run_case(case)
            results.append(result)
            logger.info(
                "eval.case",
                case_id=case.case_id,
                passed=result.passed,
                latency=round(result.latency_seconds, 2),
            )

        passed = sum(1 for r in results if r.passed)
        total = len(results)
        avg_latency = sum(r.latency_seconds for r in results) / max(total, 1)
        pass_rate = passed / max(total, 1)
        composite = self._composite_score(results)

        suite_result = SuiteResult(
            suite=suite_name,
            timestamp=ts,
            cases_total=total,
            cases_passed=passed,
            cases_failed=total - passed,
            avg_latency_seconds=avg_latency,
            pass_rate=pass_rate,
            composite_score=composite,
            results=results,
        )

        self._persist(suite_result)
        return suite_result

    async def _run_case(self, case: EvalCase) -> EvalResult:
        start = time.monotonic()
        try:
            result = await self._runner(case.prompt)
            latency = time.monotonic() - start

            answer = result.answer if hasattr(result, "answer") else str(result)
            confidence = result.confidence if hasattr(result, "confidence") else "medium"
            tool_calls = result.tool_calls_used if hasattr(result, "tool_calls_used") else 0
            tokens = result.tokens_used if hasattr(result, "tokens_used") else None

            passed, score, notes = self._score_case(case, answer, confidence, latency, tool_calls)

            return EvalResult(
                case_id=case.case_id,
                suite=case.suite,
                passed=passed,
                latency_seconds=latency,
                answer=answer,
                confidence=confidence,
                tool_calls_used=tool_calls,
                tokens_used=tokens,
                score=score,
                notes=notes,
            )
        except Exception as exc:
            latency = time.monotonic() - start
            return EvalResult(
                case_id=case.case_id,
                suite=case.suite,
                passed=False,
                latency_seconds=latency,
                answer="",
                confidence="abstain",
                tool_calls_used=0,
                tokens_used=None,
                error=str(exc),
                score=0.0,
                notes=f"exception: {exc}",
            )

    def _score_case(
        self,
        case: EvalCase,
        answer: str,
        confidence: str,
        latency: float,
        tool_calls: int,
    ) -> tuple[bool, float, str]:
        """Score a single case. Returns (passed, score 0-1, notes).

        IMMUTABLE SCORING LOGIC – do not change during experiments.
        """
        notes_parts: list[str] = []
        score = 1.0

        # Abstain check
        if case.must_abstain:
            passed = confidence == "abstain"
            if not passed:
                notes_parts.append("expected abstain but got answer")
                score = 0.0
            return passed, score, "; ".join(notes_parts)

        # Keyword check (case-insensitive)
        answer_lower = answer.lower()
        missing = [kw for kw in case.expected_keywords if kw.lower() not in answer_lower]
        if missing:
            notes_parts.append(f"missing keywords: {missing}")
            keyword_penalty = 0.4 * (len(missing) / max(len(case.expected_keywords), 1))
            score -= keyword_penalty

        # Latency penalty
        if latency > case.max_latency_seconds:
            notes_parts.append(f"latency {latency:.1f}s > {case.max_latency_seconds}s")
            score -= 0.2

        # Token budget approximation (rough word count heuristic)
        word_count = len(answer.split())
        if case.max_tokens_budget > 0 and word_count > case.max_tokens_budget * 0.75:
            notes_parts.append(f"answer length ({word_count} words) may exceed token budget")
            score -= 0.1

        score = max(0.0, min(1.0, score))
        passed = score >= 0.5 and not missing

        return passed, score, "; ".join(notes_parts)

    def _composite_score(self, results: list[EvalResult]) -> float:
        """Composite score = weighted average of case scores."""
        if not results:
            return 0.0
        return sum(r.score for r in results) / len(results)

    def _persist(self, suite_result: SuiteResult) -> None:
        """Persist suite result as JSON."""
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
        out_file = self._results_dir / f"{suite_result.suite}_{ts}.json"
        out_file.write_text(json.dumps(suite_result.to_dict(), indent=2))
        logger.info("eval.persisted", file=str(out_file))
