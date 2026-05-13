from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import click

REGISTRY_PATH = Path("experiments/registry.state.json")
ExperimentRecord = dict[str, Any]
Registry = dict[str, list[ExperimentRecord]]


def get_experiment_count() -> int:
    return len(_load_registry()["experiments"])


def format_experiment_context() -> str:
    experiments = _load_registry()["experiments"]
    pending = sorted(
        [
            experiment
            for experiment in experiments
            if experiment["status"] in {"pending", "running"}
        ],
        key=lambda experiment: (str(experiment["updated_at"]), str(experiment["id"])),
        reverse=True,
    )
    completed = sorted(
        [experiment for experiment in experiments if experiment["status"] == "completed"],
        key=lambda experiment: (str(experiment["updated_at"]), str(experiment["id"])),
        reverse=True,
    )

    lines = ["Pending experiments:"]
    if pending:
        lines.extend(_format_experiment_summary(experiment) for experiment in pending)
    else:
        lines.append("- none")

    lines.append("Recent completed experiments:")
    if completed:
        lines.extend(_format_experiment_summary(experiment) for experiment in completed)
    else:
        lines.append("- none")

    return "\n".join(lines)


def run_experiment_create(title: str, description: str) -> None:
    registry = _load_registry()
    experiment_id = _generate_experiment_id(registry["experiments"], title)

    timestamp = _utc_now()
    experiment: ExperimentRecord = {
        "id": experiment_id,
        "title": title,
        "description": description,
        "status": "pending",
        "created_at": timestamp,
        "updated_at": timestamp,
        "current_run_id": None,
        "runs": [],
    }
    registry["experiments"].append(experiment)
    _save_registry(registry)
    _echo_json(experiment)


def run_experiment_start(
    experiment_id: str,
    baseline_id: str,
    before_score: float,
    rerun_of_run_id: str | None,
) -> None:
    registry = _load_registry()
    experiment = _require_experiment(registry["experiments"], experiment_id)

    if experiment["status"] not in {"pending", "completed"}:
        raise click.ClickException(
            f"Experiment '{experiment_id}' cannot be started from status '{experiment['status']}'."
        )
    if experiment["current_run_id"] is not None:
        raise click.ClickException(f"Experiment '{experiment_id}' already has a running run.")
    if rerun_of_run_id is not None and not any(
        run["run_id"] == rerun_of_run_id for run in experiment["runs"]
    ):
        raise click.ClickException(
            f"Experiment '{experiment_id}' does not contain run '{rerun_of_run_id}'."
        )

    timestamp = _utc_now()
    run_id = f"run-{uuid4().hex[:12]}"
    run = {
        "run_id": run_id,
        "status": "running",
        "outcome": None,
        "baseline_id": baseline_id,
        "started_at": timestamp,
        "finished_at": None,
        "before_score": before_score,
        "after_score": None,
        "absolute_delta": None,
        "relative_delta": None,
        "rerun_of_run_id": rerun_of_run_id,
    }

    experiment["runs"].append(run)
    experiment["status"] = "running"
    experiment["current_run_id"] = run_id
    experiment["updated_at"] = timestamp
    _save_registry(registry)
    _echo_json(experiment)


def run_experiment_finish(
    experiment_id: str,
    run_status: str,
    after_score: float | None,
) -> None:
    registry = _load_registry()
    experiment = _require_experiment(registry["experiments"], experiment_id)

    if experiment["status"] != "running" or experiment["current_run_id"] is None:
        raise click.ClickException(f"Experiment '{experiment_id}' does not have a running run.")

    current_run = _require_run(experiment, experiment["current_run_id"])
    if run_status == "completed" and after_score is None:
        raise click.ClickException("Completed runs require --after-score.")
    if run_status != "completed" and after_score is not None:
        raise click.ClickException("--after-score can only be used when --status completed.")

    timestamp = _utc_now()
    current_run["status"] = run_status
    current_run["finished_at"] = timestamp

    if run_status == "completed":
        if after_score is None:
            raise click.ClickException("Completed runs require --after-score.")
        absolute_delta = after_score - current_run["before_score"]
        relative_delta = _calculate_relative_delta(current_run["before_score"], absolute_delta)
        current_run["after_score"] = after_score
        current_run["absolute_delta"] = absolute_delta
        current_run["relative_delta"] = relative_delta
        current_run["outcome"] = _classify_outcome(absolute_delta)
    else:
        current_run["after_score"] = None
        current_run["absolute_delta"] = None
        current_run["relative_delta"] = None
        current_run["outcome"] = None

    experiment["status"] = "completed"
    experiment["current_run_id"] = None
    experiment["updated_at"] = timestamp
    _save_registry(registry)
    _echo_json(experiment)


def run_experiment_list(
    status: str | None,
    baseline_id: str | None,
    outcome: str | None,
    limit: int | None,
    sort: str,
    sort_by: str,
) -> None:
    registry = _load_registry()
    experiments = registry["experiments"]

    if status is not None:
        experiments = [experiment for experiment in experiments if experiment["status"] == status]
    if baseline_id is not None:
        experiments = [
            experiment
            for experiment in experiments
            if any(run["baseline_id"] == baseline_id for run in experiment["runs"])
        ]
    if outcome is not None:
        experiments = [
            experiment
            for experiment in experiments
            if any(run["outcome"] == outcome for run in experiment["runs"])
        ]

    experiments = sorted(
        experiments,
        key=lambda experiment: experiment[sort_by],
        reverse=sort == "desc",
    )
    if limit is not None:
        experiments = experiments[:limit]

    _echo_json(experiments)


def run_experiment_show(experiment_id: str) -> None:
    registry = _load_registry()
    experiment = _require_experiment(registry["experiments"], experiment_id)
    _echo_json(experiment)


def _load_registry() -> Registry:
    if not REGISTRY_PATH.exists():
        return {"experiments": []}

    try:
        raw_registry = json.loads(REGISTRY_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise click.ClickException(f"Invalid registry file {REGISTRY_PATH}: {exc}") from exc

    if not isinstance(raw_registry, dict):
        raise click.ClickException(
            f"Invalid registry file {REGISTRY_PATH}: expected an object with an 'experiments' list."
        )

    experiments = raw_registry.get("experiments")
    if not isinstance(experiments, list):
        raise click.ClickException(
            f"Invalid registry file {REGISTRY_PATH}: expected an object with an 'experiments' list."
        )
    return {"experiments": cast(list[ExperimentRecord], experiments)}


def _save_registry(registry: Registry) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2) + "\n")


def _find_experiment(
    experiments: list[ExperimentRecord], experiment_id: str
) -> ExperimentRecord | None:
    for experiment in experiments:
        if experiment["id"] == experiment_id:
            return experiment
    return None


def _require_experiment(
    experiments: list[ExperimentRecord], experiment_id: str
) -> ExperimentRecord:
    experiment = _find_experiment(experiments, experiment_id)
    if experiment is None:
        raise click.ClickException(f"Experiment '{experiment_id}' was not found.")
    return experiment


def _generate_experiment_id(experiments: list[ExperimentRecord], title: str) -> str:
    base_id = _slugify_title(title)
    experiment_id = base_id
    suffix = 2

    while _find_experiment(experiments, experiment_id) is not None:
        experiment_id = f"{base_id}-{suffix}"
        suffix += 1

    return experiment_id


def _slugify_title(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "experiment"


def _require_run(experiment: ExperimentRecord, run_id: str) -> ExperimentRecord:
    runs = cast(list[ExperimentRecord], experiment["runs"])
    for run in runs:
        if run["run_id"] == run_id:
            return run
    raise click.ClickException(f"Experiment '{experiment['id']}' is missing run '{run_id}'.")


def _calculate_relative_delta(before_score: float, absolute_delta: float) -> float | None:
    if before_score == 0:
        return 0.0 if absolute_delta == 0 else None
    return absolute_delta / before_score


def _classify_outcome(absolute_delta: float) -> str:
    if absolute_delta > 0:
        return "improved"
    if absolute_delta < 0:
        return "regressed"
    return "no_change"


def _format_experiment_summary(experiment: ExperimentRecord) -> str:
    summary = f"- {experiment['id']} | {experiment['status']} | {experiment['title']}"
    latest_outcome = _get_latest_outcome(experiment)
    if latest_outcome is not None:
        summary = f"{summary} | last outcome: {latest_outcome}"
    return summary


def _get_latest_outcome(experiment: ExperimentRecord) -> str | None:
    runs = cast(list[ExperimentRecord], experiment.get("runs", []))
    for run in reversed(runs):
        outcome = run.get("outcome")
        if isinstance(outcome, str) and outcome:
            return outcome
    return None


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _echo_json(payload: object) -> None:
    click.echo(json.dumps(payload, indent=2))
