---
id: ADR-011
title: Native session-scoped instruction entries for instruction injection
status: accepted
date: 2026-10-20
scope: OpenCode RUG harness — instruction injection carrier for .opencode/plugins
---

# ADR-011: Native session-scoped instruction entries for instruction injection

## Decision

Instruction injection uses the native opencode v2 session-scoped instruction entry API: the plugin that decides guidance is relevant writes one keyed JSON value per session with `client.session.instructions.entry.put({ sessionID, key, value })` (HTTP `PUT /api/experimental/session/:sessionID/instructions/entries/:key`), and the runtime renders it as a `<context key="...">` block at the end of the instruction sequence, with change and removal narration on later turns. Synthetic user-message injection is retired as an instruction carrier: instruction text is never sent through `context.session.prompt(...)` and never enters the transcript as a user turn.

The decision's reach is narrowed by type-level validation (2026-10-20): a plugin cannot reach this API through its inputs. The plugin `Context` has exactly one argument, `context`, whose only domains are `session: SessionDomain` and `rpc: RpcDomain`; `SessionDomain` is a `Pick` of `SessionApi` that omits `instructions` (with `skill`, `shell`, `diff`, `inbox`, and `revert`), even though `@opencode/client` has the method, and the context carries no client and no server URL. `context.rpc` reaches only RPC definitions registered with the host, the sole registration in this build being `experimental.browser`; instruction entries are plain HTTP endpoints with no `rpcID`, so no RPC definition can carry them. Plugin-side injection therefore requires a transport the plugin constructs itself (`@opencode/client` built from a base URL and credentials it resolves from its own environment) or one the host supplies; where neither is available, the carrier falls back to the ADR-010 `context`-hook system injection.

## Considerations

### Context

**Current carrier.** `.opencode/plugins/instructions-loader.ts` gates on `TARGETED_TOOLS = new Set(['edit','write','read'])` applied after `readFilePath(event.input)`, selects from `createIndex({ agent, instructionsGlob: '.opencode/instructions/*.instructions.md', currentWorkingDirectory: context.location.directory, type: 'custom' })` (18 files currently match), renders `buildSteeringMessage(blocks)` into a `<steering priority="high" reason="relevant files touched" type="instructions">…</steering>` block, and emits it in two steps: `context.session.prompt({ sessionID, text: message, resume: false })` (L114) plus `context.storage.set(pendingKey(...), message)` (L115); a later `context.session.hook('context', …)` (L124-129) pushes `{ type: 'text', text: pending }` onto `event.system` and removes the stash. Deduplication uses `instruction_load:<path>` keys with `:full`/`:ref` suffixes under `idempotency/<sessionID>` (L93-121, mirrored in `.opencode/plugins/helpers/instruction-context-helper.ts:62`).

**Second carrier: the workflow helper's `<task_skills>` prepend.** `.opencode/plugins/helpers/workflow-subtask.ts` (L116-157) also synthesizes user-role text. Plugin-spawned sessions do not fire the built-in task hooks (`tool.definition`, `tool.execute.before`), so the helper validates the skill name, reads `.agents/skills/<name>/SKILL.md`, and prepends a `<task_skills> ... </task_skills>` block to the prompt text part. The text carries no key, no dedupe, and no removal path, so the migration has two call sites, not one: the loader's steering blocks and this prepend.

**What the user-role carrier costs.**

- **Provenance is lost.** A user turn is `{ type: 'user', text }`. No field names the injector, so neither the model nor any consumer can distinguish harness guidance from human input in the transcript, in logs, or in an exported session.
- **Transcript pollution and duplication.** The same rendered block is both handed to `session.prompt` and stashed for `event.system`, so delivery depends on hook ordering and the text can appear twice — once as a durable user turn, once as system text. Every replay and export carries the extra turn.
- **Role attribution is wrong.** Instruction text arrives framed as a user request. Models are trained to treat user turns as the task to satisfy, so guidance competes with the real prompt and can be answered, restated, or "agreed with" instead of being applied as context.
- **Resumption re-publishes.** A resumed session replays the injected turn as if the human had said it; unless the plugin's idempotency keys suppress the write, re-entry publishes the same text again, appending rather than superseding.
- **Compaction erodes it.** Compaction rewrites the transcript; an instruction turn can be summarized away or preserved as a user claim with altered wording. There is no state model that re-derives the current instruction set after compaction.
- **No update or removal lifecycle.** The only operation is append. Nothing can say "this guidance changed" or "this guidance no longer applies", so stale guidance persists for the life of the session.
- **Untrusted-input consumers misclassify it.** Guardrails, approval prompts, and filters that treat user turns as untrusted input see harness text as user content; tests and UI that count user messages see turns no human wrote.
- **A second, inconsistent synthetic path exists.** `SessionInstructions.load` injects newly discovered nested instruction files as `SessionEvent.Synthetic` messages directly on the bus, because a Location-scoped layer cannot call `Session.synthetic` (type cycle). The harness therefore has two synthetic carriers with different shapes and dedupe rules.

**Available native mechanism.** The runtime exposes session-scoped instruction entries. Rows are key → JSON per session, and on load each becomes an `Instructions.make<Schema.Json>` source keyed `api/<key>` whose `read` returns the stored value.

- **HTTP surface** (all behind `sessionLocationMiddleware`, handlers delegate straight to `InstructionEntry.Service`): `GET /api/experimental/session/:sessionID/instructions/entries` → `InstructionEntry.Info[]`; `PUT /api/experimental/session/:sessionID/instructions/entries/:key` with body `Schema.Struct({ value: Schema.Json })`, success `NoContent`, errors `SessionNotFoundError` and `InstructionEntry.ValueTooLargeError`; `DELETE /api/experimental/session/:sessionID/instructions/entries/:key`, success `NoContent`, error `SessionNotFoundError`. OpenAPI identifiers: `experimental.session.instructions.entry.list|put|remove`. There is no get-by-key route: `GET …/entries/:key` returns `404 Not Found` even for an existing entry, so read-back is list-and-filter (validated 2026-10-20). Every request requires HTTP Basic auth — username `opencode`, password the server password — and unauthenticated writes return `401 Unauthorized`. Directory-scoped routes additionally require the `x-opencode-directory` header.
- **Client surface:** `client.session.instructions.entry.put/remove/list`, e.g. `await client.session.instructions.entry.put({ sessionID: "ses_…", key: "review-notes", value: { text: "Check the diff", priority: 1 } })`. The typed promise client from `@opencode/client` exposes `entry.put` at runtime, but only when constructed with an explicit `baseUrl` and given credentials out of band; the plugin context supplies neither (validated 2026-10-20).
- **Key and value limits:** keys match `^[a-z0-9][a-z0-9._-]*$` (slash-free) and are namespaced by the server as `api/<key>`; values are any JSON up to `MaxValueBytes = 256 KiB` measured as `Buffer.byteLength(JSON.stringify(value), "utf8")`, overflow producing `ValueTooLargeError` / HTTP 413.
- **Write semantics:** `put` upserts on `(session_id, key)` with `removed: false` and `setWhere: removed = true OR changed`; `value === null` is a distinct change case. The write touches only the table row: the diff is observed at the next request boundary and announced as a chronological system message, and it does not interrupt a running step.
- **Rendering:** initial state renders `<context key="<key>">` + `renderValue(value)` + `</context>`, where `renderValue` returns a string verbatim and otherwise `JSON.stringify(value, null, 2)`. Changes render as `The context under "<key>" changed and supersedes the previous value:` followed by the block; removals render as `The context under "<key>" no longer applies. Disregard it.` Only chronological updates and removals carry narration; rendering is mechanism-neutral, so the model sees session context, not how it was attached.
- **Ordering:** `SessionContext.select` (`context.ts` L132-158) combines sources most→least shared so the baseline stays a reusable prompt-cache prefix: Code Mode instructions, MCP, references, skills, discovery, builtins, entries. Documented order (docs `instructions.mdx` L63-76): agent/provider system prompt, Code Mode tool guidance, MCP/reference/skill guidance, global and project `AGENTS.md` then configured instructions, built-in date/environment, then session-specific entries. Sources are combined, not overridden.
- **Lifecycle:** `select` → `SessionHistory.entriesForRunner(db, sessionID, instructions, boundary)` → `InstructionState.initial` → `Instructions.renderInitial`. Deltas are `session.instructions.updated { delta, text? }` mapping each changed source key to a SHA-256 content hash, or the literal `"removed"` for observed absence; bodies are stored once in `instruction_blob` and the projected `instruction_state` row supplies current plus epoch-initial values. There is no instruction registry. The initial delta is complete and carries no update text; a later change renders once at admission and freezes optional `text` in the durable event. An epoch spans completed compactions (`session.compaction.ended` moves the epoch start to its exact sequence and makes current values initial without reading sources or authoring an event). Session move retains state; committed revert retains it unless it removed an instruction update, in which case state clears; a fork copies messages only through its boundary but adopts the parent's newest instruction values as baseline. Model selection is not an instruction source.
- **Plugin surface constraint (validated at type level, 2026-10-20).** The plugin `Context` has exactly one argument, `context`, with `session: SessionDomain` and `rpc: RpcDomain` and nothing else — no client, no server URL; `context.app` is only `{ name, version, channel }`. `SessionDomain` is a `Pick` of `SessionApi` that omits `instructions`, together with `skill`, `shell`, `diff`, `inbox`, and `revert`, even though `@opencode/client` exposes the method, so the domain offers neither a typed nor a runtime path to an entry. `context.rpc` is not a general route caller: it invokes only RPC definitions registered with the host, as `context.rpc(definition).method(...)`, and the only registration in this build is `experimental.browser`. Instruction entries are plain HTTP endpoints with no `rpcID`, so no registered definition can reach them. Consequence: a plugin cannot obtain a client from its inputs, and plugin-side injection is possible only through a transport the plugin constructs itself. A runtime introspection probe of the live plugin context on 2026-10-20 showed `context.session` is a constructed object whose own keys are exactly `hook`, `create`, `get`, `remove`, `switchAgent`, `switchModel`, `prompt`, `generate`, `command`, `compact`, `update`, `move`, `synthetic`, `interrupt`, `wait`, and `context`, with no `instructions` property found by `in`, own-property, or prototype walk, and `context.rpc` exposing only `register` plus the inherited `call` used for plugin RPC definitions, so the omission is a real runtime omission and not merely a type-level narrowing.
- **Constructed transport (observed mechanism, not a recommendation).** Because neither the context nor the RPC domain yields a client, the only working way for plugin code to use the entry API is to construct `@opencode/client` itself with a base URL and credentials resolved from its own environment. The effect plugin context exposes no client, and the injected `PluginInput` client described in other plugin APIs is not available to effect plugins in this build (runtime-probed 2026-10-20). The primary source is the live registration file `${XDG_STATE_HOME:-~/.local/state}/opencode/service.json` — channel variants `service-<channel>.json` — containing `{ id, version, url, pid, password }` and rewritten on every start; the CLI itself resolves the service this way and validates it with `GET {url}/api/info` using Basic auth with username `opencode`. The config file `~/.config/opencode/service.json` is only a password seed, not a service location. Socket-inode matching against `/proc/net/tcp` remains a last-resort fallback only. This is the mechanism the end-to-end validation used. It depends on host state and process layout rather than on any plugin API contract, so it is recorded as an observed workaround, not as the chosen design.
- **Hook surface and ordering constraint (validated 2026-10-20).** The `context` hook is the only hook that sees the request tool map; the `prompt` hook is where an entry is written and honoured in the same turn. A gate that depends on the tool map — such as `TARGETED_TOOLS` — can therefore be evaluated only in the `context` hook, while a write issued from that hook has no verified same-turn effect (open question 6). A gated injection spanning both hooks is boundary-deferred: the gate observes turn N and the entry applies from the next request boundary. Same-turn gated injection holds only when the gate's input is already available in the `prompt` hook.
- **Size limit.** The runtime rejects oversized entry values with `InstructionEntry.ValueTooLargeError` / HTTP 413. The recorded limit is `MaxValueBytes = 256 KiB`, measured as `Buffer.byteLength(JSON.stringify(value), "utf8")` (see Key and value limits above); that is the only byte figure verified in this record. Large instruction blocks must be size-checked before sending and split across keys when they exceed it, rather than truncated silently.

**Constraints.** Installed runtime `opencode --version` = v2.0.32; `.opencode/package.json` pins `@opencode/plugin ^2.0.24` (resolved 2.0.24, Effect surface `./effect`) and `[at]opencode-ai/sdk ^1.18.34` (resolved 1.18.34). All five repo plugins import the Effect surface. The plugin surface is itself a constraint, not a bug to route around: `SessionDomain` omits `instructions` and `RpcDomain` carries only host-registered definitions, so any plugin-side entry write depends on a transport built outside the plugin inputs. The entry endpoints sit under `/api/experimental/`, whose contract may change; generated clients track `openapi.json` via codegen. Removal of the carrier must not change what guidance is selected (`.opencode/instructions/*.instructions.md`, 18 files) or when (`TARGETED_TOOLS` gate).

### Options considered

#### Option A: Keep the synthetic user-turn carrier (status quo)

Pros:
- Shipped and working; no dependency on experimental API surface.
- Can deliver arbitrary text at any moment from any plugin, with the existing `@steering` block shape.

Cons:
- Every cost listed above: loss of provenance, transcript pollution, user-role attribution, resumption re-publish, compaction erosion, no update/remove narration, misclassification by untrusted-input consumers.
- Two-phase prompt-plus-stash delivery makes double delivery ordering-dependent, and dedupe lives in plugin-managed `idempotency/<sessionID>` keys.

#### Option B: Native session-scoped instruction entries (chosen)

Pros:
- One keyed upsert per piece of guidance; the server owns dedupe, change detection, ordering, and transcript placement.
- Guidance renders as session context with `<context key>` provenance instead of a user turn, and changes and removals are narrated rather than appended.
- State survives move and fork, is re-derived after compaction via the epoch model, and is subject to the same 256 KiB guard.
- Entries load last, so the shared baseline remains a stable prompt-cache prefix.

Cons:
- Depends on `/api/experimental/` endpoints that may change, and on an HTTP call from a plugin that has no host-level instruction-entry method.
- Boundary-deferred: a write is observed at the next request boundary and cannot be read back synchronously.
- Pinned SDK surface for `session.instructions.entry.*` is unverified (see Open questions); values are capped at 256 KiB and keys must be slash-free lowercase.
- Not self-service through its inputs: the context exposes no client, no base URL, and no credentials, so the carrier is usable only with host-supplied transport or a plugin-constructed one (validated 2026-10-20).

#### Option C: Static ambient configuration (`AGENTS.md` and the `instructions` array)

Pros:
- Zero code: repo-versioned files, watcher-driven reload without restart, stable and cache-friendly prefix.
- Supports paths, globs, `~`, and HTTP(S) URLs with a 5 s timeout and last-good retention.

Cons:
- Project-wide, not per-session or conditional: cannot express "this guidance applies once the agent touches these files".
- Configuration loads before built-ins and entries, so a per-session payload has no ordering slot.
- No keyed lifecycle or removal narration; `SessionInstructions.load` still injects later-found nested files as synthetic messages, reintroducing the carrier this ADR retires.

#### Option D: Add a new core `Instructions` source

Pros:
- First-class ordering and render hooks via `Instructions.make({ key, codec, read, render: { initial, changed, removed } })` with a chosen `combine` position.
- No HTTP hop; in-process read of whatever the plugin already computed.

Cons:
- Requires a runtime code change and ships on the runtime's release cadence; array position is a compile-time decision.
- Not reachable from an external plugin, so the harness cannot adopt it unilaterally.
- Duplicates what `InstructionEntry` already provides for session-scoped values, and every harness upgrade reviews the patch against a moving core.

#### Option E: Append to `event.system` in a plugin `context` hook

Pros:
- Proven in this repository for ADR-010's workflow block, with measured bytes and a verified injection event.
- No HTTP endpoint and no experimental surface; one module owns gate and payload.

Cons:
- No key lifecycle: dedupe is a sentinel strip, and removal means rewriting `event.system` rather than announcing that a value no longer applies.
- The payload is re-derived every request from plugin-owned text, so nothing records the value that produced a given block.
- Ordering is whatever the hook appends, not the documented instruction ordering.

### Scoring

Criteria (each scored -2 to +2):
- Maintainability
- Flexibility
- Implementation ease
- Initial implementation cost (higher = cheaper)

| Criteria | Opt A | Opt B | Opt C | Opt D | Opt E |
|---|---|---|---|---|---|
| Maintainability | -1 | 2 | 1 | 2 | 1 |
| Flexibility | 0 | 2 | -2 | 1 | 0 |
| Implementation ease | 2 | 0 | 2 | -2 | 1 |
| Initial implementation cost | 2 | 0 | 1 | -2 | 1 |
| Total | 3 | 4 | 2 | -1 | 3 |

Option B wins on total. Option A scores acceptably only because it is already paid for; its maintainability and flexibility deficits are the costs this ADR removes. Option C loses on flexibility: it cannot be session- or condition-scoped, which is the requirement. Option D loses on cost and reachability: it is a core change no external plugin can make. Option E restates the ADR-010 carrier: it needs no new endpoint and scores above Option A, but it fails the key lifecycle and the ordering requirement, and its sentinel dedupe is a workaround for the absent stored value.

### Consequences

**Positive.** Instruction guidance becomes session context with explicit provenance (`api/<key>`, rendered as `<context key>`), attributable and separable from human input in transcripts, logs, and exports. The user turn disappears, so replay and compaction no longer treat harness text as a user claim. Updates and removals are narrated once, chronologically, instead of accumulating. Server-side upsert on `(session_id, key)` replaces plugin-managed `instruction_load:*` idempotency keys. Entry state survives move, fork, and compaction, and entries render last so the shared instruction prefix stays stable for prompt caching.

**Negative.** The carrier now depends on an experimental HTTP surface, on a network hop from the plugin process, and on a transport and credentials the plugin cannot obtain from its inputs: without host-supplied transport or the constructed transport described above, every write fails with `401 Unauthorized` (validated 2026-10-20). A write applies from the next request boundary, not the current one — the same latency class as today's pending-stash design, but now explicit. Guidance exists as database rows, not repo files: the source of truth stays `.opencode/instructions/*.instructions.md` and entries are a derived cache that must never be hand-edited. Object values render as pretty-printed JSON, so verbatim prose requires a string value or a `text` field the model reads through the JSON wrapper. Each entry is capped at 256 KiB, and `put` gives no read-back — there is no get-by-key route, only list-and-filter — so oversize or missing-session failures surface on the next interaction rather than at the call site. Keys form one flat namespace under `api/<key>` and `put` carries no owner check, so two call sites that pick the same key silently overwrite each other. Entries also render last, so guidance written as an entry cannot precede or override agent, MCP, skill, or `AGENTS.md` guidance. Entry text never enters the message list — it renders as system context and as instruction-update system messages — so a consumer that reads user turns as operator input stops seeing guidance instead of seeing it misclassified.

**Risks and mitigations.**

| Risk | Mitigation |
|---|---|
| `/api/experimental/` contract changes or endpoints move | Confine all calls to one helper module; regenerate from `openapi.json`; feature flag selects the carrier; smoke test asserts PUT then a list GET contains the key, and that test must run live: mocked-client unit tests passed while the live runtime rejected shapes (`mem:cases/opencode-plugin-v2-tool-and-session-adaptation`, M12). |
| Plugin host exposes no instruction-entry method or client | Call HTTP directly behind the helper; keep the transport isolated so a future host method is a one-file swap; resolve transport in one place (host-supplied, or the observed self-resolution described under Constructed transport) and log one warning per session when neither is available. |
| Missing or wrong credentials (`401 Unauthorized`) | Resolve base URL and password only through the transport helper — host-provided variables, or the observed registration-file (`service.json`) resolution — never hardcode them; treat 401 as "carrier unavailable" and fall back per `INSTRUCTION_INJECTION`. |
| Pinned `[at]opencode-ai/sdk 1.18.34` may not generate `session.instructions.entry.*` | Check generated types first; otherwise issue the documented paths directly; record the outcome as the answer to open question 1. |
| Value exceeds 256 KiB (413 / `ValueTooLargeError`) | Measure `Buffer.byteLength(JSON.stringify(value), "utf8")` before sending; one key per instruction file keeps payloads small; fail loud and skip that entry rather than truncating silently. |
| Stale entries after a source file is deleted or its gate no longer matches | At session start list entries with `instr-` prefix, compare against the current glob result, and DELETE keys with no source. |
| A `put` of an unchanged value is a silent no-op | Expect no update notice: key per payload purpose, and assert on `GET .../entries` rather than on a message appearing. |
| Double delivery during rollout | One carrier per session, chosen by flag; never write an entry and call `session.prompt` for the same block. |
| Guidance applied a turn late | Accept: the gate already defers through a pending stash; document that a touch in turn N informs turn N+1. |
| Fork or move re-publishes guidance | Upsert is idempotent per key; forks adopt the parent's newest values as baseline, so re-writing identical values produces no change event. |
| `<context>` block obeyed less reliably than a user turn | Unmeasured here. Dual-run one payload through both carriers, log which one the model followed, and do not retire the synthetic path globally until the comparison is recorded. |

**Fallback when the native API is unavailable.** Configuration `INSTRUCTION_INJECTION=native|synthetic` (default `native` after verification). If the client method is absent, the endpoint returns 404/405/403, or the helper cannot resolve a reachable server address or credentials, the loader logs one warning per session and uses the current prompt-plus-stash path with the same `buildSteeringMessage` payload. The flag is the only switch; both paths must never run for one block. A core-plugin build of the harness may instead call `InstructionEntry.Service` directly.

**Rollback.** Repoint a migrated call site to its previous publication path. Entries are additive and change no schema, so reverting the call site suffices; delete leftover entries with `DELETE .../entries/:key` so a reverted site stops rendering guidance.

**Migration for code that synthesizes user messages.**

1. Add `.opencode/plugins/helpers/instruction-entry.ts` exporting `putInstruction({ sessionID, key, value })`, `removeInstruction({ sessionID, key })`, `listInstructions({ sessionID })`, a key builder, and the size guard. Key builder: take the basename without `.instructions.md`, lowercase, map every character outside `[a-z0-9]` to `-`, collapse repeats, prefix `instr-` (for example `instr-serena-gateway`), which satisfies `^[a-z0-9][a-z0-9._-]*$` and stays unique within the single glob directory.
2. In `.opencode/plugins/instructions-loader.ts` replace the L114 `context.session.prompt(...)` call and the L115 `context.storage.set(pendingKey(...), message)` stash with one `putInstruction` call using value `{ text: <steering block>, source: <instruction path>, priority: 1 }`. The value is opaque JSON to the runtime, so these fields are a harness convention, not an API contract.
3. Delete the `event.system.push({ type: 'text', text: pending })` branch at L124-129, or keep the `context` hook only for logic that still needs it. No block may be pushed to `event.system` and written as an entry in the same turn. Because only the `context` hook sees the request tool map, a gate that depends on it must either evaluate in the `context` hook and write on a later boundary, or move to a gate input the `prompt` hook already has.
4. Retire the `instruction_load:<path>:full|:ref` idempotency keys (L93-121 and `helpers/instruction-context-helper.ts:62`) in favor of key-level upsert; keep a last-written hash only if a redundant PUT must be avoided on every touch.
5. Add tests: unit tests for key building, size rejection, and payload shape; an integration test that PUTs a steering block, asserts `GET …/entries` contains `api/instr-*`, and asserts the next request's system context contains `<context key="instr-…">` with the block byte-for-byte; a regression test that no `{ type: 'user' }` message contains `@<steering`.
6. Roll out behind `INSTRUCTION_INJECTION`: enable `native` for one agent class, verify the integration test and a live session, then default to `native` and keep `synthetic` for one release before deleting the old branch.
7. Migrate the second call site, the `<task_skills>` prepend at `.opencode/plugins/helpers/workflow-subtask.ts:116-157`, the same way: one key per skill, for example `instr-task-skills-<skill>`. Each migrated site writes one key, re-puts the same key with the same value to prove dedupe, and deletes it to prove the removal notice; keep the prepend for any call site whose text must precede the prompt in the same request, and list those sites so retirement is auditable. Do not change core `SessionInstructions.load`: its nested-`AGENTS.md` synthetic publication is core behavior outside this decision.

**Relationship to ADR-010.** `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection` (status `proposed`) decides what workflow guidance is injected and its exposure predicate, appending one `<workflow_instructions>` block to `event.system` from `.opencode/plugins/workflow.ts`. This ADR decides the carrier for instruction injection and applies it to the steering blocks from `instructions-loader.ts`. It does not change ADR-010's content, its default source (`.agents/skills/task-delegation/SKILL.md`), its no-truncation behavior, or its predicate, and it does not supersede ADR-010. Both carriers avoid user-role simulation; moving ADR-010 onto entries would be an amendment to ADR-010, not a consequence of this decision.

**Coexistence during migration.** ADR-010's `context`-hook injection into `event.system` and this entry-based path coexist until ADR-010 is amended. What selects between them is the `INSTRUCTION_INJECTION` configuration (`native` by default after verification, `synthetic` as fallback) together with whether the helper holds a usable transport — host-supplied, or self-resolved as described under Constructed transport. Exactly one carrier serves a given block in a given session. ADR-010's workflow block stays on the `context` hook during migration because that hook is the only one that sees the request tool map, so its gated decision does not have to move to a hook whose same-turn write behaviour is unverified.

**Workflow injection gate.** There is no prompt hook. The plugin subscribes with `ctx.event.subscribe` to `session.created` and `session.agent.selected`, filters those events, and handles the payload directly: it reads `event.data.sessionID` and `event.data.agent`, and when the agent is in the allow-list (`rug`, `rug-workflow`) it writes key `workflow.instructions` with put-if-changed; an unlisted agent removes the entry. No session.get fallback and no agent-resolution chain remain. In practice `session.created` arrives without an agent, so the write lands on `session.agent.selected` with the first turn, and the entry is present immediately after the first prompt.

### Validation and evidence (2026-10-20)

End-to-end test with a control arm, using `.opencode/plugins/tests/fixtures/instruction-entry-probe.ts` (inert unless `E2E_PROBE_ENABLED=1`) against a live server. Per submitted message the probe tried three write paths in order — `context.session.instructions.entry.put`, `@opencode/client`, raw `fetch` — each writing a fresh random token as the entry value, then logged the path, status, and a read-back attempt.

- **Path availability.** The context domain path was absent on every turn (`existed:false`); the typed `@opencode/client` path succeeded once given `baseUrl` and credentials. The context exposes no `client` and no server URL, and `context.app` is only `{ name, version, channel }`.
- **Plugin surface (type-level).** The plugin `Context` has exactly one argument, `context`, with `session: SessionDomain` and `rpc: RpcDomain`. `SessionDomain` is a `Pick` of `SessionApi` omitting `instructions`, `skill`, `shell`, `diff`, `inbox`, and `revert`, while `@opencode/client` has the method. `context.rpc` calls only host-registered definitions as `context.rpc(definition).method(...)`, the sole registration in this build being `experimental.browser`; instruction entries carry no `rpcID`.

**Effect service injection (ruled out).** The instruction-entry service exists as an Effect service tagged `@opencode/InstructionEntry`, implemented only inside the compiled binary (v2.0.32) with `put`, `list`, `remove`, and `load`. No installed package exports it, so a plugin has no import specifier to use, and a plugin effect cannot yield it either: a runtime probe inside a live plugin effect showed the ambient Effect context contains exactly five tags — `@opencode/State/CurrentBatch`, `@opencode/State/CurrentGroup`, `effect/Logger/CurrentLoggers`, `effect/References/MinimumLogLevel`, and `effect/Scope` — and a direct string-key lookup of `@opencode/InstructionEntry` returned `present=false`, with no `HttpClient` or client service provided, so the pruning is observable at runtime, not only in loader source. That pruning is deliberate in the loader, not a version accident, so a runtime upgrade will not add the tag. Effect dependency injection is therefore not a route to instruction entries in this build, and the state registration file remains the primary transport for plugin-side writes. The finding was verified against the binary, the loader code, and a runtime probe inside a live plugin effect.

- **Constructed transport.** With no client available from its inputs, the probe constructed `@opencode/client` and resolved transport itself from the live registration file `${XDG_STATE_HOME:-~/.local/state}/opencode/service.json` — `url` and `password`, rewritten on every server start — sending requests as Basic auth with username `opencode`; `~/.config/opencode/service.json` supplied only the password seed.
- **Hook surfaces.** The `context` hook is the only hook that sees the request tool map; a write issued from the `prompt` hook was honoured in the same turn (treatment arm). Same-turn behaviour for a write issued from the `context` hook remains unverified.
- **Auth and headers.** Basic auth (`opencode` / server password) is required; an unauthenticated PUT returns `401 Unauthorized` (`{"_tag":"UnauthorizedError",…}`). Directory-scoped requests need `x-opencode-directory`.
- **Routes.** PUT `…/entries/:key` writes, GET `…/entries` lists, DELETE `…/entries/:key` removes. GET `…/entries/:key` returned `404 Not Found` while the entry existed and was honoured — no get-by-key read.
- **Treatment arm.** With the write accepted, the model replied with exactly the fresh token on the same turn.
- **Control arm.** With the write denied (401, `writePath:"none"`), that token never appeared in the model reply, although the token was written to the probe log in both arms. Tools were disabled in both arms, so the token could not be read through a tool call.
- **Durability.** The list endpoint returned the written key and value, and DELETE removed it.

Result: the entry write is the cause of the model's reply, not log leakage; the carrier works end to end, and it works only for a writer that holds a transport — host-supplied or constructed as described above — together with credentials.

## Open questions

1. Does the pinned `[at]opencode-ai/sdk 1.18.34` (with `[at]opencode/plugin 2.0.24` Effect surface) generate `client.session.instructions.entry.list/put/remove`? Partially resolved (2026-10-20): the typed `@opencode/client` promise client exposes and executes `entry.put` at runtime. Whether the pinned SDK version generates those types remains unconfirmed.
2. How does an external plugin obtain the server base URL and credentials to call `/api/experimental/…`? Partially resolved (2026-10-20): not through its inputs — the context yields no client, no URL, and no credentials, and `context.rpc` cannot reach the routes. A plugin can resolve transport from its own environment through the live registration file `${XDG_STATE_HOME:-~/.local/state}/opencode/service.json` — the same source the CLI uses — but that is an out-of-contract workaround rather than a host guarantee. Whether the host will expose transport as a supported contract is undecided, and this record does not choose a mechanism.
3. Is the `priority` field in the documented `put` example interpreted by the runtime, or opaque JSON carried in the value? Assumed opaque here.
4. In what order are multiple entries rendered within the entries source (key order, or insertion)? Determinism matters for prompt-cache stability and is not evidenced.
5. Is `InstructionEntry.ValueTooLargeError` surfaced client-side by the SDK, or only as HTTP 413? This decides whether the helper can pre-empt or must catch.
6. Does a PUT issued from the `context` hook land in the next request's `select` reliably, or can it be observed two boundaries later? The spec states boundary-deferred observation; an end-to-end test observed same-turn honouring of a write issued from the prompt hook (2026-10-20), but hook-specific timing for the `context` hook was not verified. This matters because only the `context` hook sees the request tool map and only the `prompt` hook has a same-turn-verified write, so a gated injector cannot both gate on the tool map and write in the same turn without an unverified assumption.
7. How long do entries outlive a session — are they deleted with it, and do they survive retention windows? Not evidenced.
8. How does compaction summarize an already-admitted synthetic user message, and can such a message survive into a later epoch's summary? The epoch model characterizes entry state, not synthetic-message compaction.
9. Is a `<context key>` block obeyed as reliably as a user turn? No measurement exists in this repository; the end-to-end test shows the value reaches the model, not that guidance rendered this way is followed as reliably.
10. Does a fork copy a synthetic message published before its boundary? Entries are inherited as the parent's newest values; the message path is not evidenced.

## Sources

- `mem:researches/opencode/injecting-instructions-v2` — API surface, entry model and rendering, ordering (`context.ts` L132-158), delta and epoch lifecycle (`specs/v2/session.md` L90-96), documented order (docs `instructions.mdx` L63-76), alternatives, caveats.
- `mem:researches/adr-010-workflow-instruction-injection/opencode-api-facts` — installed versions and plugin surfaces, `instructions-loader.ts` line-level behavior, current dedupe keys.
- `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection` — precedent and boundary with this decision.
- `mem:cases/opencode-plugin-v2-tool-and-session-adaptation` — user message shape `{ type: 'user', text }`.
- `mem:cases/opencode/sdk_skills_injection` — the workflow helper's `<task_skills>` prepend, its trigger, and its line range.
- `.opencode/plugins/tests/fixtures/instruction-entry-probe.ts` — non-memory evidence: the end-to-end probe behind the 2026-10-20 validation, recording per-path availability, HTTP status, and read-back.
- `mem:architecture/adr/ADR-011-native-session-scoped-instruction-entries` — this record.