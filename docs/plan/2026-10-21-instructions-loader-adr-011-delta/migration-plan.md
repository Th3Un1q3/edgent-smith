# Instructions-loader ADR-011 migration plan

Status: proposed
Date: 2026-10-21
Scope: planning artifact only. No source file is changed by this document.

## 1. Summary and objective

`.opencode/plugins/instructions-loader.ts` currently delivers per-file instruction guidance as a synthetic user turn: it calls `context.session.prompt({ resume: false })` at `:114`, stashes the same text under `pending/<sessionID>` at `:115`, and a `session.hook('context')` at `:124-129` pushes it onto `event.system`. That carrier has no key, no update path, and no removal path, and the model sees harness guidance as something a human typed. ADR-011 replaces it with native session-scoped instruction entries: one keyed JSON value per session written through `client.session.instructions.entry.put`, rendered by the runtime as a `<context key="...">` block at the end of the instruction sequence, with change and removal narration on later turns.

The objective is one call site moved, not a redesign. Selection logic, the agent filter, the 18-file glob, and the formatting of each instruction block stay as they are. The only behaviour that changes is how a resolved instruction reaches the model: a keyed entry instead of a user turn, read-before-write instead of `instruction_load:*` sentinel tokens, and a per-session sweep instead of an append-only transcript. The loader keeps a synthetic path behind `INSTRUCTION_INJECTION` until a live check and a dual-run comparison prove the native block is followed, so the migration ships reversible and its retirement step stays gated.

## 2. Scope and non-goals

In scope: the loader's delivery path (`instructions-loader.ts:84-129`), the entry client it will use (`helpers/instruction-entry-client.ts`), the transport change that client needs (`helpers/service-client.ts`), the key map the index must expose (`helpers/instruction-indexer.ts`), the dead `ResolvedInstruction.idempotencyKey` field (`types/instructions.ts:26`, assigned at `helpers/instruction-context-helper.ts:62`), and the loader's test file.

Out of scope: `.opencode/plugins/workflow.ts` and its existing `workflow.instructions` entry. That path already writes native entries through the same client (`workflow.ts:19`, key at `:36`, calls at `:167` and `:178`), so it is not part of this migration and must keep working unchanged. Also out of scope: core `SessionInstructions.load`, the runtime's own synthetic publisher, and any selection, glob, or agent-filter change.

The `<task_skills>` prepend in `helpers/workflow-subtask.ts` (`:293-314`, literal block at `:313`; ADR-011 cites L116-157) is deferred. It is a second synthetic carrier that ADR-011 also retires, but it fires in a different path: it builds the prompt for a plugin-spawned subtask, where the skill body must be present before the child agent's first request, and the helper has no session-scoped storage threaded through it. Moving it needs the workflow runner's storage and session handles, which this loader change neither touches nor proves. It stays with program plan P6, where the storage threading and the `workflow.ts` coexistence rules already live.

Non-goals: no new helper module named `helpers/instruction-entry.ts` (D-1), no change to `MAX_ENTRY_VALUE_BYTES`, no change to the steering format used by other plugins, no attempt to control entry render order, and no migration of the workflow entry's string value to the loader's object value.

## 3. Current state, verified in the tree

The trigger is `context.tool.hook('execute.before')` at `instructions-loader.ts:84`. It reads the path from `event.input.path ?? event.input.filePath` (`:20-24`), gates on `TARGETED_TOOLS = new Set(['edit','write','read'])` (`:14`, applied `:86`), resolves the agent with `pickAgent(event.agent, session.agent)` (`:26-29`, `:88`), and resolves instructions through a per-agent helper cache (`:61-80`). `makeHelper` calls `createIndex` with the glob `.opencode/instructions/*.instructions.md` and `currentWorkingDirectory: context.location.directory` (`:66-71`). `InstructionContextHelper.resolveInstructions` (`helpers/instruction-context-helper.ts:38-69`) sorts by specificity then description and loads every matching body with `loadBody`, so bodies are read fresh on each touch.

The current carrier is two steps plus a hook. `formatInstruction` (`:31-53`) renders a full `<instruction>` block or a `<meta/>` reference; `buildSteeringMessage` (`:55-56`) wraps the joined blocks in `<steering priority="high" reason="relevant files touched" type="instructions">`. The message goes to `session.prompt` at `:114` and to `context.storage.set(pendingKey(...))` at `:115`; the `context` hook at `:124-129` pushes the stash into `event.system` and removes it. Dedupe is a token map under `idempotency/<sessionID>` (`:17`, read `:93`, filtered `:94-101`, written `:117-121`) keyed `instruction_load:<path>:full|ref`. `FULL_SLOT_BUDGET = 5` (`:15`) caps full bodies, and the count is derived from the token map at `:104-105`.

The entry client already exists. `helpers/instruction-entry-client.ts` exports `MAX_ENTRY_VALUE_BYTES` (`:10`), `entryValueBytes` (`:12`), `listEntries` (`:26-30`), `findEntry` (`:32-35`), `isEntryValueCurrent` (`:39-40`, strict `===`), `writeEntry` (`:42-56`, `value: string`, size guard `:43-45`, put at `:50`), and `removeEntry` (`:58-69`). Two details matter for this plan: the size guard at `:43-45` throws before the `try` at `:46`, so an oversize value is a rejected promise, not `{ status: 'failed' }`; and `writeEntry` calls `findEntry` at `:47`, which calls `listEntries` again, so each write costs its own GET.

The transport in `helpers/service-client.ts` resolves a connection from environment candidates, `service*.json` registrations, and `/proc` sockets, probes `/api/info` with a 1500 ms timeout, throws `no service: ...` when every candidate fails, and builds the client with `OpenCode.make({ baseUrl, headers: { authorization } })`. `getClient` currently takes `(dependencies = DEFAULT_DEPS)` and caches on `` `${connection.url}\n${connection.password}` ``. It sends no `x-opencode-directory`.

No rollout flag exists: `INSTRUCTION_INJECTION` has zero occurrences under `.opencode/`.

## 4. Target architecture

```
tool call (edit|write|read)
  │
  ├─ instructions-loader.ts:84  context.tool.hook('execute.before')
  │    :85-86   readFilePath + TARGETED_TOOLS gate          [unchanged]
  │    :87-88   session.get + pickAgent                     [unchanged]
  │    :89      makeHelper(agent) → Map cache :61            [unchanged]
  │    :90      resolveInstructions → createIndex :66-71     [unchanged]
  │              forFiles + loadBody per touch              [unchanged]
  │
  │    NEW native branch (flag = native)
  │      build one { text, source } value per file
  │      listEntries(sessionID, directory)      ── one GET per touch
  │      slots = 5 − count(priority===1, other keys)
  │      writeEntryIfChanged(existing, value)   ── one PUT per change, no re-read
  │      sweep once per (session, agent)        ── one GET + DELETEs on first touch
  │      mark carrier/<sessionID> = native
  │      return   (no prompt, no stash, no context hook)
  │
  │    OLD synthetic branch (flag = synthetic, or after the carrier switch)
  │      :93-121 tokens + session.prompt :114 + stash :115
  │      :124-129 context hook pushes into event.system
  │
  ▼
helpers/instruction-entry-client.ts
  writeEntryIfChanged → getClient(directory) → OpenAPI put
  writeEntry (workflow path) keeps its own findEntry
  size guard :43-45, deep compare, optional directory
  │
  ▼
helpers/service-client.ts
  resolve env → service*.json → /proc probe → base URL + password
  Basic auth: opencode:<password>; header x-opencode-directory
  │
  ▼
server: PUT /api/experimental/session/:sessionID/instructions/entries/:key
  upsert on (session_id, key); narrates changes and removals
  │
  ▼
next request: <context key="instr-…"> at the END of the instruction sequence
```

Already in the tree: `helpers/instruction-entry-client.ts` with list/find/write/remove for string values and `===` comparison; `helpers/service-client.ts` with discovery, Basic auth, and client caching; `workflow.ts` using that client for `workflow.instructions`; and the test files named in section 8.

Added by this migration: directory threading in `service-client.ts` and the entry client, a write path that accepts the already-read entry, object values with deep comparison, the key builder plus an index-wide collision guard, the loader's native branch with the flag, budget, carrier switch and sweep, and the new test cases.

Files touched, in total:

| File | Change |
|---|---|
| `helpers/service-client.ts` | `getClient(dependencies = DEFAULT_DEPS, directory?: string)`; cache key gains `\n${directory ?? ''}`; send `x-opencode-directory` |
| `helpers/instruction-entry-client.ts` | `writeEntry` value type `unknown`; deep compare; directory parameter; `writeEntryIfChanged` accepting a pre-read entry; export `instructionEntryKey` |
| `helpers/instruction-indexer.ts` | build the key map during the existing scan; throw on a duplicate key with both paths; expose `keysForAgent()` |
| `instructions-loader.ts` | native branch, flag read, budget, carrier switch and latch, sweep set, `carrier/` marker; synthetic path unchanged until step 7 |
| `types/instructions.ts` | remove `idempotencyKey` (step 5) |
| `helpers/instruction-context-helper.ts` | remove the assignment of that field (step 5) |
| `tests/instruction-entry-client.test.ts`, `tests/instructions-loader.test.ts` | new cases; synthetic cases retired in step 7 |
| `tests/helpers/service-client.test.ts` | header and cache-key cases (file exists today) |
| `tests/helpers/instruction-context-helper.test.ts` | rewrite the `it(...)` case titled at `:52`, which names `idempotencyKey` |
| Live verification | Delegated CLI/agent run; no test file is created and nothing is collected. |
| Superseded 2026-10-22 | The environment-gated live-suite row is superseded: live verification is a delegated CLI/agent run with a real agent/model, and the unit suite ships no environment-gated or skipped tests. |
| `docs/plan/2026-10-21-instructions-loader-adr-011-delta/bridge-evidence.md` | new evidence file created in step 6 |
| `docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md` | step 8 amendment: key family, delete contract, R-84 status |

No other file is created. `helpers/instruction-entry.ts` is deliberately not created (D-1).

## 5. Design decisions

### D-1. The ADR's helper is realized in `instruction-entry-client.ts`, not a new module

Decision. `putInstruction`, `removeInstruction`, `listInstructions`, the key builder, and the size guard from ADR-011 migration step 1 live in `helpers/instruction-entry-client.ts` as `writeEntry`, `removeEntry`, `listEntries`, `instructionEntryKey`, and `entryValueBytes`. No `helpers/instruction-entry.ts` is created.

Rationale. The module already exists, already owns discovery, auth, the client cache, the size guard, and the `written | unchanged | removed | absent | failed` status vocabulary, and already has a production caller in `workflow.ts`. ADR step 1 was written before that caller existed, so its file and function names describe an intent the tree has already implemented under different names. Creating a second module to match the ADR would duplicate the transport or force `workflow.ts` to migrate for cosmetic reasons, and it would split one key namespace across two owners, which makes the `instr-` sweep unsafe.

Alternatives rejected. A new `helpers/instruction-entry.ts` that re-exports `writeEntry` adds an import hop and no behaviour; a new module that reimplements discovery forks the auth logic the ADR's own risk table says must live in one place. Renaming `writeEntry` to `putInstruction` breaks `workflow.ts:167` and its tests for no gain. The ADR text is not amended; this document records the name mapping so a reader of either document lands in the right file.

### D-2. Transport: self-constructed, extended with the directory header

Decision. The loader keeps the self-constructed transport in `helpers/service-client.ts` and adds one parameter. The signature becomes `getClient(dependencies: ResolutionDependencies = DEFAULT_DEPS, directory?: string)`. The cache key at `:247` becomes `` `${url}\n${password}\n${directory ?? ''}` ``. The request headers become `{ authorization, ...(directory ? { 'x-opencode-directory': directory } : {}) }`. The loader passes `context.location.directory`, the same value it already gives `createIndex` at `:69`. Base URL and password keep their current sources: environment candidates first, then `service*.json` registrations, then `/proc` socket ports, each probed against `/api/info` with `PROBE_TIMEOUT_MS = 1500`. When no candidate responds, `resolve` throws `no service: ...`, which the loader treats as a carrier failure (D-7).

Rationale. The plugin context exposes no client, no URL, and no credentials, and `SessionDomain` has no `instructions` member, so the plugin must build the transport itself or fail. It already does. The only gap is the directory header: the entry routes are directory-scoped, and the current client sends only `authorization`. Directory belongs in the cache key rather than in per-request headers because a cached client would otherwise pin the first directory it saw, which is wrong for a plugin serving sessions in more than one working directory.

Alternatives rejected. Host-supplied transport is not available in `@opencode/plugin@2.0.24`; the ADR requires the host to supply it "where available" and it is not. Hardcoding `http://127.0.0.1:<port>` is what the resolver already avoids. Re-probing discovery per request would add a 1500 ms worst case to every tool call. Sending the header unconditionally is harmless but hides the case where the directory is unknown, so the parameter is optional and its absence is visible in the cache key.

### D-3. Dedupe and cost: one list per touch, writes that reuse it

Decision. Delete the `instruction_load:*` token map and the `idempotency/<sessionID>` storage key. Each touch reads `listEntries` once, and for each changed key calls a new `writeEntryIfChanged(sessionID, key, value, existing)` that compares and puts without re-reading. `writeEntry` keeps its current shape, including its own `findEntry`, because `workflow.ts:167` depends on it. On resume, a session whose entries still match the current index produces no writes and no narration.

Rationale. The server already dedupes by value: `put` upserts with `setWhere: removed = true OR changed`, and an unchanged value is a silent no-op. The token map was an external mirror of that state and could disagree with it after a fork, a move, or a compaction, which are exactly the cases ADR-011 says entries survive. It also makes the cost model honest: `writeEntry` at `:47` re-reads the list for every write, so a touch of five files would cost six GETs. Passing the pre-read entry through `writeEntryIfChanged` restores one GET per touch plus one PUT per change.

Alternatives rejected. Keeping the token map as a fast path saves one GET per touch and reintroduces divergence. A content hash in storage has the same divergence problem with an extra encoding step. Skipping the read after the first touch of a session would break the budget count after another plugin writes an entry, and would miss an entry removed outside the loader. Changing `writeEntry` itself to take the pre-read entry would break the workflow caller's contract for no reason.

### D-4. The five-full-slot budget survives, counted from live entries

Decision. Keep `FULL_SLOT_BUDGET = 5`. Compute `slots = max(0, 5 - count(entries where value.priority === 1 and key !== currentKey))`. A file that already has a full entry stays full; a new match takes a slot when one is free and is written with `priority: 0` otherwise. `priority` is a loader convention only: the runtime treats the value as opaque JSON.

Rationale. Entries render on every request, not once as a user turn, so an unbounded full-body set costs tokens on every turn of a long session. The budget matters more under the native carrier, not less. Counting from `listEntries` is deliberate: the budget answers how many full blocks the server will actually render, which is a fact about stored rows, not about the index. The index cannot know what earlier touches of the session wrote, and a budget computed from the index alone would let five blocks per touch accumulate to eighteen. So the cache is authoritative for capacity, and for nothing else.

A reference-only entry is still meaningful. It tells the model that an instruction file exists, what it applies to, and where it lives, which is enough for the model to read the file when the task actually needs it. What changes is that a reference entry is no longer a consolation prize for a dedupe hit; it is a budget decision, and it persists until the sweep removes it.

Alternatives rejected. Dropping the budget and writing 18 full bodies would add tens of KiB to every request. Counting only entries written by the current touch would reset the budget on each tool call and let 18 full bodies accumulate one file at a time. Dropping references entirely would save bytes and lose the pointer to the file. Encoding the role in the key, as the program plan's `instr-ref-*` family does, is rejected in section 6 because it duplicates `priority` and forces a key rename on every budget change.

### D-5. The steering envelope is dropped in native mode and kept for the fallback

Decision. The native entry's `text` is the per-file `<instruction>` block from `formatInstruction` (`:31-53`), without the `<steering priority="high" reason="relevant files touched" type="instructions">` wrapper. `buildSteeringMessage` (`:55-56`) stays until step 7 because the synthetic branch still needs it. `.opencode/instructions/steering-message.instructions.md` is not changed: it governs messages that appear as user or system content, and a native entry never does.

Rationale. The wrapper's three attributes exist to tell a reader that a message is harness-generated and how to weigh it. In native mode the `<context key="instr-…">` element already carries the key, the runtime supplies the narration for changes and removals, and no consumer parses `priority="high"`; keeping it would nest `<steering>` inside `<context>` and add bytes to every entry. Other plugins (`goal-continuation.ts:79`, `tool-limit-reminder.ts:46`, `helpers/gate-formatter.ts:30`) keep using steering, so the contract still describes them and does not become dead documentation.

Alternatives rejected. Keeping the envelope inside the entry is redundant and inflates each value. Migrating every steering producer to entries is a different, larger migration with no ADR. Editing the steering instruction to carve out an exception for the loader would document a carrier that is being retired.

### D-6. Boundary timing: a write informs the next request, not the current one

Decision. Accept that a `put` issued in `execute.before` is observed at the next request boundary. The loader does not try to make the current turn see its own write. The delegated live check asserts the block on the following request, or records that it cannot observe the sequence (section 8). The plan documents the consequence for users: the first edit or read of a file informs the model from the next turn onward, not in the turn that touched the file.

Rationale. ADR-011 states the write is boundary-deferred and does not interrupt a running step, and it only verified same-turn visibility for the `prompt` hook, not for tool hooks. The current carrier has the same latency class: the stash is written in `execute.before` and consumed by the `context` hook when the next request is assembled. In practice the guidance still arrives before the model next acts on that file, because the touch that triggers it has already happened.

Alternatives rejected. Pushing the text into `event.system` for the current turn would create the second carrier D-7 forbids and reintroduce the double-delivery defect. Writing at `session.hook('prompt')` instead of `execute.before` would remove the file path that drives selection. Blocking the tool call until the entry is acknowledged would add an HTTP round trip to every edit and still would not change the request already in flight.

### D-7. Write failure: one session-wide carrier switch, then latch

Decision. The trigger is the client's return value, not an HTTP status: every call that returns `{ status: 'failed' }` switches the carrier. `EntryResult` is `{ status, error?: string }` (`instruction-entry-client.ts:20-23`), so the loader has no typed status code to branch on; it does not try to tell 401 from 403 from a rejected socket. The `error` string travels into the log line, and that is the only place a status code appears. On the first such result in a session the loader performs a carrier switch, once: it lists the session's entries, deletes every `instr-` key (logging the count), removes the `pending/<sessionID>` and `idempotency/<sessionID>` keys, publishes the current touch through the synthetic path, records the synthetic tokens for the blocks it just published, and writes `carrier/<sessionID> = 'synthetic'`. Every later touch in that session takes the synthetic branch without another list, another probe, or a second warning.

The size guard is not part of that contract. It throws at `:43-45`, before the `try` at `:46`, so an over-cap value never becomes a `failed` result and must never be routed through the switch. The loader calls `entryValueBytes` first. A value over `MAX_ENTRY_VALUE_BYTES` is not written, that file is skipped, and one error line records the key and the measured size. The other files in the same touch still publish. Retrying oversize text through `session.prompt` would move a size failure into the context window; downgrading the block to a reference would silently weaken guidance. ADR-011 says to fail loud and skip, and that is what this does.

After step 7 deletes the flag, every transport failure logs one error and skips the touch.

Rationale. The latch in the first draft was wrong: it left already-written native entries rendering while the synthetic path re-sent the same blocks, because the token map is only populated in the synthetic branch (`:117-121`). That is exactly the double-carrier defect the ADR forbids, and it would have appeared only on a failed session, which is the hardest case to notice. Deleting the session's `instr-` keys before the first synthetic publish makes the switch real: one carrier, chosen once per session, with no block present in both. Recording the synthetic tokens matters too, otherwise the next touch of an already-published file re-sends it.

Alternatives rejected. Block-level fallback (the first draft) duplicates guidance. Failing loud and letting `Effect.orDie` defect the hook would break the tool call that triggered injection; the existing code already uses `orDie` at `:122`, so an uncaught throw is a real risk. Dropping silently makes a 401 look like "no instructions matched". Keeping the flag authoritative for the rest of the session would mean retrying an unreachable server on every tool call, so the session keeps the choice it made, and the flag applies to the next process or the next session.

Logging. One info line per native touch with `{ sessionID, status, written, unchanged, skipped, liveKeys, slots, carrier }`, one warning on the switch with the reason and the deleted key count, one line per oversize skip, and one info line with the sweep deletion count. Instruction text and entry values are never logged. Statuses reuse the client's `EntryStatus` vocabulary.

### D-8. Stale entries: overwrite first, sweep once per session and agent

Decision. Overwriting is the normal lifecycle: a changed body produces a changed value, and the server narrates the change. In addition, the first touch of a `(session, agent)` pair performs one sweep, guarded by an in-memory `Set` keyed `${sessionID}\n${agent}`: list entries, keep keys matching `^instr-`, and delete any whose key is absent from the current agent's index, or whose `value.source` no longer exists on disk, or whose key no longer equals `instructionEntryKey(value.source)`. Entries without a string `source` are left alone with one warning. The sweep never touches `workflow.instructions`, because the prefix filter excludes it.

Rationale. A deleted instruction file leaves an entry that renders forever, because entries render until removed. The index membership test also fixes the agent-switch gap: keys carry no agent segment, and entries are session-scoped, so an entry written under agent A would keep rendering under agent B even when B's `excludeAgents` excludes that file. Reconciling against the current agent's key set removes it, and a later touch under A republishes it. Sweeping per `(session, agent)` rather than per session bounds the ping-pong to one sweep each time the user switches agent, which is rare; the alternative is guidance the agent was never meant to see.

Removal narration is the intended effect, and it is asserted in step 4: deleting a stale key makes the runtime announce that the context under that key no longer applies, which is the right thing to say about guidance the model may have read. For a file the model never saw, the notice is redundant but harmless, and it occurs at most once per session and agent.

Alternatives rejected. Sweeping on every touch adds deletes to the hot path. Subscribing to `session.deleted` depends on cascade semantics nobody has verified. Deleting every `instr-` key at session start would throw away the budget and force a re-publish of every touched file. Keying the sweep on the index's current key set alone would delete entries for files in the glob that this agent's frontmatter filter excludes, which is why the index key set, not the glob, is the membership test.

### D-9. Selection stays; the entry set is reconciled, not the selector

Decision. `createIndex`, the specificity sort in `instruction-context-helper.ts:46-52`, the `appliesToAgents`/`excludeAgents` filters, and the glob stay as they are. The per-agent `Map` at `:61` stays keyed by agent. The one addition to `createIndex` is a key map built during its existing scan, exposed as `keysForAgent()`, which D-8 uses for reconciliation.

Rationale. Only delivery changes; the selector decides what matches, and the sweep decides what stops rendering. Those are different questions and the split keeps each testable. The cache is safe to keep because bodies are re-read on each touch through `loadBody` (`instruction-context-helper.ts:57`), so an edited instruction body is picked up without a reindex; only a new or renamed file needs the index rebuilt, which hot reload provides.

Alternatives rejected. Adding the directory to the helper cache key is unnecessary because the plugin's `context.location.directory` is fixed for the instance. Caching rendered entry values per agent would go stale on the first body edit. Rebuilding the index per touch would re-glob 18 files and re-parse frontmatter on every edit.

### D-10. Entries are a derived cache, never a source of truth

Decision. The instruction files stay the only source of truth. The loader never reads an entry value as input to selection, never treats `text` as authoritative for anything, and never edits a value by hand. Anything that repairs or rebuilds entries works by deleting keys and letting the next touch republish. Operators may delete whole keys during a rollback; nobody edits a value.

Rationale. ADR-011 states this explicitly, and the failure mode is quiet: a hand-edited entry keeps rendering a block that no file on disk produces, and the sweep only checks `source` existence, so a stale body with a live path would survive. Every repair path in this plan is therefore a delete-and-republish, including the carrier switch (D-7), the sweep (D-8), and the rollback in section 9.

Alternatives rejected. A reconciliation command that writes values is a second writer with its own drift. Storing a rendered payload in the repo as a seed reintroduces a copy of the instructions. Treating entries as durable state would make the 18 instruction files advisory, which inverts the intent.

## 6. Entry contract

Key derivation. Take the path's basename, strip the `.instructions.md` suffix, lowercase it, map every character outside `[a-z0-9]` to `-`, collapse repeated `-`, and prefix `instr-`. The result matches `^[a-z0-9][a-z0-9._-]*$` and is sent without the `api/` prefix; the server stores it as `api/<key>`. Dots and underscores are mapped like any other out-of-set character, which follows ADR-011's builder literally.

One key family. Full blocks and reference blocks share the `instr-<slug>` family; the role travels in `value.priority`. This supersedes the program plan's split `instr-ref-<slug>` family and its "one family per invocation" delete rule. The reason is that the split family encodes the same fact twice, once in the key and once in `priority`, and a file moving between full and reference would need a delete plus a create with a spurious "no longer applies" narration. One family means one key per file for the life of a session, a budget change is a value update, and the delete contract is a single prefix: every loader key matches `^instr-`, and no loader key is exempt.

Worked examples from this repo:

| Source path | Key |
|---|---|
| `.opencode/instructions/serena-gateway.instructions.md` | `instr-serena-gateway` |
| `.opencode/instructions/no-permission-workarounds.instructions.md` | `instr-no-permission-workarounds` |
| `.opencode/instructions/opencode-plugin-interfaces.instructions.md` | `instr-opencode-plugin-interfaces` |
| `.opencode/instructions/justfiles.instructions.md` | `instr-justfiles` |
| `.opencode/instructions/steering-message.instructions.md` | `instr-steering-message` |
| a future `.opencode/instructions/API_Design.instructions.md` | `instr-api-design` |
| a future `.opencode/instructions/a.b.instructions.md` | `instr-a-b` |

Collision handling. The glob is one flat directory, so a collision requires two distinct basenames that sanitize to one key, such as `api-design` and `API_Design`. The guard runs where the whole file set is visible: `createIndex` already scans every file (`instruction-indexer.ts:93`), so it builds a `Map<key, path>` during that scan and throws on a duplicate with both paths listed. A guard in the entry client could only see the current touch, and two colliding files touched on different turns would silently overwrite each other. If the glob later spans directories, the suffix must be a deterministic hash of the repo-relative path, and both the sweep and the guard must accept it.

Value shape and size.

```json
{
  "text": "<instruction>\n  <description>…</description>\n  <path>…</path>\n  <content>…</content>\n</instruction>",
  "source": ".opencode/instructions/serena-gateway.instructions.md",
  "priority": 1
}
```

`text` is the per-file block, without the steering wrapper (D-5). `source` is the repo-relative path, which the sweep uses. `priority` is `1` for a full body and `0` for a reference. The cap applies to the whole value: `entryValueBytes(value) = Buffer.byteLength(JSON.stringify(value), 'utf8')` must be `<= MAX_ENTRY_VALUE_BYTES` (262144). An over-cap value is not written and not rewritten into a smaller shape: the loader skips that file, logs one error with the key and measured size, and continues with the rest of the touch. The client's guard at `:43-45` throws before its `try`, so the loader measures first and never relies on catching it.

Rendering consequence. Because the value is an object, the runtime renders `JSON.stringify(value, null, 2)`, so newlines inside `text` arrive escaped. That is the cost of carrying `source` and `priority` in the value; the delegated live check records the per-entry byte cost before the default flips.

## 7. Implementation steps

Each step leaves the tree green and is reviewable on its own. The flag defaults to `synthetic`, so steps 1 to 4 change no production behaviour.

1. Transport directory scoping. Files: `helpers/service-client.ts` (`getClient(dependencies, directory?)`, cache key at `:247`, headers), `helpers/instruction-entry-client.ts` (add a trailing optional `directory?: string` to `listEntries`, `findEntry`, `writeEntry`, and `removeEntry`), `tests/instruction-entry-client.test.ts`, `tests/helpers/service-client.test.ts`. Acceptance: a unit test asserts `x-opencode-directory` on put, list, and remove; two directories produce two cached clients; the existing three-argument `writeEntry`/`removeEntry` calls at `workflow.ts:167` and `:178` compile untouched, and `tests/workflow.test.ts` still passes.

2. Entry value contract and one-read writes. Files: `helpers/instruction-entry-client.ts` (`writeEntry` accepts `unknown`, deep compare, `instructionEntryKey`, `writeEntryIfChanged`), `helpers/instruction-indexer.ts` (key map, duplicate throw, `keysForAgent()`), `tests/instruction-entry-client.test.ts`. Acceptance: object values compare by serialized content; an identical object returns `unchanged` and issues no put; `writeEntryIfChanged` issues no list; the key builder produces the table in section 6; an index over two colliding basenames throws naming both paths; the size boundary passes at exactly 262144 bytes.

3. Native branch that cannot misbehave. Files: `instructions-loader.ts`, `tests/instructions-loader.test.ts`. Adds the flag read per invocation, the native branch after `:90`, the budget, the oversize skip, the carrier switch and latch, the `carrier/` marker, and the one-time cleanup of `pending/` and `idempotency/` for a session that already has native entries. Acceptance: with `native`, a targeted call writes one entry per matching file and the fake `session.prompt` receives zero calls; the sixth file gets `priority: 0`; an over-cap file is skipped with one error and no reference write; a `listEntries` rejection deletes the session's `instr-` keys, publishes synthetically once, writes the marker, and issues no second list on the next touch. The loader test mocks `@plugins/helpers/instruction-entry-client` with `vi.mock`, the same seam `tests/workflow.test.ts` uses; the fake context at `tests/instructions-loader.test.ts:43-63` has no client, so unmocked calls would hit `no service`.

4. Sweep. Files: `instructions-loader.ts`, `tests/instructions-loader.test.ts`. Acceptance (mock): an entry whose source is gone is deleted on the first touch and only once; an entry keyed for a file this agent excludes is deleted; a `workflow.instructions` entry and any non-`instr-` key survive; an entry with a non-string `source` produces one warning and no delete. Live verification: delegated live run; no test file.

5. Dead field removal. Files: `types/instructions.ts`, `helpers/instruction-context-helper.ts`, and `tests/helpers/instruction-context-helper.test.ts`, where the `it(...)` case titled at `:52` names `idempotencyKey`; rewrite that case so it asserts the resolved fields without the dead one. Acceptance: `idempotencyKey` has no occurrence under `.opencode/plugins`; typecheck passes and the rewritten case is green.

6. Live evidence and the dual-run record. Files: a new evidence file this step creates, `docs/plan/2026-10-21-instructions-loader-adr-011-delta/bridge-evidence.md`. Live verification: delegated live run; no test file. Acceptance: with the flag at `native`, a touch produces a `<context key="instr-…">` block, the next request carries it once, no `{ type: 'user' }` message contains `<instruction` or the key, a changed body produces one change narration, a deleted key produces one removal narration, and the per-entry byte cost is recorded in `bridge-evidence.md`. For the dual-run, run one payload twice in separate sessions, once per carrier, and record in the same file which carrier's guidance the model followed. Observation, in order of preference. First, `session.hook('model.request')`: step 6 starts by checking whether its payload exposes the assembled instruction sequence, because no repo code reads it today. If it does, capture the serialized request and assert position and count directly. If it does not, the accepted fallback evidence is: (a) `GET .../entries` returns exactly one matching `instr-` key, which proves storage-level exactly-once; (b) `session.messages`, the channel `workflow-subtask.ts:405` already reads, contains no `<instruction` and no key, which proves no user-turn carrier; (c) a behavioral probe over one instruction file with a unique marker, run once per carrier, which proves the guidance reached the model and supplies the dual-run comparison; and (d) position is taken from ADR-011's "entries load last" statement and recorded in `bridge-evidence.md` as not locally observed. A reviewer accepts (a) through (d) as the proof; the step does not leave the assertion open without an artifact.

7. Retire the synthetic path in the loader. Files: `instructions-loader.ts`, `tests/instructions-loader.test.ts`. Deletions: `session.prompt` (`:114`), the `pending/` stash (`:115`), the token map (`:17`, `:93-121`), `FULL_SLOT_BUDGET`'s token-derived count (`:104-105`), the `session.hook('context')` registration (`:124-129`), `buildSteeringMessage` (`:55-56`), `tokenKey`/`pendingKey` (`:17-18`), the flag read and its branch, the carrier switch and latch, the sweep marker key, and the synthetic test cases at `tests/instructions-loader.test.ts:87,97,107,140`. After this step a failure logs one error and skips; the tests for the gate and agent filter (`:122`, `:131`) stay. Gate: all four flip criteria in section 9 are met, including the recorded dual-run.

8. Amend the program plan so one contract remains. Files: `docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md`. Four numbered changes, one per amendment section 13 records.
   1. Oversize: replace the rule that publishes an over-cap file as a reference entry (R-74) with skip plus one error line and no reference write; mark R-74 superseded and point it at D-7 here.
   2. Fallback: replace the block-level fallback rows (D15, D18) with the session-wide carrier switch in D-7.
   3. Flag: change D7's default from native after P5 to `synthetic` until the dual-run in step 6 exists.
   4. Entry contract: replace the `instr-ref-<slug>` family and the `--prefix instr-` exemption with the single `instr-<slug>` family and the `^instr-` delete prefix; mark R-84 superseded for loader entries because its value shape names the steering block D-5 drops; rewrite the operator-tool delete contract at `:448-474` to one prefix with no exemption.
   Acceptance: the four edits are present; the normative key-family rows and the delete contract state the single family; `grep -n "instr-ref-"` returns hits only in historical inventory rows, never in the key-family, value-shape, or delete-contract rows; and a reader searching either document finds one key family and one delete rule. This step changes documentation only; it ships before step 7 so the retirement is never described by two contracts.

## 8. Test plan

Existing files to extend: `.opencode/plugins/tests/instruction-entry-client.test.ts`, `.opencode/plugins/tests/instructions-loader.test.ts`, `.opencode/plugins/tests/helpers/service-client.test.ts`, `.opencode/plugins/tests/helpers/instruction-context-helper.test.ts`, and `.opencode/plugins/tests/workflow-instructions.test.ts` as a regression guard that the workflow entry keeps its string value. All exist today.

Live verification: delegated live run; no test file. That delegated run is the only check that can prove the HTTP route, the auth, the render, the narrations, and the absence of a user turn.

**Superseded 2026-10-22:** the `*.live.test.ts` file described in earlier drafts, including its `E2E_PROBE_ENABLED=1` skip, is superseded: live verification is a delegated check with a real agent/model, and the unit suite ships no env-gated or skipped tests.

Loader test seam. `tests/instructions-loader.test.ts:43-63` builds a fake context with `session.prompt`, `storage`, and hooks and no client, so the native branch's `listEntries` would reach `getClient()` and throw `no service`. The file must add `vi.mock('@plugins/helpers/instruction-entry-client')` and drive `listEntries`, `writeEntryIfChanged`, and `removeEntry` from a stub, the same pattern `tests/workflow.test.ts` already uses for this client. Without that seam no native case can run.

Unit cases: key builder (lowercase, suffix strip, out-of-set mapping, repeat collapse, prefix, duplicate collision with both paths); object equality; `unchanged` with no put; `writeEntryIfChanged` issuing no list; size guard at the boundary and one byte over; directory header on all three verbs; two-directory cache isolation; discovery failure returning `failed` with the `no service` message.

Loader cases, native: one entry per matching file; unchanged entry not re-put; only the changed file written when one body changes; fifth and sixth file split by `priority`; oversize skip with no put and no prompt; discovery failure switching the carrier once and deleting `instr-` keys; sweep deleting a vanished source, an agent-excluded source, and sparing `workflow.instructions`; non-targeted tool performing no list and no put.

End-to-end assertion in the delegated live run: the block appears once and after the last instruction block (via the `model.request` channel if it exposes the sequence), no user message contains `<instruction` or the key, one change narration, one removal narration, and the byte cost per entry. The absence assertion is on `<instruction`, not `<steering`, because D-5 removes the wrapper and a duplicated native block would not contain it.

## 9. Rollout and rollback

`INSTRUCTION_INJECTION` does not exist yet. Step 3 introduces it with values `native` and `synthetic`, read from the environment on each `execute.before` invocation so a test or a hot reload can change it without a restart. Unset resolves to `synthetic` in the release that introduces the branch. Any other value resolves to `synthetic` and logs one warning per process. The flag is the carrier selector: for every session it decides the carrier at session start, and it remains authoritative whenever its resolved value changes. The per-session latch from D-7 is a scoped exception, not a second selector: it is logged once per session at warning, it lives only in process memory, and it resets when the resolved flag value changes or the process restarts, at which point the flag selects again. The `carrier/<sessionID>` marker exists for rollback, not for selection.

Flip criteria, all four required, and step 7 waits for all four:

1. The delegated live run completes against a real server and records the render, the count, the narrations, and the absent user turn.
2. One release runs with `INSTRUCTION_INJECTION=native` set explicitly in the operator environment with no carrier-switch warning in the log.
3. The recorded per-entry byte cost keeps a typical five-entry session within the loader's context budget.
4. A dual-run record exists: one payload, both carriers, and a statement of which one the model followed. ADR-011 requires this comparison before the synthetic path is retired, and step 7 asserts its presence.

Rollback before step 7, primary path. Set `INSTRUCTION_INJECTION=synthetic` and restart. On the first touch of a session marked `carrier/<sessionID> = native`, the loader switches: it lists the session's entries, deletes every `instr-` key, logs the count, clears `pending/` and `idempotency/`, publishes the current blocks synthetically, and rewrites the marker. No hand surgery, and the switch is the same code path D-7 uses, so it is tested. A session that never touches a file again keeps rendering its entries; they are still derived from files that exist, so they remain correct guidance until the operator needs them gone.

Rollback before step 7, immediate path for idle sessions. The program plan specifies an operator tool at `:448-474`; until it lands, this sequence stands alone and follows the same resolution chain `helpers/service-client.ts` implements.

1. Resolve the connection the way `resolve` does: environment candidates first, then state registrations read from `service*.json` (pattern `^service(?:-[^/]+)?\.json$`, seed `~/.config/opencode/service.json` from `CONFIG_SEED`), then `/proc` socket ports. Take `url` and `password` from the `Registration` that passes `GET {url}/api/info` with `authorization: Basic base64("opencode:{password}")`, the same probe `isConnectionLive` runs.
2. `GET {url}/api/experimental/session/{sessionID}/instructions/entries` with the same `authorization` header and `x-opencode-directory: <session directory>`. Keep the keys that start with `instr-`.
3. `DELETE {url}/api/experimental/session/{sessionID}/instructions/entries/{key}` with the same headers, once per key. Expect the `NoContent` success status ADR-011 records for this route.

That is deletion of whole keys, which the ADR permits for rollback; no value is edited (D-10).

Rollback after step 7. There is no flag and no switch in the loader, so recovery is a release revert. The revert restores the synthetic branch, and the first touch of a session then re-publishes every matching block, because the token map is empty. Then run the list-and-delete sequence above for sessions that will not be touched, so a restored synthetic carrier does not render alongside leftover entries.

## 10. Risks and mitigations

Per-request token cost. Entries render on every request, and an object value renders as pretty-printed JSON with escaped newlines in `text`. An 18-file session with 5 full bodies can add tens of KiB to every turn, where the old user turn was paid once. Mitigation: the five-slot budget, references beyond it, and the step 6 measurement before the default flips. If the measurement is bad, lower `FULL_SLOT_BUDGET`; do not truncate entries.

Duplicate injection. A bug that writes an entry and also calls `session.prompt` for the same block shows the guidance twice. Mitigation: one carrier per session, enforced by the D-7 switch, which deletes the session's entries before the first synthetic publish. The native branch returns before `:93`, the switch is the only place that writes both paths, and step 3 asserts that after a switch no `instr-` key remains.

Stale entries after an edit. The index cache at `:61` is per agent and never rebuilt, so a renamed or newly added instruction file is invisible until reload, while an edited body is picked up because `loadBody` runs per touch. Mitigation: the sweep reconciles key to source and to the agent's index on the first touch, and hot reload applies a saved file immediately.

Agent switch. Keys carry no agent segment, so an entry written under one agent can render under another. Mitigation: the sweep is keyed per `(session, agent)` and removes keys absent from the current agent's index (D-8). The cost is a republish when the user switches back.

Key collisions. Two basenames that sanitize alike silently overwrite each other, because the server flat-namespaces keys and `put` has no owner check. Mitigation: the index-wide guard throws with both paths during `createIndex`.

Boundary lag. A touch in turn N informs turn N+1. Mitigation: accepted in D-6; the delegated live run checks the following request rather than the current one.

Experimental route churn. Every call sits under `/api/experimental/`, and the contract may move. Mitigation: all calls stay in `instruction-entry-client.ts`, so a route change is one file, and the delegated live run is the canary.

No atomicity. There is no CAS, ETag, or version on `put`, and `list` ordering is undocumented. Mitigation: keys are per file, never an aggregate, so concurrent touches of different files cannot lose each other; same-key races are last-write-wins and an identical content race is a no-op.

Dirty baseline. `workflow.ts` and `workflow-subtask.ts` carry uncommitted edits, and line numbers in this plan can shift under them. Mitigation: commit or stash before step 1 and re-read the entry files at that point.

## 11. Verification checklist

Run from `/workspace`; a reviewer should see the stated outcome for each.

1. `just opencode::typecheck` passes with no new error.
2. `just opencode::lint` passes.
3. `just opencode::test -- plugins/tests/instruction-entry-client.test.ts` passes, including header, object-value, key-builder, collision, and size-boundary cases.
4. `just opencode::test -- plugins/tests/instructions-loader.test.ts` passes; native cases make no `session.prompt` call, and the fallback case leaves no `instr-` key.
5. `just opencode::test -- plugins/tests/workflow-instructions.test.ts` passes unchanged, proving the workflow entry still uses its string value.
6. `just opencode::test` passes.
7. Live verification: delegated live run; no test file.
   **Superseded 2026-10-22:** the env-gated live-suite step described in earlier drafts is superseded: live verification is a delegated check with a real agent/model, and the unit suite ships no env-gated or skipped tests.

8. `grep -rn "instruction_load:\|pending/\|idempotency/" .opencode/plugins/*.ts` returns nothing after step 7, and before step 7 returns hits only inside the loader's synthetic branch.
9. `grep -rn "INSTRUCTION_INJECTION" .opencode/` returns the flag read and the loader test before step 7, and nothing after.
10. `grep -rn "buildSteeringMessage\|session.hook('context')\|steering" .opencode/plugins/instructions-loader.ts` returns nothing after step 7.
11. `grep -n "instr-ref-" docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md` returns hits only in historical inventory rows; the key-family rows and the delete contract name the single `^instr-` prefix.
12. Derived-cache check: `grep -n "\.value\|listEntries\|value\.text" .opencode/plugins/instructions-loader.ts` shows every use confined to the publish path, meaning equality comparison, budget classification, and sweep membership. No entry value reaches `resolveInstructions`, `forFiles`, `createIndex`, or `pickAgent`, so selection never consumes stored guidance.
13. `git status --short` shows only the files listed in section 4 plus the two plan documents and `bridge-evidence.md`. The pre-existing uncommitted changes under `.opencode/plugins/`, `.opencode/agents/`, `docs/workflow-tool.md`, and `.serena/memories/` are not part of this work and must not be staged with it.
14. `just ci` passes before the default flip.

## 12. Open questions

1. Does deleting a session delete its entry rows? Recommendation: assume rows persist and rely on the sweep plus session-scoped routes; do not add end-of-session cleanup without evidence.
2. Does `entry.list` return bare keys or `api/`-prefixed keys? Recommendation: normalize on read by stripping a leading `api/`, and record the observed form in the delegated live run so the assumption stops being one.
3. In what order do multiple entries render? Recommendation: rely on none. The loader cannot guarantee cross-file order, and the specificity sort only decides which files get full bodies.
4. Is a write from `execute.before` visible on the next request reliably, or can it lag two? Recommendation: assert exactly one boundary in the delegated live run; if it lags, the user-visible effect is a slower first application, not a correctness break.
5. Does the runtime interpret `priority`? Recommendation: treat it as opaque and keep it as a loader convention, as D-4 assumes.
6. Does `session.hook('model.request')` expose the assembled instruction sequence? Recommendation: check it first at step 6, and if it does not, use the fallback evidence set (a) to (d) in that step and record the result in `bridge-evidence.md`. The step never ends without an artifact; position is the only item taken from ADR-011 rather than observed.
7. Is `context.location.directory` the value the server expects in `x-opencode-directory` for sessions in a worktree? Recommendation: send it, and confirm with a live write from a second directory before the default flip.

## 13. Relationship to the program plan

`docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md` is authoritative for the program-wide design, requirements R-01 to R-103, and decisions D1 to D27, except for the four amendments this delta makes. Precedence is explicit: for loader keys and the loader's carrier, this document wins; for every other call site, requirement, and decision, the program plan wins. Step 8 lands the amendments in the program plan so the two documents state one contract rather than two.

| This plan | Program | Relationship |
|---|---|---|
| D-1 | D11, P1 | Follows D11; records the ADR step-1 name mapping |
| D-2 | D5 | Extends `service-client.ts`; D5 assumes the header already reaches the endpoint |
| D-3 | D7, D22, P2 | Replaces the token map; adds a write path that reuses the preflight list |
| D-4, section 6 | Operator tool at `:448-474`, `instr-ref-` family at `:343` | Supersedes the split family: one `instr-<slug>` key per file, role in `priority`. The operator tool's delete contract becomes the single prefix `^instr-`, and its "one family per invocation" rule is dropped for loader keys |
| D-5 | R-84 | Superseded for loader entries: `value.text` is the `<instruction>` block without the steering wrapper |
| D-6 | ADR boundary rule | Same conclusion, now anchored to a tool hook rather than the prompt hook |
| D-7 | D15, D18 | Session-wide carrier switch while the flag exists; log-and-skip after step 7 |
| D-8 | D9, D25 | Sweep once per `(session, agent)`, keyed on index membership plus `value.source` |
| D-10 | ADR derived-cache rule | Carries the invariant into every repair path |
| step 7 | P6 | Loader half only; `<task_skills>` stays with P6 |

Amendments this version records: the oversize policy is skip-and-log, not degrade-to-reference; the fallback is a session-wide carrier switch, not a block-level supplement; the flag starts at `synthetic` until a dual-run comparison exists; and the loader uses one key family, so the program plan's `instr-ref-` split and its operator-tool exemption do not apply to these keys.
