---
id: cases/opencode/quality_gate_hang_blocks_edits
type: cases
L0: "OpenCode checks quality gate with no timeout entered an infinite vitest loop; runGatePooled cached the dead promise by gate name, so later edits to .opencode/plugins were blocked in tool.execute.before"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-21
directory: cases/opencode
provenance: operator-verified live session 2026-09-21
---
# Quality-gate hang blocks edits

## Symptom
Every edit or write to .opencode/plugins/**/*.ts appeared to leave stale state: the file on disk never changed.

## Root cause
The opencode-checks quality gate runs typecheck plus lint plus the FULL test suite via runGate/runGatePooled with NO timeout. One vitest worker entered an infinite loop (100% CPU for ~53 min). Because runGatePooled caches the in-flight promise by gate name, every later edit awaited the same dead promise and was blocked in tool.execute.before.

## Fix
- Added a per-command hard timeout: GateConfig.timeoutMs, timeout -k 5s <secs>s bash -c wrapping plus a JS race fallback returning {exitCode:124,timedOut:true}.
- Set opencode-checks: timeoutMs 300_000.
- vitest config gained testTimeout/hookTimeout 120_000 and teardownTimeout 30_000.

## Lesson
An unbounded gate can block an entire edit path; always bound gate commands.

## Related gotcha
just lint hardcodes --fix --cache and REWRITES files; use non-mutating eslint plugins --no-cache for verification.

Source: live session 2026-09-21. See quality-gates/runtime-behavior, troubleshooting/opencode-plugin-live-diagnosis.