# Quality Gates Configuration

Quality gates are defined in a JSON config file in the OpenCode workspace. They auto-run checks when relevant files are modified during an editing session.

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
| Gate | Triggers On | Command |
|------|-------------|---------|
| `opencode-typecheck` | OpenCode plugin sources (TypeScript) | `just typecheck` |
| `opencode-lint` | OpenCode plugin sources (TypeScript) | `just lint` |
| `opencode-test` | OpenCode plugin sources (TypeScript) | `just test --coverage` |

### Python Source and Tests
| Gate | Triggers On | Command |
|------|-------------|---------|
| `python-lint` | CLI command modules, agent runtimes, eval infrastructure, scripts (ruff) — excludes tests | `just lint` |
| `python-typecheck` | Core Python modules: CLI command modules, agent runtimes, eval infrastructure (mypy) — excludes scripts and tests | `just typecheck` |
| `python-test` | Any Python source or test change (CLI, agents, evals, scripts, tests) | `just test` |

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

- Triggered by the `tool.execute.after` hook in the quality-gate enforcer plugin
- Matches changed files against gate patterns using Bun's `Glob`
- Runs matched gates sequentially
- Tracks results in a per-session KV store (keyed by session id)
- Sends `<steering priority="warning">` messages on status transitions (pass→fail or unknown→fail)
- Subagent tasks report child-session gate failures via the gate reporter plugin