import importlib.util
from pathlib import Path

from click.testing import CliRunner


def load_cli():
    # Load the template module by path to avoid import path issues in tests
    tests_dir = Path(__file__).resolve().parent
    skill_dir = tests_dir.parent
    template_path = skill_dir / "templates" / "cli_template.py"
    spec = importlib.util.spec_from_file_location("click_template", str(template_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore
    return module.cli


def test_hello_command():
    cli = load_cli()
    runner = CliRunner()
    result = runner.invoke(cli, ["hello", "--name", "Tester"])
    assert result.exit_code == 0
    assert "Hello, Tester!" in result.output


def test_repeat_command():
    cli = load_cli()
    runner = CliRunner()
    result = runner.invoke(cli, ["repeat", "--count", "3", "abc"])
    assert result.exit_code == 0
    # three lines of output
    assert result.output.strip().splitlines() == ["abc", "abc", "abc"]
