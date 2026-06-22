<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.1 | Updated: 2026-06-22 -->

# Technical Domain

**Purpose**: Core technology stack, command execution patterns, and development standards for this CLI-driven system.
**Last Updated**: 2026-06-22

## Quick Reference
**Update Triggers**: New tech stacks | changes in testing/runner strategy | updated security requirements
**Audience**: Developers, AI Agents (OpenCoder)

## Primary Stack
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | Python | 3.13 | Core logic and agentic workflows |
| Frameworks | pydantic-ai, pytest, mypy, pydantic-eval | Latest | Agent orchestration & testing |
| Command Runner | just (primary), rtk (optimized) | N/A | Orchestration via task runners; token optimization for CLI tools |
| CI/CD | GitHub Actions | N/A | Automation and validation |

## Code Patterns

### Leverage Command Runner

In case you have a CLI command with parameters that supposed to be called more than once, consider adding the command to the `justfile` and use it as a single source of truth for that command. This way you can reduce the amount of thinking required to run that command and make it more repeatable.

If you need to run tests/linter/server/formatter there is a high chance that there is already a command for that in the justfile, so make sure to check it before running the command directly in the terminal.

Follow the [instructions](../../../github/instructions/justfile.instructions.md) to learn how to use the justfile effectively.

### CLI Execution Pattern

For one time commands, use the `rtk` utility to run the command with optimized token usage. This is expecially important working with any Bash commands, as they can be very token intensive.


## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | user-profile.py |
| Directories (Collections) | kebab-case, plural | agents/, tests/ |
| Directories (Maps/Config) | singular | mcp/, devcontainers/ |
| Functions (Python) | snake_case | get_user_data() |
| Database Tables | snake_case, plural | user_profiles |

## Code Standards

- **Testing Strategy**: TDD approach using "Zombie Principles" (robust/resilient tests).
- **Edit Granularity**: Prefer many small edits over single large changes.
- **Parameter Passing**: Use named arguments instead of ordered ones.
- **Code Philosophy**: Adhere to YAGNI (You Ain't Gonna Need It) and DRY (Don't Repeat Yourself).

## Security Requirements
- All secrets must be strictly excluded via .gitignore and .dockerignore.


