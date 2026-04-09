"""Shared smoke-eval loop used by all provider-specific runners.

Both ``evals/ollama_runner.py`` and ``evals/copilot_runner.py`` delegate to
:func:`run_eval` so that the evaluate → score → baseline → report logic lives
in exactly one place.  Each runner is responsible only for building a
provider-specific model and supplying the handful of parameters that differ
between providers (baseline key, provider label, etc.).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic_ai.models.openai import OpenAIChatModel

from agents.edge import AgentOutput
from agents.edge import agent as edge_agent
from evals.smoke import _read_baseline, baseline_file, case_pass_results, smoke_dataset


def run_eval(
    model: OpenAIChatModel,
    *,
    baseline_key: str,
    provider: str,
    model_label: str | None = None,
    score_file: str | Path | None = None,
    update_baseline: bool = False,
) -> bool:
    """Run the smoke dataset with *model*; print results; return True if CI passed.

    Args:
        model: Constructed model injected into the agent at call-time.
        baseline_key: Key used to look up / store the baseline file (e.g.
            ``"ollama:gemma4:e2b"`` or ``"gpt-4o-mini-2024-07-18"``).
        provider: Provider label written to the score-file JSON (e.g.
            ``"ollama"`` or ``"github-copilot"``).
        model_label: Human-readable label printed in the summary line.
            Defaults to *baseline_key*.
        score_file: Optional path; when given, a JSON score report is written.
        update_baseline: When ``True``, overwrites the baseline if score improved.

    Returns:
        ``True`` if the score meets or exceeds the baseline and no regressions
        were detected; ``False`` otherwise.
    """
    label = model_label or baseline_key
    baseline_path = baseline_file(baseline_key)

    async def _run(prompt: str) -> AgentOutput:
        result = await edge_agent.run(prompt, model=model)
        return result.output

    report = smoke_dataset.evaluate_sync(_run)
    report.print(include_input=True, include_output=True)

    pass_results = case_pass_results(report)
    passing_now = [name for name, passed in pass_results.items() if passed]
    score = len(passing_now)
    baseline_score, baseline_passing, baseline_data = _read_baseline(baseline_path)
    regressions = [name for name in baseline_passing if not pass_results.get(name, False)]

    print(f"\nModel: {label}", flush=True)
    print(f"CI score: {score}  (baseline: {baseline_score})", flush=True)
    if regressions:
        print(f"REGRESSIONS detected: {regressions}", flush=True)

    ci_passed = score >= baseline_score and not regressions

    if update_baseline:
        if score > baseline_score:
            baseline_data["score"] = score
            baseline_data["passing_cases"] = passing_now
            baseline_path.write_text(json.dumps(baseline_data, indent=2) + "\n")
            print(f"Baseline updated: {baseline_score} → {score}", flush=True)
        elif score == baseline_score:
            print(f"Baseline unchanged: {baseline_score} (score equal)", flush=True)
        else:
            print(f"Baseline NOT updated: score {score} < baseline {baseline_score}", flush=True)

    if score_file:
        result_data: dict[str, Any] = {
            "score": score,
            "baseline": baseline_score,
            "passed": ci_passed,
            "cases_total": len(smoke_dataset.cases),
            "passing_cases": passing_now,
            "regressions": regressions,
            "model": baseline_key,
            "provider": provider,
        }
        Path(score_file).write_text(json.dumps(result_data, indent=2))

    return ci_passed
