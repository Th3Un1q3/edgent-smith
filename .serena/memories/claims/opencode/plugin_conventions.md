---
id: claims/opencode/plugin_conventions
type: claims
L0: "OpenCode plugin conventions: relative imports in source, named exports, tool() with schema defaults, mirrored tests, mutation scoped to .opencode"
hotness: 0.9
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.9
status: active
provenance: .opencode/plugins/AGENTS.md
---
claim: OpenCode plugin authoring conventions in this repo:
- source uses relative imports only (./helpers/...); @plugins/* and @tests/* aliases are test-only.
- named exports only; root *.ts files are plugin entry points, helpers/*.ts hold shared logic.
- tools are registered as tool({ description, args: tool.schema..., execute }) with .default(...) for optional args.
- tests mirror source shape under tests/ (*.test.ts, same folder nesting).
- quality gates: cd .opencode and just test / just lint / just typecheck; final check just mutation.
- mutation scope is .opencode/**/*.ts with thresholds.break 72.
evidence: .opencode/plugins/AGENTS.md:1-36, .opencode/plugins/workflow.ts:49-97, .opencode/stryker.config.mjs:20-37.