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
import importlib

from pydantic_evals.reporting import EvaluationReport

from agents.edge import AgentOutput, build_edge_agent
from config import ModelConfig, resolve_model_config
from evals.smoke import smoke_dataset


def load_dataset(set_spec: str) -> Any:
    """Resolve a dataset spec to a dataset object.

    Supported forms:
    - "smoke" -> uses the bundled `smoke_dataset` (default)
    - "module:attr" -> import `module` and return `attr`
    - "dotted.path.obj" -> import and return the named object
    - "<name>" -> attempts to import `evals.<name>` and find
      `<name>_dataset` or `dataset` inside it
    """
    if not set_spec or set_spec == "smoke":
        return smoke_dataset

    # module:attr form
    if ":" in set_spec:
        module, attr = set_spec.split(":", 1)
        mod = importlib.import_module(module)
        return getattr(mod, attr)

    # dotted path form
    if "." in set_spec:
        try:
            module_path, obj_name = set_spec.rsplit(".", 1)
            mod = importlib.import_module(module_path)
            return getattr(mod, obj_name)
        except Exception:
            pass

    # fallback: evals.<name> module with common attribute names
    try:
        mod = importlib.import_module(f"evals.{set_spec}")
        attr_name = f"{set_spec}_dataset"
        if hasattr(mod, attr_name):
            return getattr(mod, attr_name)
        if hasattr(mod, "dataset"):
            return getattr(mod, "dataset")
    except Exception:
        pass

    raise ImportError(f"Could not resolve dataset spec '{set_spec}'")


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
    dataset: Any | None = None,
    datasets: list[Any] | None = None,
    dataset_id: str | None = None,
    dataset_ids: list[str] | None = None,
) -> bool:
    """Run the given dataset with *model_config*; print results; return True if CI passed.

    Args:
        model_config: Config object from the registry.
        baseline_id: Optional identifier used to resolve the baseline file at
            ``../{baseline_id}.baseline.json`` and write the candidate file to
            ``../{baseline_id}.baseline-candidate.json``. Defaults to the model alias.
        dataset: Optional dataset object to evaluate (defaults to `smoke_dataset`).
        dataset_id: Optional string id for the dataset (used in output metadata).

    Returns:
        ``True`` if the score meets or exceeds the baseline; ``False`` otherwise.
    """
    agent = build_edge_agent(edge_model_config=model_config)

    # Support either a single `dataset` (backwards-compat) or multiple `datasets`.
    if datasets is None:
        if isinstance(dataset, list):
            datasets_list = dataset
        else:
            datasets_list = [dataset or smoke_dataset]
        dataset_ids_list = dataset_ids or [dataset_id]
    else:
        datasets_list = datasets
        dataset_ids_list = dataset_ids or [None] * len(datasets_list)

    baseline_id = baseline_id or model_config.alias
    baseline_path = baseline_file(baseline_id)
    candidate_path = baseline_candidate_file(baseline_id)

    async def _run(prompt: str) -> AgentOutput:
        result = await agent.run(prompt)
        return result.output

    # Evaluate each dataset and merge results. For single-dataset runs we
    # preserve the original, unprefixed case names for backward compatibility.
    combined_pass_results: dict[str, bool] = {}
    passing_case_durations: list[float] = []
    passing_now: list[str] = []
    combined_total_cases = 0

    multi = len(datasets_list) > 1
    for idx, ds in enumerate(datasets_list):
        ds_id = dataset_ids_list[idx] or getattr(ds, "name", None) or f"set{idx}"
        report = ds.evaluate_sync(_run, max_concurrency=3)
        print(f"\n--- Dataset: {ds_id} ---", flush=True)
        report.print(include_input=True, include_output=True)

        pr = case_pass_results(report)
        for case in report.cases:
            key = f"{ds_id}::{case.name}" if multi else case.name
            passed = pr.get(case.name, False)
            combined_pass_results[key] = passed
            if passed:
                passing_now.append(key)
                passing_case_durations.append(case.total_duration)

        combined_total_cases += len(report.cases)

    baseline_score, baseline_passing, _ = _read_baseline(baseline_path)
    regressions = [name for name in baseline_passing if not combined_pass_results.get(name, False)]

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

    dataset_display = "+".join(
        [
            dataset_ids_list[i] or getattr(datasets_list[i], "name", str(i))
            for i in range(len(datasets_list))
        ]
    )
    print(f"\nModel: {model_config.alias}  Datasets: {dataset_display}", flush=True)
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
        "cases_total": combined_total_cases,
        "passing_cases": passing_now,
        "regressions": regressions,
        "avg_passing_case_seconds": avg_passing_case_seconds,
        "effective_baseline_passing_count": baseline_case_count,
        "regression_penalty": regression_penalty,
        "model": model_config.alias,
        "datasets": dataset_display,
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
    _parser.add_argument(
        "--set",
        dest="sets",
        action="append",
        default=None,
        metavar="SET",
        help=(
            "Dataset set to run (alias, module:attr, or dotted path). "
            "Repeatable; defaults to 'smoke' when omitted."
        ),
    )
    _args = _parser.parse_args()

    cfg = resolve_model_config(_args.model)
    print(f"Using model alias: {cfg.alias}", flush=True)

    all_available_datasets = ["smoke", "extended"]

    # Resolve dataset set specifications (repeatable --set flag or env var)
    # Priority: CLI --set (repeatable) -> EDGENT_EVAL_SETS env var -> default 'smoke'
    env_sets = os.getenv("EDGENT_EVAL_SETS")
    if _args.sets:
        dataset_specs = _args.sets
    elif env_sets:
        dataset_specs = [s.strip() for s in env_sets.split(",") if s.strip()]
    else:
        dataset_specs = all_available_datasets

    datasets = []
    for spec in dataset_specs:
        try:
            datasets.append(load_dataset(spec))
        except Exception as e:
            print(f"Failed to load dataset '{spec}': {e}", flush=True)
            raise

    # If no explicit baseline id was provided, include the dataset specs to
    # isolate baselines per chosen dataset combination.
    computed_baseline_id = _args.baseline_id or f"{cfg.alias}_{'+'.join(dataset_specs)}"

    run_eval(
        cfg,
        baseline_id=computed_baseline_id,
        datasets=datasets,
        dataset_ids=dataset_specs,
    )
