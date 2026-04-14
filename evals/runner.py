"""Unified eval runner for the edge agent.

Builds the right model (Ollama or GitHub Copilot) based on ``--provider`` and
then runs the shared smoke-eval loop.  Provider is auto-detected when omitted:
Copilot is used when ``GITHUB_COPILOT_API_TOKEN`` is present in the environment;
Ollama is used otherwise.

Usage
-----
::

    # Auto-detect provider and run with defaults
    python evals/runner.py

    # Explicit provider
    python evals/runner.py --provider ollama --model gemma4:e2b
    python evals/runner.py --provider copilot --model gpt-4o-mini-2024-07-18

    # Extra options
    python evals/runner.py --score-file /tmp/score.json
    python evals/runner.py --update-baseline
    python evals/runner.py --provider ollama --base-url http://localhost:11434/v1
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pydantic_evals.reporting import EvaluationReport

from agents.edge import AgentOutput, build_edge_agent
from config import ModelConfig, resolve_model_config
from evals.smoke import smoke_dataset

# ── Constants ──────────────────────────────────────────────────────────────────

_BASELINE_DIR = Path(__file__).parent
_PERFORMANCE_MULTIPLIER = 100
_REGRESSION_PENALTY = 2


# ── Baseline helpers ──────────────────────────────────────────────────────────


def baseline_file(model_name: str) -> Path:
    """Return the path to the baseline file for *model_name*.

    Baseline files are kept separate per model so that score changes caused by
    a model upgrade are not conflated with agent-logic improvements.
    """
    safe_name = model_name.replace("/", "_").replace(":", "_")
    return _BASELINE_DIR / f"{safe_name}.baseline.json"


def _read_baseline(path: Path) -> tuple[int, list[str], dict[str, Any]]:
    """Return (score, passing_cases, raw_data) from the given baseline file.

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
    """
    results: dict[str, bool] = {f.name: False for f in report.failures}
    for case in report.cases:
        assertions_ok = all(r.value for r in case.assertions.values())
        scores_ok = all(v.value >= 1.0 for v in case.scores.values()) if case.scores else True
        results[case.name] = assertions_ok and scores_ok
    return results


# ── Shared eval loop ───────────────────────────────────────────────────────────


def run_eval(
    model_config: ModelConfig,
    *,
    score_file: str | Path | None = None,
    update_baseline: bool = False,
) -> bool:
    """Run the smoke dataset with *model_config*; print results; return True if CI passed.

    Args:
        model_config: Config object from the registry.
        score_file: Optional path; when given, a JSON score report is written.
        update_baseline: When ``True``, overwrites the baseline if score improved.

    Returns:
        ``True`` if the score meets or exceeds the baseline; ``False`` otherwise.
    """
    agent = build_edge_agent(edge_model_config=model_config)
    baseline_key = model_config.alias
    baseline_path = baseline_file(baseline_key)

    async def _run(prompt: str) -> AgentOutput:
        result = await agent.run(prompt)
        return result.output

    report = smoke_dataset.evaluate_sync(_run, max_concurrency=3)
    report.print(include_input=True, include_output=True)

    pass_results = case_pass_results(report)
    passing_now = [name for name, passed in pass_results.items() if passed]
    baseline_score, baseline_passing, baseline_data = _read_baseline(baseline_path)
    regressions = [name for name in baseline_passing if not pass_results.get(name, False)]

    passing_case_durations = [
        case.total_duration for case in report.cases if pass_results.get(case.name, False)
    ]
    avg_passing_case_seconds = (
        sum(passing_case_durations) / len(passing_case_durations) if passing_case_durations else 0.0
    )

    if baseline_passing:
        baseline_case_count = len(baseline_passing)
        regression_penalty = len(regressions) * _REGRESSION_PENALTY
        effective_count = max(baseline_case_count - regression_penalty, 0)
    else:
        baseline_case_count = len(passing_now)
        regression_penalty = 0
        effective_count = baseline_case_count

    score = (
        int((effective_count * _PERFORMANCE_MULTIPLIER) / avg_passing_case_seconds)
        if avg_passing_case_seconds
        else 0
    )

    print(f"\nModel: {baseline_key}", flush=True)
    print(f"Passing cases: {passing_now}", flush=True)
    print(f"Average passing-case time: {avg_passing_case_seconds:.2f}s", flush=True)
    print(f"Effective baseline pass count: {baseline_case_count}", flush=True)
    print(f"Regression penalty: {regression_penalty}", flush=True)
    if not baseline_passing:
        print("No prior baseline; regression penalty is suppressed.", flush=True)
    print(f"CI score: {score}  (baseline: {baseline_score})", flush=True)
    if regressions:
        print(f"REGRESSIONS detected: {regressions}", flush=True)

    ci_passed = score >= baseline_score

    if update_baseline:
        if score > baseline_score:
            baseline_data["score"] = score
            baseline_data["passing_cases"] = passing_now
            baseline_data["avg_passing_case_seconds"] = avg_passing_case_seconds
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
            "avg_passing_case_seconds": avg_passing_case_seconds,
            "effective_baseline_passing_count": baseline_case_count,
            "regression_penalty": regression_penalty,
            "model": baseline_key,
        }
        Path(score_file).write_text(json.dumps(result_data, indent=2))

    return ci_passed


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    _parser = argparse.ArgumentParser(description="Run smoke evals against the edge agent.")
    _parser.add_argument(
        "--model",
        default=os.getenv("EDGENT_MODEL_ALIAS", "edge_agent_default"),
        metavar="ALIAS",
        help="Registry alias to run (default: edge_agent_default)",
    )
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

    cfg = resolve_model_config(_args.model)
    print(f"Using model alias: {cfg.alias}", flush=True)

    run_eval(
        cfg,
        score_file=_args.score_file,
        update_baseline=_args.update_baseline,
    )
