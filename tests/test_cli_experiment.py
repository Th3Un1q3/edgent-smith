from __future__ import annotations

import json
import os
import pathlib
import subprocess
from typing import Any, cast

import pytest
from click.testing import CliRunner

from cli.main import cli

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
STORAGE_DIR = pathlib.Path("experiments")
INDEX_PATH = STORAGE_DIR / "index.json"
EXPERIMENTS_DIR = STORAGE_DIR / "experiments"
JsonObject = dict[str, Any]


def _invoke_json_object(runner: CliRunner, args: list[str]) -> JsonObject:
    result = runner.invoke(cli, args)
    assert result.exit_code == 0, result.output
    return cast(JsonObject, json.loads(result.output))


def _invoke_json_list(runner: CliRunner, args: list[str]) -> list[JsonObject]:
    result = runner.invoke(cli, args)
    assert result.exit_code == 0, result.output
    return cast(list[JsonObject], json.loads(result.output))


def _invoke_error(runner: CliRunner, args: list[str]) -> str:
    result = runner.invoke(cli, args)
    assert result.exit_code != 0
    return result.output


def _read_json(path: pathlib.Path) -> JsonObject:
    return cast(JsonObject, json.loads(path.read_text()))


def test_just_autoreseach_recipe_alias_routes_to_python_cli() -> None:
    result = subprocess.run(
        ["just", "--dry-run", "autoresearch", "experiment", "list"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    rendered = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert 'uv run python -m cli autoresearch "$@"' in rendered


def test_just_autoresearch_create_forwards_multiline_description_without_reparsing(
    tmp_path: pathlib.Path,
) -> None:
    description = "line1\n# heading\nline3"
    title = "multiline-hash-description"
    isolated_justfile = tmp_path / "justfile"
    isolated_justfile.write_text((REPO_ROOT / "justfile").read_text())

    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT)
    env["UV_PROJECT"] = str(REPO_ROOT)

    result = subprocess.run(
        [
            "just",
            "autoresearch",
            "experiment",
            "create",
            "--title",
            title,
            "--description",
            description,
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    created = cast(JsonObject, json.loads(result.stdout))
    assert created["title"] == title
    assert created["description"] == description

    assert json.loads((tmp_path / "experiments/index.json").read_text()) == [title]
    assert (tmp_path / "experiments/experiments" / title / "spec.md").read_text() == description


def test_experiment_lifecycle_persists_registry_and_supports_reruns(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        created = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Improve baseline",
                "--description",
                "Measure whether the candidate improves the baseline.",
            ],
        )

        assert created["id"] == "improve-baseline"
        assert created["status"] == "pending"
        assert created["current_run_id"] is None
        assert created["runs"] == []
        experiment_dir = EXPERIMENTS_DIR / "improve-baseline"

        assert INDEX_PATH.exists()
        assert json.loads(INDEX_PATH.read_text()) == ["improve-baseline"]
        assert experiment_dir.exists()
        assert (experiment_dir / "spec.md").read_text() == (
            "Measure whether the candidate improves the baseline."
        )

        status = _read_json(experiment_dir / "status.json")
        meta = _read_json(experiment_dir / "meta.json")

        assert status == {
            "status": "pending",
            "updated_at": created["updated_at"],
            "current_run_id": None,
            "runs": [],
        }
        assert meta == {
            "id": "improve-baseline",
            "title": "Improve baseline",
            "created_at": created["created_at"],
            "github_issue_id": None,
        }

        experiment_id = cast(str, created["id"])

        started = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                experiment_id,
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "0.5",
            ],
        )

        first_run = started["runs"][0]
        first_run_id = first_run["run_id"]
        assert started["status"] == "running"
        assert started["current_run_id"] == first_run_id
        assert first_run["status"] == "running"
        assert first_run["outcome"] is None
        assert first_run["baseline_id"] == "baseline-a"
        assert first_run["before_score"] == 0.5
        assert first_run["after_score"] is None
        assert first_run["rerun_of_run_id"] is None

        finished = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                experiment_id,
                "--status",
                "completed",
                "--after-score",
                "0.7",
            ],
        )

        completed_run = finished["runs"][0]
        assert finished["status"] == "completed"
        assert finished["current_run_id"] is None
        assert completed_run["status"] == "completed"
        assert completed_run["after_score"] == 0.7
        assert completed_run["outcome"] == "improved"
        assert completed_run["absolute_delta"] == pytest.approx(0.2)
        assert completed_run["relative_delta"] == pytest.approx(0.4)
        assert completed_run["finished_at"] is not None

        rerun_started = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                experiment_id,
                "--baseline-id",
                "baseline-b",
                "--before-score",
                "0.7",
                "--rerun-of",
                first_run_id,
            ],
        )

        rerun = rerun_started["runs"][1]
        assert rerun_started["status"] == "running"
        assert rerun_started["current_run_id"] == rerun["run_id"]
        assert rerun["status"] == "running"
        assert rerun["baseline_id"] == "baseline-b"
        assert rerun["rerun_of_run_id"] == first_run_id

        rerun_finished = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                experiment_id,
                "--status",
                "failed",
            ],
        )

        rerun_result = rerun_finished["runs"][1]
        assert rerun_finished["status"] == "completed"
        assert rerun_finished["current_run_id"] is None
        assert rerun_result["status"] == "failed"
        assert rerun_result["outcome"] is None
        assert rerun_result["after_score"] is None
        assert rerun_result["absolute_delta"] is None
        assert rerun_result["relative_delta"] is None
        assert rerun_result["finished_at"] is not None

        shown = _invoke_json_object(
            runner,
            ["autoresearch", "experiment", "show", experiment_id],
        )

        assert shown == rerun_finished
        assert json.loads(INDEX_PATH.read_text()) == [experiment_id]
        assert _read_json(experiment_dir / "status.json") == {
            "status": shown["status"],
            "updated_at": shown["updated_at"],
            "current_run_id": shown["current_run_id"],
            "runs": shown["runs"],
        }
        assert _read_json(experiment_dir / "meta.json") == {
            "id": shown["id"],
            "title": shown["title"],
            "created_at": shown["created_at"],
            "github_issue_id": None,
        }
        assert (experiment_dir / "spec.md").read_text() == shown["description"]


def test_experiment_list_filters_by_status_baseline_outcome_limit_and_sort(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Older experiment",
                "--description",
                "First experiment.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "older-experiment",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "older-experiment",
                "--status",
                "completed",
                "--after-score",
                "1.1",
            ],
        )

        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Newer experiment",
                "--description",
                "Second experiment.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "newer-experiment",
                "--baseline-id",
                "baseline-b",
                "--before-score",
                "2.0",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "newer-experiment",
                "--status",
                "completed",
                "--after-score",
                "1.5",
            ],
        )

        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Pending experiment",
                "--description",
                "Not started yet.",
            ],
        )

        completed_desc = _invoke_json_list(
            runner,
            [
                "autoresearch",
                "experiment",
                "list",
                "--status",
                "completed",
                "--sort",
                "desc",
                "--sort-by",
                "updated_at",
            ],
        )
        assert [item["id"] for item in completed_desc] == ["newer-experiment", "older-experiment"]

        improved = _invoke_json_list(
            runner,
            [
                "autoresearch",
                "experiment",
                "list",
                "--baseline-id",
                "baseline-a",
                "--outcome",
                "improved",
                "--limit",
                "1",
                "--sort",
                "asc",
                "--sort-by",
                "created_at",
            ],
        )
        assert [item["id"] for item in improved] == ["older-experiment"]


def test_autoresearch_help_exposes_experiment_and_design_command() -> None:
    runner = CliRunner()

    result = runner.invoke(cli, ["autoresearch", "--help"])

    assert result.exit_code == 0
    assert "experiment" in result.output
    assert "design" in result.output
    assert "registry CRUD only" in result.output


def test_experiment_help_clarifies_registry_ownership_and_input_rule() -> None:
    runner = CliRunner()

    result = runner.invoke(cli, ["autoresearch", "experiment", "--help"])
    normalized_output = " ".join(result.output.split())

    assert result.exit_code == 0
    assert "registry CRUD only" in result.output
    assert "does not run experiment execution" in result.output
    assert (
        "create uses named inputs; start, finish, and show use positional "
        "experiment_id values; list remains the non-targeting exception." in normalized_output
    )
    assert "other subcommands target an existing experiment_id" not in normalized_output

    start_help = runner.invoke(cli, ["autoresearch", "experiment", "start", "--help"])
    list_help = runner.invoke(cli, ["autoresearch", "experiment", "list", "--help"])

    assert start_help.exit_code == 0
    assert "EXPERIMENT_ID" in start_help.output
    assert list_help.exit_code == 0
    assert "EXPERIMENT_ID" not in list_help.output


def test_experiment_create_generates_unique_suffix_for_duplicate_titles(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        created = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Duplicate test",
                "--description",
                "Seed registry with one experiment.",
            ],
        )

        duplicate = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Duplicate test",
                "--description",
                "Attempt duplicate creation.",
            ],
        )

        assert created["id"] == "duplicate-test"
        assert duplicate["id"] == "duplicate-test-2"


def test_experiment_create_rejects_manual_experiment_id_argument(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "manual-id",
                "--title",
                "Manual id",
                "--description",
                "This should no longer be accepted.",
            ],
        )

        assert "Error: Got unexpected extra argument (manual-id)" in output


def test_experiment_start_rejects_missing_experiment(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "exp-missing",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )

        assert "Error: Experiment 'exp-missing' was not found." in output


def test_experiment_start_rejects_invalid_transition_when_run_is_active(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Running experiment",
                "--description",
                "Already in progress.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "running-experiment",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )

        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "running-experiment",
                "--baseline-id",
                "baseline-b",
                "--before-score",
                "1.1",
            ],
        )

        assert (
            "Error: Experiment 'running-experiment' cannot be started from status "
            "'running'." in output
        )


def test_experiment_start_rejects_unknown_rerun_reference(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Rerun validation",
                "--description",
                "Reject unknown rerun IDs.",
            ],
        )

        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "rerun-validation",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
                "--rerun-of",
                "run-missing",
            ],
        )

        assert "Error: Experiment 'rerun-validation' does not contain run 'run-missing'." in output


def test_experiment_finish_rejects_missing_experiment(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "exp-missing",
                "--status",
                "completed",
                "--after-score",
                "1.0",
            ],
        )

        assert "Error: Experiment 'exp-missing' was not found." in output


def test_experiment_finish_rejects_invalid_transition_when_no_run_is_active(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Finish validation",
                "--description",
                "No running run is present.",
            ],
        )

        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "finish-validation",
                "--status",
                "completed",
                "--after-score",
                "1.0",
            ],
        )

        assert "Error: Experiment 'finish-validation' does not have a running run." in output


def test_experiment_finish_requires_after_score_for_completed_runs(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Completed score required",
                "--description",
                "Completed runs need an after score.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "completed-score-required",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )

        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "completed-score-required",
                "--status",
                "completed",
            ],
        )

        assert "Error: Completed runs require --after-score." in output


def test_experiment_finish_rejects_after_score_for_non_completed_runs(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Failed score rejected",
                "--description",
                "After scores only apply to completed runs.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "failed-score-rejected",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )

        output = _invoke_error(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "failed-score-rejected",
                "--status",
                "failed",
                "--after-score",
                "0.9",
            ],
        )

        assert "Error: --after-score can only be used when --status completed." in output


def test_experiment_finish_classifies_regressed_outcome(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Regression case",
                "--description",
                "Explicit regression classification.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "regression-case",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "2.0",
            ],
        )

        finished = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "regression-case",
                "--status",
                "completed",
                "--after-score",
                "1.5",
            ],
        )

        run = finished["runs"][0]
        assert run["outcome"] == "regressed"
        assert run["absolute_delta"] == pytest.approx(-0.5)
        assert run["relative_delta"] == pytest.approx(-0.25)


def test_experiment_finish_classifies_no_change_outcome(tmp_path: pathlib.Path) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "No change case",
                "--description",
                "Explicit no-change classification.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "no-change-case",
                "--baseline-id",
                "baseline-a",
                "--before-score",
                "1.0",
            ],
        )

        finished = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "no-change-case",
                "--status",
                "completed",
                "--after-score",
                "1.0",
            ],
        )

        run = finished["runs"][0]
        assert run["outcome"] == "no_change"
        assert run["absolute_delta"] == pytest.approx(0.0)
        assert run["relative_delta"] == pytest.approx(0.0)


def test_experiment_finish_handles_zero_baseline_without_relative_delta(
    tmp_path: pathlib.Path,
) -> None:
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "create",
                "--title",
                "Zero baseline",
                "--description",
                "Relative delta is undefined for non-zero changes from zero.",
            ],
        )
        _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "start",
                "zero-baseline",
                "--baseline-id",
                "baseline-zero",
                "--before-score",
                "0.0",
            ],
        )

        finished = _invoke_json_object(
            runner,
            [
                "autoresearch",
                "experiment",
                "finish",
                "zero-baseline",
                "--status",
                "completed",
                "--after-score",
                "0.2",
            ],
        )

        run = finished["runs"][0]
        assert run["outcome"] == "improved"
        assert run["absolute_delta"] == pytest.approx(0.2)
        assert run["relative_delta"] is None
