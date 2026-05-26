# Reference: Progress Output for Click CLIs

Use this contract for command progress so users and tests can rely on stable behavior.

## Core Rules

- Print final command results to `stdout`.
- Print progress/status lines to `stderr`.
- Keep one stable line schema for progress events.
- Include `task`, `phase`, and `attempt` when retries are possible.
- Use short, action-oriented, grep-friendly text.
- Treat color as optional emphasis only, never as semantic meaning.

## Recommended Schema

`[task=<name> phase=<phase> attempt=<n>/<total>] <message>`

Examples:

- `[task=submit phase=dispatch attempt=1/3] send dispatch_request`
- `[task=submit phase=dispatch attempt=2/3] retry rate_limited`
- `[task=submit phase=dispatch attempt=3/3] success request_accepted`

## Click API Guidance

- Use `click.echo("...", err=True)` for progress/status lines.
- Use `click.echo("...")` for final command results.
- Use `click.secho()` or `click.style()` only for emphasis; output must stay understandable with color disabled.

## When to Use click.progressbar()

Use `click.progressbar()` when work is iterative and measurable (known items/steps).

Good fit:

- Processing a list of files.
- Uploading N artifacts.
- Iterating over records.

Poor fit:

- High-level phases like `plan`, `submit`, `validate`.
- Retry lifecycle updates.
- Single remote calls without measurable incremental work.

## Testing Guidance

- Assert `stdout` and `stderr` separately.
- Assert progress lifecycle order (for example: `send -> retry -> success` or `send -> failure`).
- Avoid exact full-line assertions unless required; lock schema and key tokens (`task`, `phase`, `attempt`).
- Keep one focused test for parseability of progress lines and separate tests for user-facing result text.
