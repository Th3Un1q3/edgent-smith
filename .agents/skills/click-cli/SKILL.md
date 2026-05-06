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

## When Not to Use This Skill

Do not use this skill for:
- Designing non-CLI application architecture.
- Debugging unrelated runtime issues or infrastructure setup.

## Task Routing Table

| I want to... | File |
|---|---|
| Generate a Click CLI scaffold | [workflows/generate-cli.md](./workflows/generate-cli.md) |
| Look up common options and types | [references/options.md](./references/options.md) |
| See an example template to copy | [templates/cli_template.py](./templates/cli_template.py) |
| Example tests for the scaffold | [tests/test_template.py](./tests/test_template.py) |

## Related Skills

- `building-modular-skills`
- `agent-customization`
