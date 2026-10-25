from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROBE = PROJECT_ROOT / "scripts/eval/probe_models.py"
VALIDATE = PROJECT_ROOT / "scripts/eval/validate_evals.py"

PROBE_OK_LINE = '{"type": "text", "part": {"text": "PROBE_OK"}}'


def run(script: Path, *args: str, cwd: Path | None = None) -> tuple[int, dict]:
    completed = subprocess.run(
        [sys.executable, str(script), *args],
        capture_output=True,
        text=True,
        check=False,
        cwd=cwd,
    )
    return completed.returncode, json.loads(completed.stdout)


def write_config(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "config.toml"
    path.write_text(body, encoding="utf-8")
    return path


def write_fake_opencode(tmp_path: Path, working: set[str]) -> Path:
    binary = tmp_path / "fake-opencode"
    binary.write_text(
        "#!/usr/bin/env python3\n"
        "import sys\n"
        f"WORKING = {sorted(working)!r}\n"
        "model = sys.argv[sys.argv.index('--model') + 1]\n"
        "if model in WORKING:\n"
        f"    print({PROBE_OK_LINE!r})\n"
        "else:\n"
        "    print('rate limited', file=sys.stderr)\n"
        "    raise SystemExit(1)\n",
        encoding="utf-8",
    )
    binary.chmod(0o755)
    return binary


def test_probe_selects_first_working_model(tmp_path):
    config = write_config(
        tmp_path,
        '[opencode]\nmodels = ["free/a", "paid/b", "local/c"]\n',
    )
    binary = write_fake_opencode(tmp_path, working={"paid/b"})

    code, payload = run(PROBE, "--config", str(config), "--opencode-bin", str(binary))

    assert code == 0
    assert payload["ok"] is True
    assert payload["model"] == "paid/b"
    assert [item["model"] for item in payload["probed"]] == ["free/a", "paid/b"]
    assert [item["ok"] for item in payload["probed"]] == [False, True]
    assert payload["probed"][0]["reason"]


def test_probe_falls_back_to_model_pair(tmp_path):
    config = write_config(
        tmp_path,
        '[opencode]\nmodel = "primary"\nfallback_model = "backup"\n',
    )
    binary = write_fake_opencode(tmp_path, working={"backup"})

    code, payload = run(PROBE, "--config", str(config), "--opencode-bin", str(binary))

    assert code == 0
    assert payload["model"] == "backup"
    assert [item["model"] for item in payload["probed"]] == ["primary", "backup"]


def test_probe_reports_failure_when_no_model_answers(tmp_path):
    config = write_config(tmp_path, '[opencode]\nmodels = ["free/a", "paid/b"]\n')
    binary = write_fake_opencode(tmp_path, working=set())

    code, payload = run(PROBE, "--config", str(config), "--opencode-bin", str(binary))

    assert code == 1
    assert payload["ok"] is False
    assert payload["model"] is None
    assert len(payload["probed"]) == 2


def valid_eval_set() -> dict:
    return {
        "skill_name": "demo",
        "evals": [
            {
                "id": case_id,
                "prompt": f"prompt {case_id}",
                "expected_output": f"output {case_id}",
                "assertions": [{"text": f"assertion {case_id}"}],
            }
            for case_id in range(1, 6)
        ],
    }


def write_eval_set(skill_dir: Path, payload: dict) -> Path:
    evals_dir = skill_dir / "evals"
    evals_dir.mkdir(parents=True)
    path = evals_dir / "evals.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_validate_accepts_complete_eval_set(tmp_path):
    path = write_eval_set(tmp_path / "demo", valid_eval_set())

    code, payload = run(VALIDATE, "--skill", str(tmp_path / "demo"))

    assert code == 0
    assert payload["ok"] is True
    assert payload["valid"] is True
    assert payload["eval_set"] == str(path)
    assert payload["count"] == 5
    assert payload["case_ids"] == [1, 2, 3, 4, 5]
    assert payload["errors"] == []


def test_validate_filters_by_case_spec(tmp_path):
    write_eval_set(tmp_path / "demo", valid_eval_set())

    code, payload = run(VALIDATE, "--skill", str(tmp_path / "demo"), "--cases", "1,3-5")

    assert code == 0
    assert payload["case_ids"] == [1, 3, 4, 5]
    assert payload["count"] == 4


def test_validate_resolves_bare_skill_name(tmp_path):
    write_eval_set(tmp_path / ".agents/skills/demo", valid_eval_set())

    code, payload = run(VALIDATE, "--skill", "demo", cwd=tmp_path)

    assert code == 0
    assert payload["eval_set"].endswith(".agents/skills/demo/evals/evals.json")


def test_validate_rejects_malformed_case(tmp_path):
    payload = valid_eval_set()
    del payload["evals"][1]["assertions"]

    write_eval_set(tmp_path / "demo", payload)

    code, result = run(VALIDATE, "--skill", str(tmp_path / "demo"))

    assert code == 1
    assert result["valid"] is False
    assert result["ok"] is False
    assert result["errors"]


def test_validate_rejects_missing_skill(tmp_path):
    code, payload = run(VALIDATE, "--skill", str(tmp_path / "absent"))

    assert code == 1
    assert payload["valid"] is False
    assert payload["count"] == 0
    assert payload["errors"]
