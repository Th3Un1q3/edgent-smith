---
id: reviews/plugin-opencode-surface-consolidation
type: experiences
L0: "Plugin consolidation: C1-C3 landed with call sites, C4 log helper open; two keep-separate rules, one historical."
provenance: ".opencode/plugins — helpers/runtime/, helpers/session/, plugin entrypoints"
freshness: 2026-11-23
---

# Plugin surfaces — consolidation review

## Candidate status

- **C1 landed** — `appendSynthetic` (`helpers/session/synthetic-append.ts`) returns whether the append landed and takes an explicit failure policy: `log` (tag), `report` (callback), `silent`. Four call sites: `quality-gate-enforcer.ts`, `tool-limit-reminder.ts`, `state-machine.ts`, `instructions-loader.ts`. The loader needs the boolean before writing its token map.
- **C2 landed** — `namespacedStore(storage, prefix, decode)` (`helpers/runtime/namespaced-store.ts`) owns the `<prefix><sessionID>` key, read, write, remove and `scanPage`. Three call sites: `gates/`, `idempotency/`, `review/` (the last paged with `scanPage`). Defaulting stays per-caller in `decode`.
- **C3 landed** — `createSessionReader(context).read(sessionID, mode)` (`helpers/session/session-read.ts`) owns the `session.get` call and the `agent`/`parentID` narrowing; mode is required, `cached` or `fresh`, and `fresh` calls through and stores. Three call sites: `state-machine.ts` (cached), `state-machine/session-events.ts` (fresh, twice), `instructions-loader.ts` (fresh). The required mode answers the per-agent invalidation risk: a memo could serve an agent the session has since changed.
- **C4 open** — no plugin log helper. Sites call tag-prefixed `Effect.log*` (effect-log, not client-log): `[state-machine]`, `[tool-limit-reminder]`, `TAG` in the loader, seeding and native-attempt modules, dotted tags in `workflow.ts`. `workflow/workflow-subtask-log.ts` buffers subtask lines into `context.logs`, not a plugin-wide sink.

## Keep separate

- Structured-output retry (`workflow/workflow-subtask-turn.ts`) is the only retrying emitter; sharing one would replay steering text.
- `state-machine/core/snapshot.ts` reports a v1 record as `legacy` so `machine-service.ts` logs the migration; the gate store's `decodeStatuses` silently returns `{}`. One codec cannot do both.
- History, not a live rule: the envelope store (delete-on-read, exactly-once) and the kv store (persistent read-modify-write) are deleted. Nothing under `helpers/runtime/` implements either, so that pair constrains nothing today.

Source: `.opencode/plugins` tree and import sites read 2026-11-23.
