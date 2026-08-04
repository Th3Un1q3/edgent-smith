# Quality Gates Configuration

Quality gates are defined in the OpenCode plugin harness config, `.opencode/plugins/config/harness.config.ts`, under `plugins['quality-gate-enforcer']`. They auto-run checks when relevant files are modified during an editing session.

## Schema

```typescript
// Sourced from .opencode/plugins/types/quality-gate.ts
interface GateConfig {
  name: string;       // Unique gate identifier
  patterns: string[]; // Glob patterns for files to trigger the gate
  commands: string[]; // Shell commands to run (sequential, stop on first fail)
}

interface QualityGatesConfig {
  gates: GateConfig[];
  debounceMs?: number; // Debounce delay in milliseconds
}
```

## Gate Inventory

The concrete gate list lives in the harness config's `quality-gate-enforcer` section — read it there; do not duplicate it here. Expect three families: TypeScript gates for OpenCode plugin sources, Python gates split into ruff (lint) and mypy (typecheck) plus a test gate, and a justfile formatting gate.

## Related

- `mem:quality-gates/design-rules` — how to choose patterns and commands when adding a gate.
- `mem:quality-gates/runtime-behavior` — how gates fire, track status, and report failures.
