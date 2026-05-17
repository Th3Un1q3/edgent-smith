from __future__ import annotations

import json
import pathlib
from typing import Any

from cli.services.experiment_storage import FileSystemExperimentStorage

JsonObject = dict[str, Any]


def test_filesystem_storage_round_trips_experiments(tmp_path: pathlib.Path) -> None:
    storage = FileSystemExperimentStorage(storage_dir=tmp_path / "experiments")
    experiments: list[JsonObject] = [
        {
            "id": "candidate-improvement",
            "title": "Candidate improvement",
            "description": "Measure whether the candidate beats baseline.",
            "status": "pending",
            "created_at": "2026-05-17T12:00:00Z",
            "updated_at": "2026-05-17T12:00:00Z",
            "current_run_id": None,
            "runs": [],
        }
    ]

    storage.save_experiments(experiments)

    assert json.loads((tmp_path / "experiments/index.json").read_text()) == [
        "candidate-improvement"
    ]
    assert (
        tmp_path / "experiments/experiments/candidate-improvement/spec.md"
    ).read_text() == "Measure whether the candidate beats baseline."
    assert json.loads(
        (tmp_path / "experiments/experiments/candidate-improvement/meta.json").read_text()
    ) == {
        "id": "candidate-improvement",
        "title": "Candidate improvement",
        "created_at": "2026-05-17T12:00:00Z",
        "github_issue_id": None,
    }
    assert json.loads(
        (tmp_path / "experiments/experiments/candidate-improvement/status.json").read_text()
    ) == {
        "status": "pending",
        "updated_at": "2026-05-17T12:00:00Z",
        "current_run_id": None,
        "runs": [],
    }
    assert storage.load_experiments() == experiments


def test_filesystem_storage_returns_empty_without_index(tmp_path: pathlib.Path) -> None:
    storage_dir = tmp_path / "experiments"
    storage_dir.mkdir(parents=True, exist_ok=True)

    storage = FileSystemExperimentStorage(storage_dir=storage_dir)

    assert storage.load_experiments() == []
