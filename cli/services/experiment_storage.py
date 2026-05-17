from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol, cast

import click

ExperimentRecord = dict[str, Any]

DEFAULT_STORAGE_DIR = Path("experiments")
DEFAULT_INDEX_PATH = DEFAULT_STORAGE_DIR / "index.json"


class ExperimentStorage(Protocol):
    def load_experiments(self) -> list[ExperimentRecord]:
        """Return all persisted experiments."""

    def save_experiments(self, experiments: list[ExperimentRecord]) -> None:
        """Persist the provided experiment records."""


class FileSystemExperimentStorage:
    """Filesystem-backed storage for CLI experiment state."""

    def __init__(self, storage_dir: Path = DEFAULT_STORAGE_DIR) -> None:
        self.storage_dir = storage_dir
        self.index_path = storage_dir / "index.json"
        self.experiments_dir = storage_dir / "experiments"

    def load_experiments(self) -> list[ExperimentRecord]:
        if self.index_path.exists():
            experiment_ids = self._load_index()
            return [self._load_experiment(experiment_id) for experiment_id in experiment_ids]
        return []

    def save_experiments(self, experiments: list[ExperimentRecord]) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.experiments_dir.mkdir(parents=True, exist_ok=True)

        experiment_ids: list[str] = []
        for experiment in experiments:
            experiment_id = self._require_string(experiment, "id", context="experiment record")
            experiment_ids.append(experiment_id)
            self._save_experiment(experiment_id, experiment)

        self.index_path.write_text(json.dumps(experiment_ids, indent=2) + "\n")

    def _load_index(self) -> list[str]:
        raw_index = self._load_json(self.index_path)
        if not isinstance(raw_index, list) or not all(isinstance(item, str) for item in raw_index):
            raise click.ClickException(
                f"Invalid experiment index {self.index_path}: expected a JSON array of IDs."
            )
        return cast(list[str], raw_index)

    def _load_experiment(self, experiment_id: str) -> ExperimentRecord:
        experiment_dir = self.experiments_dir / experiment_id
        spec_path = experiment_dir / "spec.md"
        status_path = experiment_dir / "status.json"
        meta_path = experiment_dir / "meta.json"

        if not spec_path.exists():
            raise click.ClickException(
                f"Invalid experiment storage for '{experiment_id}': missing {spec_path}."
            )
        description = spec_path.read_text()
        status = self._load_json_object(status_path)
        meta = self._load_json_object(meta_path)

        stored_id = self._require_string(meta, "id", context=str(meta_path))
        if stored_id != experiment_id:
            raise click.ClickException(
                f"Invalid experiment storage for '{experiment_id}': meta id mismatch '{stored_id}'."
            )

        current_run_id = status.get("current_run_id")
        if current_run_id is not None and not isinstance(current_run_id, str):
            msg = (
                f"Invalid experiment storage for '{experiment_id}': "
                "current_run_id must be a string or null."
            )
            raise click.ClickException(msg)

        runs = status.get("runs")
        if not isinstance(runs, list):
            raise click.ClickException(
                f"Invalid experiment storage for '{experiment_id}': runs must be a JSON array."
            )

        return {
            "id": stored_id,
            "title": self._require_string(meta, "title", context=str(meta_path)),
            "description": description,
            "status": self._require_string(status, "status", context=str(status_path)),
            "created_at": self._require_string(meta, "created_at", context=str(meta_path)),
            "updated_at": self._require_string(status, "updated_at", context=str(status_path)),
            "current_run_id": current_run_id,
            "runs": cast(list[ExperimentRecord], runs),
        }

    def _save_experiment(self, experiment_id: str, experiment: ExperimentRecord) -> None:
        experiment_dir = self.experiments_dir / experiment_id
        experiment_dir.mkdir(parents=True, exist_ok=True)

        (experiment_dir / "spec.md").write_text(
            self._require_string(experiment, "description", context="experiment record")
        )
        (experiment_dir / "meta.json").write_text(
            json.dumps(
                {
                    "id": experiment_id,
                    "title": self._require_string(
                        experiment,
                        "title",
                        context="experiment record",
                    ),
                    "created_at": self._require_string(
                        experiment,
                        "created_at",
                        context="experiment record",
                    ),
                    "github_issue_id": experiment.get("github_issue_id"),
                },
                indent=2,
            )
            + "\n"
        )
        (experiment_dir / "status.json").write_text(
            json.dumps(
                {
                    "status": self._require_string(
                        experiment,
                        "status",
                        context="experiment record",
                    ),
                    "updated_at": self._require_string(
                        experiment,
                        "updated_at",
                        context="experiment record",
                    ),
                    "current_run_id": experiment.get("current_run_id"),
                    "runs": self._require_runs(experiment),
                },
                indent=2,
            )
            + "\n"
        )

    def _load_json_object(self, path: Path) -> dict[str, Any]:
        raw_value = self._load_json(path)
        if not isinstance(raw_value, dict):
            raise click.ClickException(f"Invalid JSON object in {path}.")
        return cast(dict[str, Any], raw_value)

    def _load_json(self, path: Path) -> object:
        try:
            return json.loads(path.read_text())
        except FileNotFoundError as exc:
            raise click.ClickException(f"Missing experiment storage file: {path}") from exc
        except json.JSONDecodeError as exc:
            raise click.ClickException(f"Invalid JSON file {path}: {exc}") from exc

    def _require_runs(self, experiment: ExperimentRecord) -> list[ExperimentRecord]:
        runs = experiment.get("runs")
        if not isinstance(runs, list):
            raise click.ClickException("Invalid experiment record: runs must be a list.")
        return cast(list[ExperimentRecord], runs)

    def _require_string(self, payload: dict[str, Any], key: str, *, context: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str):
            raise click.ClickException(f"Invalid {context}: expected '{key}' to be a string.")
        return value


def get_default_experiment_storage() -> ExperimentStorage:
    return FileSystemExperimentStorage()


__all__ = [
    "DEFAULT_INDEX_PATH",
    "DEFAULT_STORAGE_DIR",
    "ExperimentRecord",
    "ExperimentStorage",
    "FileSystemExperimentStorage",
    "get_default_experiment_storage",
]
