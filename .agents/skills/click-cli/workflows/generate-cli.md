# Workflow: Generate and Validate Click CLI

Step-by-step workflow to scaffold a reusable Click CLI, add tests, and validate behavior.

## Steps

1. Clarify scope and intent
   - Ask whether the CLI should be a single command or a `Group` with subcommands.
   - Identify required commands, options (flags vs arguments), and file I/O requirements.

2. Choose command and option shapes
   - For each command, list name, summary, parameters, and their types (str, int, Path, File).
   - Decide which options should `prompt` or be interactive vs required on the CLI.

3. Scaffold using the template
   - Copy `templates/cli_template.py` and rename to your package/module.
   - Adjust command names, docstrings, and option defaults.

4. Add a progress contract for operational commands
   - Keep final user-facing result on `stdout`.
   - Emit progress/status lines to `stderr` with `click.echo(..., err=True)`.
   - Use one stable schema, for example:
       - `[task=<name> phase=<phase> attempt=<n>/<total>] <message>`
    - Include `task`, `phase`, and attempt fraction for retry-capable operations.
   - Keep messages short and grep-friendly.
   - Use `click.secho()`/`click.style()` only for optional emphasis.
   - Avoid `click.progressbar()` for non-iterative phases.

5. Add tests
   - Use `click.testing.CliRunner()` to exercise the CLI.
   - Use `runner.isolated_filesystem()` for file-based commands.
   - Assert on `result.exit_code`.
   - Assert final results from `stdout` and progress lines from `stderr` separately.
   - Assert progress lifecycle ordering (`send`, retry if needed, then `success` or `failure`).
   - Avoid brittle full-string assertions; lock schema and key tokens.

6. Validate and iterate
   - Run tests locally. Check help text and exit codes.
   - Verify `--help` output for clarity and correctness.

7. Packaging and entry points
   - Add a `console_scripts` entry point in `pyproject.toml` or `setup.cfg`.
   - Ensure `main()` calls `cli()` to be import-safe.

## Examples

Minimal change to template to add a `hello` command:

```python
@cli.command()
@click.option('--name', default='world')
def hello(name):
    """Greet someone"""
    click.echo(f"Hello, {name}!")
```

## Clarification Triggers

Ask the user before proceeding if:
- They need shell completion generated.
- The CLI must support configuration files or environment overrides.
- There are backward-compatibility or deployment constraints (containers, PATH restrictions).
