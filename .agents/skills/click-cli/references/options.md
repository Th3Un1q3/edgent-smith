# Reference: Common Click Options and Types

Quick reference for common `click` constructs, options, and types.

## Decorators

- `@click.command()` — turn a function into a CLI command.
- `@click.group()` — container for subcommands.
- `@click.option()` — define an option/flag (use `is_flag=True` for booleans).
- `@click.argument()` — positional argument.
- `@click.pass_context` / `@click.pass_obj` — pass the `ctx` or `ctx.obj` to the function.

## Option Attributes

- `default` — default value.
- `required` — force the option to be provided.
- `is_flag` — boolean flag.
- `multiple` — accept multiple values (returns a tuple).
- `type` — `click.INT`, `click.FLOAT`, `click.File`, `click.Path`, `click.Choice`, or custom `ParamType`.
- `help` — help text for `--help` output.
- `prompt` — interactively ask for a value if not provided.
- `callback` — transform/validate input.

## Common Types

- `str` (default) — plain string
- `int` / `click.INT` — integer parsing
- `float` / `click.FLOAT` — float parsing
- `click.Path()` — path validation (exists, file_okay, dir_okay)
- `click.File('r'|'w')` — file object opened with mode
- `click.Choice([...])` — enumerated values

## Utilities

- `click.echo()` / `click.secho()` — printing with color support.
- `click.prompt()` — prompt for input.
- `click.confirm()` — yes/no confirmation.
- `click.progressbar()` — simple progress UI for iterables.
- `click.get_current_context()` — retrieve current `Context` object.

## Testing

- Use `click.testing.CliRunner` for isolated CLI tests.
- `runner.invoke(cli, args, input=...)` returns a `Result` with `exit_code`, `output`, `exception`.
- Use `runner.isolated_filesystem()` to test file operations.

## Best Practices (short)

- Prefer `Group` for multi-command tools and keep functions small.
- Use `ctx.obj` for shared configuration/state.
- Write clear `--help` strings and examples in docstrings.
- Return appropriate exit codes (raise `click.ClickException` or `sys.exit()` when needed).
- Avoid heavy side-effects during import — keep `main()` entrypoint thin.
