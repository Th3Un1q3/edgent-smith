---
name: click-cli-skill
description: >
  Create, review, and test Click-based command-line interfaces using templates and
  best practices. Produces scaffolding, test harnesses, and guidance for reusable CLIs.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
---

# Click CLI Skill

This skill helps generate, review, and test Click-based command-line interfaces.

## When to Use This Skill

Invoke this skill when:
- You want a scaffold for a new CLI built with `click`.
- You need a modular pattern for `click` groups and subcommands.
- You want example tests using `click.testing.CliRunner` and filesystem isolation.
- You need best-practices, anti-patterns, or migration guidance for `click` versions.

## Testing Reminders

- Normalize Click help whitespace in assertions so tests stay stable across wrapping and formatting differences.
- When help output changes, assert the help output directly instead of relying only on broad suite execution.
- Treat positional argument shape as part of the public CLI contract and cover it explicitly in tests when commands add, remove, or reorder positional arguments.
- For command workflows with phase updates, assert `stdout` and `stderr` separately and keep final result checks independent from progress checks.
- Prefer schema/token assertions for progress lines over brittle full-string matches.

## Progress Output Contract

Use a stable output contract so humans can read it and tests/tools can parse it.

- Final command result belongs on `stdout`.
- Progress and status updates belong on `stderr`.
- Use one consistent, grep-friendly line schema for progress.
- Include `task`, `phase`, and `attempt` for retrying operations.
- Keep verbs action-oriented (`send`, `retry`, `success`, `failure`).
- Avoid `click.progressbar()` for non-iterative phase reporting.

Recommended progress schema:

`[task=<name> phase=<phase> attempt=<n>/<total>] <message>`

## When Not to Use This Skill

Do not use this skill for:
- Designing non-CLI application architecture.
- Debugging unrelated runtime issues or infrastructure setup.

## Task Routing Table

| I want to... | File |
|---|---|
| Generate a Click CLI scaffold | [workflows/generate-cli.md](./workflows/generate-cli.md) |
| Look up common options and types | [references/options.md](./references/options.md) |
| Add consistent progress output and tests | [references/progress-output.md](./references/progress-output.md) |
| See an example template to copy | [templates/cli_template.py](./templates/cli_template.py) |
| Example tests for the scaffold | [tests/test_template.py](./tests/test_template.py) |

## Related Skills

- `building-modular-skills`
- `agent-customization`
