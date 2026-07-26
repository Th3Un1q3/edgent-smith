# Quality Gates Configuration

Quality gates are defined in `.opencode/quality-gates.json`. They auto-run checks when relevant files are modified during an editing session.

## Schema

```json
{
  "gates": [
    {
      "name": "string",         // Unique gate identifier
      "patterns": ["string"],   // Glob patterns for files to trigger the gate
      "commands": ["string"]    // Shell commands to run (sequential, stop on first fail)
    }
  ],
  "debounceMs": 300             // Debounce delay in milliseconds
}
```

## Existing Gates

### OpenCode Plugins (TypeScript)
| Gate | Patterns | Command |
|------|----------|---------|
| `opencode-typecheck` | `.opencode/plugins/**/*.ts` | `cd /workspace/.opencode && just typecheck` |
| `opencode-lint` | `.opencode/plugins/**/*.ts` | `cd /workspace/.opencode && just lint` |
| `opencode-test` | `.opencode/plugins/**/*.ts` | `cd /workspace/.opencode && just test --coverage ...` |

### Python Directories
| Gate | Patterns | Command | Triggers On |
|------|----------|---------|-------------|
| `python-lint` | `cli/**/*.py`, `agents/**/*.py`, `evals/**/*.py`, `scripts/**/*.py` | `cd /workspace && just lint` | Python source changes (ruff) — excludes tests |
| `python-typecheck` | `cli/**/*.py`, `agents/**/*.py`, `evals/**/*.py` | `cd /workspace && just typecheck` | Core Python module changes (mypy) — excludes scripts and tests |
| `python-test` | `cli/**/*.py`, `agents/**/*.py`, `evals/**/*.py`, `scripts/**/*.py`, `tests/**/*.py` | `cd /workspace && just test` | Any Python source or test change |

### Justfiles
| Gate | Patterns | Command |
|------|----------|---------|
| `justfile-fmt` | `justfile`, `**/justfile` | `find ... -name justfile ... -exec just --unstable --fmt --check` |

## Design Rules

1. **Narrow triggers**: Patterns should be specific to relevant directories/files only. Avoid broad patterns that catch unrelated files.
2. **Appropriate checks per target**: Lint fast-changing files (ruff), typecheck core modules (mypy), run tests only when source or tests change.
3. **Don't run irrelevant checks**: Scripts don't need typechecking. Test-only changes don't need linting. Justfile changes don't need Python checks.
4. **Sequential execution**: Commands in a gate run sequentially and stop on first failure (early exit).
5. **debounceMs**: Set to 300ms to avoid rapid re-triggering on multi-file saves.

## Runtime Behavior

- Triggered by `tool.execute.after` hook in `quality-gate-enforcer.ts`
- Matches changed files against gate patterns using Bun's `Glob`
- Runs matched gates sequentially via `runGate()`
- Tracks results in per-session KV store (`sessions/ses_<id>.json`)
- Sends `<steering priority="warning">` messages on status transitions (pass→fail or unknown→fail)
- Subagent tasks report child session gate failures via `task-gate-reporter.ts`