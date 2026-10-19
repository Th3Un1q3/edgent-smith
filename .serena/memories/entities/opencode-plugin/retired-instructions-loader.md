---
id: entities/opencode-plugin/retired-instructions-loader
type: entities
L0: "Retired v1 plugin instructions-loader: injected path-scoped .opencode/instructions/*.instructions.md as steering blocks on edit/write/read; migrated to a live v2 plugin."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/instructions-loader.ts; git index .opencode/plugins-quarantine/instructions-loader.ts
---

# instructions-loader (retired OpenCode v1 plugin)

## What it did in v1
Injected the project instructions relevant to a touched file into the session as a `<steering priority="high" ... type="instructions">` block.

## Key behaviours / signals
- `execute.before` tool hook on targeted tools `edit`, `write`, `read`; requires `sessionID` and `input.filePath`.
- Resolves the session agent via `context.session.get` (v2 flattened `result.agent`, with `result.data.agent` fallback; default `build`).
- Builds an index over glob `.opencode/instructions/*.instructions.md` (`createIndex`, type `custom`) and resolves instructions with `InstructionContextHelper.resolveInstructions([filePath])`.
- Idempotency tokens per session under `instruction_load:<path>` with `:full`/`:ref` suffixes; only `:full` consumes budget, 5 full-content slots then references (`<meta lines= chars=>`).
- Posts via `context.session.prompt({noReply:true, parts:[...steering...]})`; state persisted through `SessionStorage.updateState`.

## Dependencies / config
Helpers `./helpers/v2-define` (define), `./helpers/instruction-indexer`, `./helpers/kv-store` (SessionStorage, State), `./helpers/instruction-context-helper`. V2 exposes no logging sink, so V1 `log(client,...)` diagnostics are dropped via `noopLog`.

## Retirement
Superseded by the live v2 plugin `.opencode/plugins/instructions-loader.ts` (migrated to the v2 `define`/`context.tool.hook` API).

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/instructions-loader.ts`; recovered copy at `.tmp/retired-plugins/instructions-loader.ts`; test `.opencode/plugins-quarantine/tests/instructions-loader.test.ts`.

Source: recovered source `.tmp/retired-plugins/instructions-loader.ts`; live plugin listed in `.opencode/plugins/`.