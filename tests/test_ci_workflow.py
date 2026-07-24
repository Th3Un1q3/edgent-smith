from __future__ import annotations

import os
import pathlib
import re
import subprocess

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def _write_executable(path: pathlib.Path, content: str) -> None:
    path.write_text(content)
    path.chmod(0o755)


def test_ci_script_preserves_check_order_and_failure_reporting(tmp_path: pathlib.Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    command_log = tmp_path / "commands.log"

    lint_output = "".join(f"lint line {line:02d}\n" for line in range(1, 26)) + "lint 50% done\n"
    lint_output += "TRUNCATE:" + ("B" * 5000) + ":END\n"
    workflow_output = "workflow security failed\r\nsecond line\n"

    _write_executable(
        fake_bin / "just",
        "".join(
            [
                "#!/usr/bin/env python3\n",
                "from __future__ import annotations\n",
                "import os\n",
                "import pathlib\n",
                "import sys\n",
                "log_path = pathlib.Path(os.environ['CI_TEST_LOG'])\n",
                "with log_path.open('a', encoding='utf-8') as handle:\n",
                "    handle.write('just ' + ' '.join(sys.argv[1:]) + '\\n')\n",
                "command = tuple(sys.argv[1:])\n",
                "if command == ('format-check',):\n",
                "    sys.stdout.write('format ok\\n')\n",
                "elif command == ('lint',):\n",
                "    sys.stdout.write(os.environ['CI_TEST_LINT_OUTPUT'])\n",
                "    raise SystemExit(1)\n",
                "elif command == ('typecheck',):\n",
                "    sys.stdout.write('typecheck ok\\n')\n",
                "elif command == ('test',):\n",
                "    sys.stdout.write('test ok\\n')\n",
                "elif command == ('.opencode/test', '--coverage'):\n",
                "    sys.stdout.write('opencode test ok\\n')\n",
                "elif command == ('.opencode/lint',):\n",
                "    sys.stdout.write('opencode lint ok\\n')\n",
                "elif command == ('.opencode/typecheck',):\n",
                "    sys.stdout.write('opencode typecheck ok\\n')\n",
                "elif command == ('.opencode/mutation',):\n",
                "    sys.stdout.write('mutations_text\\n')\n",
                "else:\n",
                "    sys.stderr.write(f'unexpected just invocation: {sys.argv[1:]}\\n')\n",
                "    raise SystemExit(99)\n",
            ]
        ),
    )
    _write_executable(
        fake_bin / "uv",
        "".join(
            [
                "#!/usr/bin/env python3\n",
                "from __future__ import annotations\n",
                "import os\n",
                "import pathlib\n",
                "import sys\n",
                "log_path = pathlib.Path(os.environ['CI_TEST_LOG'])\n",
                "with log_path.open('a', encoding='utf-8') as handle:\n",
                "    handle.write('uv ' + ' '.join(sys.argv[1:]) + '\\n')\n",
                "if tuple(sys.argv[1:]) != ('run', 'python', "
                "'scripts/validate_workflow_security.py'):\n",
                "    sys.stderr.write(f'unexpected uv invocation: {sys.argv[1:]}\\n')\n",
                "    raise SystemExit(99)\n",
                "sys.stdout.write(os.environ['CI_TEST_WORKFLOW_OUTPUT'])\n",
                "raise SystemExit(1)\n",
            ]
        ),
    )

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "ci.sh")],
        cwd=tmp_path,
        env={
            **os.environ,
            "PATH": f"{fake_bin}:{os.environ['PATH']}",
            "CI_TEST_LOG": str(command_log),
            "CI_TEST_LINT_OUTPUT": lint_output,
            "CI_TEST_WORKFLOW_OUTPUT": workflow_output,
        },
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert command_log.read_text().splitlines() == [
        "just format-check",
        "just lint",
        "just typecheck",
        "just test",
        "uv run python scripts/validate_workflow_security.py",
        "just .opencode/test --coverage",
        "just .opencode/lint",
        "just .opencode/typecheck",
        "just .opencode/mutation",
    ]

    output = result.stdout
    assert output.index("── format-check") < output.index("── lint")
    assert output.index("── lint") < output.index("── typecheck")
    assert output.index("── typecheck") < output.index("── test")
    assert output.index("── test") < output.index("── workflow-security")
    assert output.index("── workflow-security") < output.index("── opencode-test")
    assert output.index("── opencode-test") < output.index("── opencode-lint")
    assert output.index("── opencode-lint") < output.index("── opencode-typecheck")
    assert output.index("── opencode-typecheck") < output.index("── opencode-mutation")
    assert "format ok" in output
    assert "lint line 01" in output
    assert ":END" in output
    assert "typecheck ok" in output
    assert "test ok" in output
    assert "workflow security failed" in output
    assert "opencode test ok" in output
    assert "opencode lint ok" in output
    assert "opencode typecheck ok" in output
    assert "mutations_text" in output

    lint_annotation = next(
        line for line in output.splitlines() if line.startswith("::error title=lint failed::")
    )
    assert "lint failed%0A" in lint_annotation
    assert "lint line 08" in lint_annotation
    assert "lint line 07" not in lint_annotation
    assert "%25" in lint_annotation
    assert ":END" not in lint_annotation

    workflow_annotation = next(
        line
        for line in output.splitlines()
        if line.startswith("::error title=workflow-security failed::")
    )
    assert "workflow-security failed%0A" in workflow_annotation
    assert "%0D" in workflow_annotation


def test_ci_workflow_uses_script_backed_just_wrapper() -> None:
    justfile = (REPO_ROOT / "justfile").read_text()
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text()
    ci_job_match = re.search(r"(?ms)^  ci:\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:|\Z)", workflow)

    assert re.search(r"^ci:\n\s+@bash scripts/ci\.sh$", justfile, re.MULTILINE)
    assert ci_job_match is not None

    ci_job = ci_job_match.group(0)
    ensure_env = ci_job.index("- name: Ensure .env exists")
    devcontainer_step = ci_job.index("- uses: devcontainers/ci@v0.3")

    assert ensure_env < devcontainer_step
    assert "cp .env.example .env" in ci_job
    assert "runCmd: |\n            just ci" in ci_job
    assert "escape_workflow_command()" not in workflow
    assert "run_check format-check just format-check" not in workflow
