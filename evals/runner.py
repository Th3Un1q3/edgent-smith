"""Unified eval runner for the edge agent.

Builds the right model (Ollama or GitHub Copilot) and then runs the shared smoke-eval loop.
Provider is auto-detected from the environment: Copilot is used when
``GITHUB_COPILOT_API_TOKEN`` is present, and Ollama is used otherwise.

Usage
-----
::

    # Auto-detect provider and run with defaults (use the `just` tasks)
    just eval

    # Run with a specific baseline ID
    just eval "edge_agent_default"

    # CI / local variants
    just eval-ci
    just eval-local
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

_PERFORMANCE_MULTIPLIER = 100
_REGRESSION_PENALTY = 2


# ── Baseline helpers ──────────────────────────────────────────────────────────

_BASELINE_ROOT = Path(__file__).parent.parent


def _sanitize_baseline_id(baseline_id: str) -> str:
    return baseline_id.replace("/", "_").replace(":", "_")


def baseline_file(baseline_id: str) -> Path:
    """Return the path to the baseline file for *baseline_id*.

    Baseline files are stored one directory above the eval runner, as
    ``../{baseline_id}.baseline.json``.
    """
    safe_id = _sanitize_baseline_id(baseline_id)
    return _BASELINE_ROOT / f"{safe_id}.baseline.json"


def baseline_candidate_file(baseline_id: str) -> Path:
    """Return the path to the baseline candidate file for *baseline_id*.

    The candidate file is written after every run to
    ``../{baseline_id}.baseline-candidate.json``.
    """
    safe_id = _sanitize_baseline_id(baseline_id)
    return _BASELINE_ROOT / f"{safe_id}.baseline-candidate.json"


def _read_baseline(path: Path) -> tuple[int, list[str], dict[str, Any]]:
    """Return (score, passing_cases, raw_data) from the given baseline file.

    If the file does not exist yet, returns zero score and empty passing cases.
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
    baseline_id: str | None = None,
) -> bool:
    """Run the smoke dataset with *model_config*; print results; return True if CI passed.

    Args:
        model_config: Config object from the registry.
        baseline_id: Optional identifier used to resolve the baseline file at
            ``../{baseline_id}.baseline.json`` and write the candidate file to
            ``../{baseline_id}.baseline-candidate.json``. Defaults to the model alias.

    Returns:
        ``True`` if the score meets or exceeds the baseline; ``False`` otherwise.
    """
    agent = build_edge_agent(edge_model_config=model_config)
    baseline_id = baseline_id or model_config.alias
    baseline_path = baseline_file(baseline_id)
    candidate_path = baseline_candidate_file(baseline_id)

    async def _run(prompt: str) -> AgentOutput:
        result = await agent.run(prompt)
        return result.output

    report = smoke_dataset.evaluate_sync(_run, max_concurrency=3)
    report.print(include_input=True, include_output=True)

    pass_results = case_pass_results(report)
    passing_now = [name for name, passed in pass_results.items() if passed]
    baseline_score, baseline_passing, _ = _read_baseline(baseline_path)
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

    print(f"\nModel: {model_config.alias}", flush=True)
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

    result_data: dict[str, Any] = {
        "score": score,
        "passed": ci_passed,
        "cases_total": len(smoke_dataset.cases),
        "passing_cases": passing_now,
        "regressions": regressions,
        "avg_passing_case_seconds": avg_passing_case_seconds,
        "effective_baseline_passing_count": baseline_case_count,
        "regression_penalty": regression_penalty,
        "model": model_config.alias,
        "baseline_id": baseline_id,
    }

    candidate_path.write_text(json.dumps(result_data, indent=2) + "\n")

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
        "--baseline-id",
        metavar="ID",
        help=(
            "Baseline identifier used to read ../{id}.baseline.json and write "
            "../{id}.baseline-candidate.json. Defaults to the model alias."
        ),
    )
    _args = _parser.parse_args()

    cfg = resolve_model_config(_args.model)
    print(f"Using model alias: {cfg.alias}", flush=True)

    run_eval(
        cfg,
        baseline_id=_args.baseline_id,
    )
