---
id: harness-gates
kind: deterministic
command: bun .aidlc/tools/aidlc-sensor-harness-gates.ts
default_severity: advisory
description: Runs this repository's configured quality gates (lint, typecheck, tests, opencode checks, justfile formatting) for the changed file, with gate selection read from .opencode/plugins/config/harness.config.ts (quality-gates plugin, advisory)
matches: "**/*"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  gates_run: string[]
  findings:
    - gate: string
      command: string
      exit_code: integer
      output_tail: string
timeout_seconds: 1800
---

# harness-gates sensor (quality-gates)

ADVISORY. Takes the changed `file_path`, reads the repository's gate
definitions from `.opencode/plugins/config/harness.config.ts`, and runs every
gate whose `patterns` match that path: `opencode-checks` (typecheck, lint,
coverage test), `python-lint`, `python-typecheck`, `python-test`, and
`justfile-fmt`. A path that matches no gate's patterns runs nothing and passes.

`gates_run` lists the gates that executed; `findings` carries one entry per
failing command with the gate name, the exact command, its exit code, and the
tail of its output.

## Advisory note

The framework has no blocking sensor severity on this harness, so a
`SENSOR_FAILED` here is REPORTED, not enforced: ordinary edits are never
blocked by a gate result. The gates themselves already run in CI, where they
are hard.
