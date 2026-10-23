# Instructions-loader → ADR-011 delta migration plan (validated)

This is an independently validated delta plan for migrating `.opencode/plugins/instructions-loader.ts` to the instruction-entry carrier in `architecture/adr/ADR-011-native-session-scoped-instruction-entries`; it supersedes the concurrent `migration-plan.md` in this directory **only if** that draft is unmaintained, and while both are maintained the program plan (`docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md`) wins on IDs.

## 1. Purpose, scope, consumer

- **Purpose:** replace the prompt-plus-stash user turn with one keyed instruction entry per instruction identity, per session, without changing which instructions match; `value.text` keeps today's steering bytes, which the runtime renders inside its own JSON wrapper.
- **Scope:** `.opencode/plugins/instructions-loader.ts` and the helpers it imports or gains (`instruction-entry-client.ts`, `instruction-payload.ts` (created in Δ1), `instruction-carrier.ts` (classification created in Δ1, carrier created in Δ2), `instruction-indexer.ts`, `instruction-context-helper.ts`, `service-client.ts`).
- **Consumer:** the engineer implementing program phases §6.1–§6.4 for the loader site; the reviewer checking that the loader delta does not contradict program decisions D2/D3/D5/D7/D15/D19/D20/D24/D25/D26/D27.
- **Non-duplication:** requirement rows R-01…R-103 are authoritative in the program plan and are cited by ID only. This document adds the loader-level rules the program plan states ambiguously or not at all.

## 2. Relationship to the program plan

| Program artifact | Anchor | Role in this delta |
|---|---|---|
| Carrier foundation (client, keys, payload module, directory thread) | §6.1 (line 461) | Implemented by Δ1, restricted to loader-facing exports |
| Native publication path + flag | §6.2 (line 480) | Implemented by Δ2 |
| Retire `idempotencyKey` | §6.3 (line 495) | **Not covered here.** Program §6.3 owns it and removes `types/instructions.ts:26`, `instruction-context-helper.ts:62` and the case at `plugins/tests/helpers/instruction-context-helper.test.ts:52`; no phase of this delta touches those files, and the loader never reads the field |
| Test suites | §6.4 (line 505) | Δ2, Δ3 and Δ4 |
| Rollout and default flip (D7) | §6.5 (line 518) | Behaviour implemented in Δ2 under the approval in §7; §6.5 records the default change in `resolveInjectionCarrier(env, agent)` |
| Synthetic retirement | §6.6 (line 532) | **Untouched.** No phase here deletes the synthetic arm |
| Removal gates | §8.3 (line 703) | Precondition for §6.6 only; the delta never closes them |
| Live suite / probe | §7.4 (line 672) | Δ4 runs the loader's probe as a delegated live check; no test file and nothing collected (`.opencode/instructions/live-verification.instructions.md`) |
| Transport and fallback | §5.6 (line 364) | Δ1 carries the taxonomy in D-06; Δ2 applies its actions |
| Index path contract | §6.2 (lines 484-487) | Δ1 and Δ2 use the program names `indexedPaths` and `allPaths` |
| Operator prefixes | D27 (line 792) | Amended in §7 for the fourth key family |
| Decisions table | §9.3 (line 762) | Amended per §7 below |

The delta is ordered so that every program anchor it touches is either already implemented in the tree or created here with a matching name; it never renames a program-owned module.

## 3. Baseline vs target

Baseline (verified in the tree):

1. `instructions-loader.ts:114` calls `context.session.prompt(...)` with the steering block; `:115` stashes the same text.
2. `instructions-loader.ts:124-129` pushes the stash into `event.system` on the `context` hook — a second delivery channel.
3. `instructions-loader.ts:93-121` dedupes on `instruction_load:<identity>` tokens in plugin storage, where `:99` sets `identity = instruction.path ?? instruction.description`; `:15` caps full bodies at 5 from that token map.
4. `instructions-loader.ts:122` terminates the tool hook with `Effect.orDie`, so any rejection inside the generator is a defect.
5. `instruction-entry-client.ts:42-56` `writeEntry` takes `value: string`, pre-checks size **outside** the `try` at `:43-45`, and its `:39-40` `isEntryValueCurrent` compares with `===`.
6. `instruction-entry-client.ts:32-35` `findEntry` compares raw keys (`:34`); `:26-30` returns raw keys, so an `api/` prefix would defeat both.
7. `instruction-indexer.ts:142-145` returns `{ forFiles, loadBody }` only — the index exposes no path listing.
8. `ResolvedInstruction.path` is optional in the type (`types/instructions.ts:25`), but `instruction-context-helper.ts:64` always sets it from `InstructionMeta.path`, which the indexer always populates; only a producer that omits the field yields a path-less instruction.
9. `plugins/tests/instructions-loader.test.ts:87-151` asserts the prompt channel six times with no flag set.
10. `plugins/workflow.ts:178-180` writes `WORKFLOW_ENTRY_KEY` as a raw string through the same client — an existing string-valued consumer that must keep working.

Target:

11. One `writeEntry` per instruction identity per session, value `{ text, source, priority }`, key `instr-<slug>` — program D17 (`migration-plan.md:782`), a deliberate departure from the single `putInstruction` call at ADR-011:157-158 (§8, Granularity); `session.prompt` and the `event.system` push remain only in the flagged synthetic arm.
12. `INSTRUCTION_INJECTION` read on every touch: `native` and `synthetic` accepted, unset resolves to `native` once the §7 D7 approval lands, unknown resolves to `native`.
13. `writeEntry` accepts the object value, compares field-wise, returns `reason`/`cause` in its result, and never throws across its boundary.
14. Sweep removes only index-derived dead keys, per touch, never on fallback or on a carrier switch.
15. Loader outcomes (`published|skipped|fallback|degraded`) are a separate union from the client's `EntryStatus` (`instruction-entry-client.ts:19`).
16. Every entry request carries `x-opencode-directory` for `context.location.directory` (program D5).

## 4. Decisions

### 4.0 Known-issue resolution index

| # | Issue | Rule | Test (phase) |
|---|---|---|---|
| 1 | One failure mapping, including a missing client method | D-06 table: nine conditions, one reason, one action each; row 1 falls back; row 9 skips without fallback | `classifies every entry failure to exactly one reason` (Δ1); `a client without the entry method falls back`, `an unclassifiable failure skips the turn without a fallback` (Δ2) |
| 2 | 413 pre-check outside `try`; `orDie` at `:122` | D-07: pre-check moves inside `try`, returns a result; native arm catches inside the generator with Δ1's `toCarrierError` | `returns oversize in the result without putting or throwing` (Δ1); `a rejecting publisher leaves the hook successful` (Δ2) |
| 3 | `api/` prefix | D-03 `stripApiPrefix` on list, find, write, remove | `finds an entry returned with either key spelling`; `lists an entry returned with the api/ prefix`; `strips the api/ prefix before put and remove` (Δ1) |
| 4 | Fallback seeding | D-08 seeds `instruction_load:<identity>` from listed entries; no delete on fallback/switch | `seedExclusions suppresses entries already listed` (Δ3) |
| 5 | Path-less instruction | D-11 `instr-desc-<slug>`, source is the raw description, else skip-with-warning | `publishes a path-less instruction under the description key`; `skips a path-less instruction with no description and warns` (Δ2) |
| 6 | Legacy tests | D-02: pin `instructions-loader.test.ts:87-151` to `synthetic`; native describe asserts unset→native | `unset INSTRUCTION_INJECTION resolves to native` (Δ2) |
| 7 | Program adopt/amend status | §7 table, one owner per amendment | Review gate, no runtime test |
| 8 | Stale sweep | D-09: per-touch, `indexedPaths ∪ allPaths` live set, foreign-family exclusion, freshness rebuild | `a deleted source file is swept on the next touch`; `keeps a key whose file is in allPaths but not indexedPaths`; `when both keys exist for an untouched identity the full-body key stays live` (Δ3) |
| 9 | Rendered `<context>` unobservable | D-12: token-channel probe + list-based removal | delegated live check (§7.4) (Δ4); no test file, nothing collected; `.opencode/instructions/live-verification.instructions.md` |
| 10 | Program refs resolve | §2 anchors 6.1–6.6, §8.3, §5.6, §7.4 | Review gate |
| 11 | Vocabulary collision | D-13: disjoint unions, one outcome per touch | `loader outcomes and entry statuses do not overlap` (Δ4); `assigns one loader outcome per touch` (Δ2) |
| 12 | Directory scope | D-01/D-05: `getClient(directory)` sends `x-opencode-directory`; loader passes `context.location.directory` | `sends x-opencode-directory when a directory is supplied`; `sends no directory header without a directory` (Δ1) |
| 13 | One instruction identity | §5: `identity = path ?? description`; source, token and seeding use it verbatim | `a description-only entry carries the raw description as source`; `seeds the instruction identity from value.source` (Δ2, Δ3) |
| 14 | Slug collision | D-03: both colliding identities take `-<sha256(identity)[0..7]>`; the bare key is swept | `two identities that collapse to one slug both take the hash suffix` (Δ1) |
| 15 | Partial publication loses entries | D-14: ledger at `instruction-carrier/<sessionID>.unpublished`, republished at the next touch | `records unpublished identities and republishes them at the next touch` (Δ2) |
| 16 | Seeding cannot list | D-08: seed nothing, log once, never delete | `a failed seeding list seeds nothing and logs once` (Δ3) |

### D-01 — Transport stays the loopback client

`getClient(dependencies?, directory?)` (`service-client.ts:244-256`) remains the only transport; no code path calls `context.session.instructions`. Reason: the plugin session domain does not expose instructions, and the delta must not add a second transport to review. The trailing `directory` is threaded to every entry call; when supplied, the client sends `x-opencode-directory` (ADR-011:182, verified on directory-scoped routes listed at ADR-011:38), and when omitted it sends no header (program D5, §6.1:468). The directory is part of the client cache key, so two directories never share a cached client (`service-client.ts:245-256`).

### D-02 — Flag semantics

`resolveInjectionCarrier(env: Record<string, string | undefined>, agent: string): 'native' | 'synthetic'` lives in `helpers/instruction-carrier.ts` (program §6.2:484) and reads `INSTRUCTION_INJECTION` on **every touch** (no module-level constant, no latch):

| Input | Mode | Side effect |
|---|---|---|
| `native` | `native` | none |
| `synthetic` | `synthetic` | none |
| unset / empty | `native` | none (ADR-011:151 default) |
| any other value | `native` | one warning per distinct value per process (program §5.6:375) |

Executable rules: Δ2 calls `resolveInjectionCarrier(process.env, agent)` at the top of `execute.before`, before the index is built; the resolved carrier is logged once per touch at `debug` as `carrier=<native|synthetic> agent=<agent>` (program §6.5). The agent argument is carried for that line only: no branch routes on it (`migration-plan.md:772`). An invalid value never selects `synthetic`, because a typo must not silently downgrade delivery. The warning latches per distinct rejected value in a module-level set in `helpers/instruction-carrier.ts`, so each rejected value is named once per process and a second, different value is named too (program §5.6:375); the resolved mode is not latched, so a corrected value takes effect on the next touch. Legacy cases at `plugins/tests/instructions-loader.test.ts:87-151` are pinned with a `beforeEach` that sets the variable to `synthetic` and an `afterEach` that restores the previous value. The unset→native default is a deviation from program D7's staging, approval-gated per §7. Unknown → `native` is a second deviation from §5.6:375, which resolves an unknown value to whatever default is current (there `synthetic` through Phase 4); both departures are recorded in §7's D7 row.

### D-03 — Identity, keys, slug, collision, normalization

Instruction identity is stated once in §5. Keys are the identity's projection:

| Family | Key | Value priority | Writer |
|---|---|---|---|
| full body | `instr-<slug>` | 0 | loader |
| reference | `instr-ref-<slug>` | 1 | loader (budget or oversize) |
| description-only | `instr-desc-<slug>` | 0 | loader (D-11) |
| task skills | `instr-task-skills-<skill>` | 2 | program §6.6 site |

`instructionSlugFor({ path?, description? })` takes the identity, strips a `.opencode/instructions/` prefix and a `.instructions.md` suffix, lowercases it, maps every character outside `[a-z0-9._-]` to `-`, collapses runs, and replaces a leading non-`[a-z0-9]` with `0`. Today the loader glob is flat (`instructions-loader.ts:68`), so the slug is the basename; a nested file yields `dir-file`, which is the labelled deviation from the basename mapping at ADR-011:157-158 (program §6.1's builders take `{path?, description?}`).

Collision policy: if two live identities in one family produce one slug, **both** keys get `-<sha256(identity)[0..7]>`, i.e. `instr-<slug>-<hash>`; the previous bare key is not live and is swept. This is deterministic per index snapshot and self-healing, because the sweep's live set is derived from the same identities.

`stripApiPrefix(key) = key.startsWith('api/') ? key.slice(4) : key` applies in `listEntries` (map each key), `findEntry` (compare stripped on both sides), `writeEntry` and `removeEntry` (strip before I/O, so the client never sends `api/`). Canonical in-memory form is bare. Builders live in `helpers/instruction-payload.ts` under the program names `instructionEntryKey(instruction)`, `instructionReferenceKey(instruction)`, `instructionSlugFor(instruction)` and `instructionSlugFromKey(key)`; the delta adds `instructionDescriptionKey(instruction)` for the fourth family.

### D-04 — Value shape and the client change it forces

Value is `{ text: string, source: string, priority: 0 | 1 | 2 }` — the ADR shape, kept deliberately (§8). `text` is `buildSteeringMessage(formatInstruction(instruction, isReference))` for one file, i.e. the exact bytes the synthetic branch sends today, so R-87's byte-for-byte check runs against `value.text`. The rendered entry is `JSON.stringify(value, null, 2)` inside `<context key>` (ADR-011:42), so the model sees those bytes wrapped, not verbatim; R-87 is narrowed to the field, and program §6.4's payload-shape case is amended in §7. `source` is the identity from §5 verbatim: the absolute instruction path, or the raw description when there is no path. No repo-relative form and no synthesized `description:` label exist, so D-08 seeding compares equal strings.

Client surface, stated once (Δ1):

```ts
type InstructionValueObject = { readonly text: string; readonly source: string; readonly priority: 0 | 1 | 2 }
type InstructionValue = string | InstructionValueObject
writeEntry(sessionID: string, key: string, value: InstructionValue, snapshot?: InstructionEntry[], directory?: string): Promise<EntryResult>
removeEntry(sessionID: string, key: string, snapshot?: InstructionEntry[], directory?: string): Promise<EntryResult>
listEntries(sessionID: string, directory?: string): Promise<InstructionEntry[]>
findEntry(sessionID: string, key: string, directory?: string): Promise<InstructionEntry | undefined>
```

Only `writeEntry` and `removeEntry` take `snapshot`; no list call takes one. `isEntryValueCurrent(entry, value: InstructionValue)` compares `text`, `source` and `priority` field-wise. `===` is deleted for objects because object identity never matches a decoded JSON value. `EntryResult` gains `reason?: EntryFailureReason` and `cause?: unknown`; `error?: string` stays for the current callers. `plugins/workflow.ts:178-180` keeps passing a string and must keep compiling: `InstructionValue` admits a bare string, and `isEntryValueCurrent` compares strings with `===` and objects field-wise.

### D-05 — One list per touch, non-atomic writes accepted

The native arm calls `listEntries(sessionID, directory)` exactly once per touch and passes the returned array as the `snapshot` argument to every `writeEntry` and `removeEntry` in that touch. `writeEntry` and `removeEntry` read the existing value from `snapshot` when supplied and skip `findEntry`'s internal list; on `written` they replace or append the key in the array, on `removed` they delete it, so later calls in the same touch see earlier results. `findEntry` keeps its internal list for callers with no snapshot (`plugins/workflow.ts:178-180`); the operator tool uses `listEntries` and `removeEntry`, not `findEntry`. Test `one list backs N writes` stubs `listEntries`, performs N writes against one snapshot and asserts one list call.

`put` has no CAS (verified: `client/dist/promise/generated/types.d.ts:6211-6226` carries no version/ETag), so last-write-wins is accepted with one writer per family per session: the loader writes only `instr-`, `instr-ref-`, `instr-desc-`; the task-skills site writes only `instr-task-skills-`. Distinct identities are distinct keys, so a lost update can only occur for the same key from two touches carrying different values, which is the same file re-rendered — an idempotent overwrite.

### D-06 — Failure taxonomy: one condition, one reason, one action

| # | Condition (verified surface) | Reason | Action |
|---|---|---|---|
| 1 | `client.session.instructions.entry` is undefined, checked before the call (program §5.6:383) | `method-absent` | fallback |
| 2 | `getClient` rejects with `no service: …` (`service-client.ts:203-205`) | `discovery` | fallback |
| 3 | `isUnauthorizedError` (`types.d.ts:3370`) | `unauthorized` | fallback |
| 4 | `isForbiddenError` (`types.d.ts:3544`) | `forbidden` | fallback |
| 5 | `isSessionNotFoundError` (`types.d.ts:3401`) | `session-not-found` | fallback; the failure is retried on the next touch |
| 6 | `isInstructionEntryValueTooLargeError` (`types.d.ts:3451`) | `oversize` | no fallback: this file becomes `instr-ref-` + loud log |
| 7 | local size pre-check inside `writeEntry` (D-07) | `oversize` | same as 6 |
| 8 | `ClientError.reason === 'UnexpectedStatus'` | `transport` | fallback |
| 9 | default branch | `unknown` | skip the turn, no fallback; cause logged once |

The mapping is one module with three exports, created in Δ1 in `helpers/instruction-carrier.ts`; Δ2 supplies the action and Δ3 only consumes the result:

```ts
type EntryFailureReason = 'method-absent' | 'discovery' | 'unauthorized' | 'forbidden' | 'session-not-found' | 'oversize' | 'transport' | 'unknown'
class InstructionCarrierUnavailableError extends Error { readonly reason: EntryFailureReason }
classifyEntryFailure(error: unknown): EntryFailureReason
toCarrierError(error: unknown): InstructionCarrierUnavailableError
```

`classifyEntryFailure` is the single mapping point for a caught error; the local pre-check sets `reason: 'oversize'` on the result without entering it, so row 7 never reaches the classifier. `detail` is never read and no status is parsed out of `message`. `toCarrierError` wraps a caught error's reason; the publish path calls it only for rows 1–5 and 8 — rows 6 and 7 return `EntryResult` with `reason: 'oversize'` and never become carrier errors, and row 9 returns `skipped`, logs the cause once and raises neither the carrier error nor the synthetic path (program D26). Outside the taxonomy: nothing. A reason-9 failure after the first write is `degraded`, not `skipped` (D-13); it never falls back.

"Carrier unavailable" is an *outcome*, not a reason — see D-13. One warning per session per reason family is emitted through `instruction-carrier/<sessionID>` storage state (program R-71); the warning does not latch the mode, so the next touch retries the native path.

### D-07 — Interrupt safety

Two rules, both testable:

1. `writeEntry` moves the size pre-check inside its `try` (`instruction-entry-client.ts:43-45` today throws outside it) and returns `{ status: 'failed', reason: 'oversize' }` instead of throwing. Every other catch stores the thrown value in `EntryResult.cause` and leaves `reason` unset for the carrier to classify.
2. The loader's native arm is `Effect.tryPromise({ try: () => publishInstructionSet(request), catch: e => toCarrierError(e) })` piped through `Effect.catchAll` **inside** the generator, before the handler's terminal `.pipe(Effect.orDie)` (`instructions-loader.ts:122`). `toCarrierError` and `InstructionCarrierUnavailableError` come from Δ1, so this catch is typed on the first try and needs no stub. Acceptance: with `writeEntry` stubbed to reject, `Effect.runPromise(h.before(event))` resolves and the hook writes no prompt.

The synthetic arm keeps today's non-throwing shape; `orDie` continues to guard only genuinely unexpected defects.

### D-08 — Fallback seeds exclusions; nothing is deleted

When the outcome is `fallback`, the loader seeds its synthetic dedupe set from the native entries it can list:

- list once (best effort); for each `instr-*` entry with an object value, seed `instruction_load:<value.source>`;
- for a legacy string-valued `instr-*` entry, resolve its `<slug>` through the index-derived `slug → identity` map and seed that identity; an unresolvable slug seeds nothing;
- if the list itself fails, seed nothing and log once — duplicate delivery is preferred to deletion.

Rules: `removeEntry` is called only from `publishInstructionSet`'s `removals` (D-14), and only when `outcome === 'published'`. Neither a fallback nor a mode switch deletes any `instr-*` entry. A switch `native → synthetic` seeds as above, and the identity equality means an already-published block is not delivered twice. A switch `synthetic → native` does not read the token map (program D22), so a block the synthetic arm delivered earlier in the same session is published once as an entry; at most one duplicate per block is possible across that direction, and nothing is deleted.

### D-09 — Sweep: index-derived, per touch, foreign families excluded

Live identity set (the program's union, program §6.2:484-487 and D9):

```text
identities = ⋃ helpers { p | p ∈ indexedPaths ∪ allPaths } ∪ { identities published this touch }
```

`liveKeys` projects each identity once, by role:

| Family | Candidate family | Live projection |
|---|---|---|
| full body | the bare `instr-` family, excluding the three prefixed families | `instr-<slug>` when the identity's role is full: this touch's budget decision, else the snapshot entry's `priority === 0`, or the key family alone when the value is a legacy string; when both keys exist for an untouched identity, the full-body key wins |
| reference | `^instr-ref-` | `instr-ref-<slug>` when the role is reference: this touch's decision, else the snapshot entry's `priority === 1`, or the key family alone when the value is a legacy string |
| description | `^instr-desc-` | none: no index path projects a description key, so this family is never a candidate and its keys outlive the publishing touch (D-11) |
| task skills | `^instr-task-skills-` | none: never a candidate, never removed |

The full-body candidate regex is `^instr-(?!ref-|desc-|task-skills-)`, written here rather than in the table so the pipes are literal; the same regex filters the D-10 budget count.

Projecting one key per identity keeps one live key per family; projecting both families for every path would keep a superseded key alive forever, so the union is taken over identities, not keys. A legacy string-valued entry is live by its key family alone, because a string carries no `priority` to test: a bare `instr-` string is a full body, which D-10 also counts, and an `instr-ref-` string is a reference. A string-valued `instr-desc-` key is outside the live set like every other description key, and the sweep never removes it.

`indexedPaths` is this agent's indexed files (`:93` scans with `absolute: true`; the global filter `:58-60`, the agent-allow filter `:66-69` and the agent-exclude filter `:71-72` run after the path is recorded). `allPaths` is every glob match, recorded at the top of the scan loop before those filters and before frontmatter parsing, so a global, agent-excluded or unparsable file is in `allPaths` but not in `indexedPaths`. The loader materialises one helper per agent in its `helpers` Map (`instructions-loader.ts:61`); the union runs over every helper plus the current agent's index. `createIndex` returns both arrays next to `forFiles` and `loadBody` (`instruction-indexer.ts:142-145`); `InstructionContextHelper` exposes both (program §6.2:487). No `paths()` accessor is introduced, so the delta does not rename a program-owned contract.

Exclusions: task-skills and description keys are never candidates; keys outside `instr-` are untouched. A file in `allPaths` keeps its keys even when no indexed agent matches it, which is what protects an agent this process has not touched.

Algorithm, on every native touch after a successful list: take candidates per family from the snapshot; pass each candidate absent from that family's live projection to `publishInstructionSet` as a `removals` entry; ignore `absent` results. A path with no entry projects no key until a touch matches it.

Freshness: the helper cache (`instructions-loader.ts:61-80`) would keep a deleted file in its index forever. Each helper caches `allPaths`; on every native touch, compare those basenames (filtered to `*.instructions.md`) with a fresh `readdirSync(join(context.location.directory, '.opencode/instructions'), { withFileTypes: true })` filtered the same way (regular files, suffix). Both sides compare basenames only; the indexer's global, allow and exclude filters run after `allPaths` is recorded, so none of them can force a rebuild. If the sets differ (deletion, addition or rename), discard the helper and rebuild it once before the sweep. A file deleted mid-session is swept on the next touch that resolves the same agent; there is no once-per-session `Set` and no sweep latch.

### D-10 — Budget counted from live entries

`FULL_SLOT_BUDGET` (`instructions-loader.ts:15`) is replaced by `FULL_BODY_BUDGET = 5`, counted from the per-touch snapshot: keys matching `^instr-(?!ref-|desc-|task-skills-)` whose value is an object with `priority === 0`. A string-valued full-body key counts too, because only a pre-D-04 writer could have produced it; this delta never rewrites it. The exclusion keeps `instr-desc-<slug>` (priority 0) from consuming full-body slots. Program D3's role rule is restated exactly: a file that already holds a full entry keeps that role and is not re-budgeted. An identity is **new** when the snapshot holds no full-body key for it. Every non-held matched identity is visited in ascending identity order and takes a full slot while fewer than five are held; otherwise it is written as `instr-ref-<slug>` (priority 1). An oversize body (D-06 rows 6–7) is reference regardless of a free slot, and an existing full key for that identity is swept in the same touch. The token-map count at `:104` is deleted with the native path's token read.

### D-11 — Path-less instructions

`ResolvedInstruction.path` is optional (`types/instructions.ts:25`). Rule: identity is the raw `description`; the key is `instr-desc-<instructionSlugFor({ description })>`; `source` is that description verbatim. If both `path` and a non-empty `description` are absent, the instruction is skipped with one warning naming `applyTo`; no entry is written and no error is raised. Synthetic behaviour is unchanged (it already falls back to `description` at `:99`), so the fallback seed matches a description-only entry.

### D-12 — Observability

The rendered `<context key="instr-…">` block is **not** observable from this repository and is never asserted. The program's token-channel probe (§7.4) is the only treatment observation: a fresh random token in `value.text` under a dedicated key, tools disabled, the token observed in the model's reply. Removal is observed through the entry list before/after the sweep, not through rendered context.

### D-13 — Two vocabularies

`EntryStatus = 'written' | 'unchanged' | 'removed' | 'absent' | 'failed'` (`instruction-entry-client.ts:19`) is the client's. `LoaderOutcome = 'published' | 'skipped' | 'fallback' | 'degraded'` is the loader's, declared in `helpers/instruction-carrier.ts` in Δ2. One outcome per touch, assigned by this table (first match wins):

| Outcome | Trigger | Entries | Fallback |
|---|---|---|---|
| `fallback` | carrier unavailable (D-06 rows 1–5, 8) before the first write | none | synthetic path, once |
| `degraded` | any failure after the first write (program D15), including rows 1–5, 8 and row 9; the remaining identities are recorded under `instruction-carrier/<sessionID>.unpublished` (D-14) and republished at the start of the next touch | partial | none |
| `skipped` | D-06 row 9 before any write; a zero-match touch (`instructions-loader.ts:91` returns before the list); or every candidate skipped by D-11 | none | none |
| `published` | at least one file `written` or `unchanged`, and no row above matched | published set | none |

A file rejected as oversize (D-06 rows 6–7) is written as `instr-ref-`, never skipped, so a touch whose every candidate is oversize is `published`; `skipped` requires that the touch requested no entry at all.

A zero-match touch writes nothing, lists nothing, sweeps nothing and publishes nothing from the ledger. The only mapping is `classifyEntryFailure` plus this table, both applied inside `publishInstructionSet`. Types are disjoint by construction and a type-level test pins that (`Extract<LoaderOutcome, EntryStatus>` is `never`) in Δ4; `assigns one loader outcome per touch` pins that exactly one row matches, in Δ2, where the assignment lands.

### D-14 — Publish contract and the unpublished ledger

Δ2 owns one entry point, so the hook has no write logic of its own:

```ts
type InstructionEntryKey = string
interface InstructionEntryDraft { readonly identity: string; readonly key: InstructionEntryKey; readonly value: InstructionValueObject }
interface PublishStatus { readonly identity: string; readonly key: InstructionEntryKey; readonly status: EntryStatus | 'skipped'; readonly reason?: EntryFailureReason }
interface PublishResult { readonly outcome: LoaderOutcome; readonly published: readonly string[]; readonly statuses: readonly PublishStatus[] }
publishInstructionSet(request: { sessionID: string; directory: string; entries: readonly InstructionEntryDraft[]; removals: readonly InstructionEntryKey[]; snapshot: readonly InstructionEntry[] }): Promise<PublishResult>
```

`published` holds the identities whose status was `written` or `unchanged`; `statuses` holds one row per draft in input order, so a caller never infers status from `published`. `removals` holds the keys this touch supersedes: the carrier de-duplicates them and calls `removeEntry` for each only when the outcome is `published`, ignoring `absent` results. The loader computes keys, budget roles, values and dead keys (§D-03/D-09/D-10/D-11) and passes them in; the carrier performs the writes and removals, classifies failures, assigns the D-13 outcome and owns the ledger. The carrier never lists: the snapshot is the loader's single list for the touch (D-05).

Ledger key: `instruction-carrier/<sessionID>.unpublished` in plugin storage, next to the per-reason warning state (D-06). Schema:

```json
{ "version": 1, "entries": [ { "identity": "<identity>", "key": "instr-<slug>", "value": { "text": "<rendered block>", "source": "<identity>", "priority": 0 } } ] }
```

Cap and eviction: at most 16 entries and 96 KiB serialized; on overflow evict in insertion order (oldest first), refreshing an existing identity's position when it is re-recorded, and drop a single entry larger than the cap with one warning. On the next native touch that reaches publication, the carrier drafts ledger entries before the current turn's drafts, writes them against the same snapshot, deletes each ledger entry whose write returned `written` or `unchanged`, and keeps the rest; an empty ledger removes the storage key. A ledger entry that fails again stays and consumes a slot, so a permanently failing identity cannot starve the ledger beyond its one slot.

## 5. Entry contract

| Field | Rule |
|---|---|
| Identity | `identity(instruction) = instruction.path ?? instruction.description`, byte for byte — the expression the synthetic arm already evaluates at `instructions-loader.ts:99`. Paths are absolute (`instruction-indexer.ts:93` scans `absolute: true`); a path-less identity is the raw description. `value.source`, the synthetic token read at `instructions-loader.ts:99`, D-08 seeding and every loader key projection use this one string; the synthetic arm's token write at `:118` keys on `entry.instruction.path`, so a description-only instruction never enters that map. No repo-relative form exists. |
| Key | `^[a-z0-9][a-z0-9._-]*$` (ADR-011:40), slash-free, bare (never `api/`); four prefix-scoped families (D-03), the loader's three derived from the identity by `instructionSlugFor` |
| Value | `{ text, source, priority }`; `source` is the identity verbatim and non-empty; `text` is the byte-exact per-file steering block; `priority ∈ {0,1,2}` |
| Size | 256 KiB = 262144 bytes (ADR-011:40) measured by `entryValueBytes(value)` (`instruction-entry-client.ts:12`) on the serialised value (`JSON.stringify` bytes), checked inside `try`; over-limit → `instr-ref-` |
| Directory | `x-opencode-directory` on every entry request; the loader passes `context.location.directory`, and `getClient(dependencies?, directory?)` omits the header when the argument is absent (program D5, ADR-011:182) |
| Dedupe | Field-wise equality; a re-put with equal fields returns `unchanged` and performs no `put` |
| Ordering | No order is inferred from `list` (it documents none); each `text` block names its own `<path>`, so any render order is semantically valid; the budget, not order, decides full vs reference |
| Rendering | One entry per instruction identity (program D17, §8 Granularity); a write is visible at the next request boundary on `PUT /api/experimental/session/:sessionID/instructions/entries/:key` (ADR-011:41), so the same turn must not also push to `event.system` (native arm only); object values render as pretty-printed JSON (ADR-011:42) |
| Read normalization | `stripApiPrefix` on list/find/write/remove; bare form is canonical for comparison, budget and sweep |
| Non-goals | No CAS, no TTL, no aggregate map entry (an aggregate would need the full map on every put and lose the per-file diff) |

## 6. Phased delta sequence

Symbol ownership, checked backward from Δ4 to Δ1:

| Symbol | Produced in | Consumed by |
|---|---|---|
| `formatInstruction`, `buildSteeringMessage`, key builders | Δ1 (`helpers/instruction-payload.ts`) | Δ2 |
| `InstructionValue`, `EntryResult.reason/cause`, `writeEntry`, `removeEntry`, `listEntries`, `findEntry` | Δ1 (`helpers/instruction-entry-client.ts`) | Δ2, Δ3 |
| `EntryFailureReason`, `InstructionCarrierUnavailableError`, `classifyEntryFailure`, `toCarrierError` | Δ1 (`helpers/instruction-carrier.ts`) | Δ2 |
| `indexedPaths`, `allPaths` | Δ1 (`instruction-indexer.ts`) | Δ2, Δ3 |
| `getClient(dependencies?, directory?)` | Δ1 (`service-client.ts`) | Δ2, Δ3 |
| `LoaderOutcome`, `resolveInjectionCarrier`, `publishInstructionSet`, `PublishResult`, ledger | Δ2 (`helpers/instruction-carrier.ts`) | Δ3, Δ4 |

Coverage gate: both new modules live under `plugins/helpers/`, so `coverage.include: ['plugins/**/*.ts']` (`vitest.config.ts:34`) collects them from the first commit, and the 90% branches/functions/lines/statements thresholds (`:40-45`) bind immediately. Δ1 ships the payload, key, client and classification cases, and Δ2 ships the carrier and ledger cases, so no exclusion is added and the gate stays green at every phase boundary.

### Δ1 — Carrier contract and failure classification (program §6.1 subset)

- **Files:** `helpers/instruction-entry-client.ts`, `helpers/instruction-payload.ts` (new), `helpers/instruction-carrier.ts` (new; classification layer only), `helpers/instruction-indexer.ts`, `helpers/service-client.ts`, `types/instructions.ts` (no change; `path?` is consumed, not redefined, and `idempotencyKey` belongs to program §6.3), `plugins/tests/instruction-entry-client.test.ts`, `plugins/tests/helpers/instruction-carrier-classification.test.ts` (new), `plugins/tests/helpers/instruction-indexer.test.ts`, `plugins/tests/helpers/service-client.test.ts`.
- **Change:** move `formatInstruction` and `buildSteeringMessage` from `instructions-loader.ts:31-56` into `instruction-payload.ts` unchanged (program D19) and add the key builders there; add `InstructionValue`, `EntryFailureReason`, `EntryResult.reason?: EntryFailureReason`, `EntryResult.cause?: unknown`, `instructionEntryKey`, `instructionReferenceKey`, `instructionDescriptionKey`, `instructionSlugFor`, `instructionSlugFromKey`, `stripApiPrefix`; widen `writeEntry`/`isEntryValueCurrent` to `InstructionValue` with field-wise comparison; give `writeEntry` and `removeEntry` the trailing `snapshot?` and `directory?` parameters and give `listEntries` and `findEntry` the trailing `directory?` only (D-04); move the size pre-check inside `try` and return `reason: 'oversize'`; add `indexedPaths` and `allPaths` to `createIndex`; add the trailing optional `directory` to `getClient`, send `x-opencode-directory` only when it is supplied, and include the directory in the client cache key (program §6.1:468); create `helpers/instruction-carrier.ts` with `EntryFailureReason`, `InstructionCarrierUnavailableError`, `classifyEntryFailure` and `toCarrierError` per the D-06 table.
- **Tests:** `writes an object value once and reports unchanged on an identical re-put`; `re-puts when only priority changes`; `returns oversize in the result without putting or throwing`; `one list backs N writes`; `finds an entry returned with either key spelling`; `lists an entry returned with the api/ prefix`; `strips the api/ prefix before put and remove`; `keeps workflow.ts string values comparing by identity`; `indexedPaths lists each instruction file once`; `allPaths keeps a global instruction file`; `an instruction without a path takes the slug of its description`; `slug repairs a leading character`; `two identities that collapse to one slug both take the hash suffix`; `sends x-opencode-directory when a directory is supplied`; `sends no directory header without a directory`; `the client cache separates two directories`; `classifies every entry failure to exactly one reason` (one case per D-06 row, including `method-absent` and `discovery`); `wraps rows 1-5 and 8 in the carrier error and leaves rows 6, 7 and 9 out of it`; `the local oversize pre-check never enters the classifier`.
- **Acceptance:** `just opencode::typecheck` and `just opencode::lint` clean; `instruction-entry-client.test.ts` and `instruction-carrier-classification.test.ts` green; `workflow.test.ts` green without edits; the snapshot test records one `listEntries` call for N writes; no `context.session.instructions` under `plugins/`.
- **Rollback:** revert the commit; no entry is written by this phase, so no server state to undo.

### Δ2 — Native publish path, budget, flag and ledger (program §6.2)

- **Files:** `helpers/instruction-carrier.ts` (extend with `LoaderOutcome`, `resolveInjectionCarrier`, `publishInstructionSet`, `PublishResult`, ledger), `helpers/instruction-context-helper.ts`, `instructions-loader.ts`, `plugins/tests/helpers/instruction-carrier.test.ts` (new), `plugins/tests/instructions-loader.test.ts`, `plugins/tests/helpers/instruction-context-helper.test.ts`.
- **Change:** add `resolveInjectionCarrier(process.env, agent)` (D-02) at the top of `execute.before` and log its result as `carrier=<native|synthetic> agent=<agent>`; native arm resolves instructions as today (`:84-91` untouched), returns on zero matches, then lists once, applies D-11 keys, D-10 budget, D-04 value and calls `publishInstructionSet` (D-14) with `context.location.directory`. Pass `indexedPaths` as the union of every helper's `indexedPaths` and `allPaths` plus the current agent's (program §6.2:485). `InstructionContextHelper` carries and exposes both arrays, copied from the indexer result in `resolveInstructions` (program §6.2:487). Delete the native path's token read and `session.prompt`/stash (`:114-115`, `:117-121`) — those lines stay in the synthetic arm. An oversize file's superseded full-body key goes in `removals` (D-10, D-14), so the carrier removes it after the `instr-ref-` write. Wrap per D-07. Pin `plugins/tests/instructions-loader.test.ts:87-151` to `synthetic`.
- **Tests:** `publishes one instr- entry per matching file and sends no prompt`; `the loader passes the environment value and the agent name to the carrier module and runs the carrier it selects`; `unset INSTRUCTION_INJECTION resolves to native`; `an unknown flag value resolves to native and warns once`; `names a second distinct unknown value once`; `the carrier log line names the selected carrier and the agent`; `synthetic mode still sends the steering prompt`; `publishes a path-less instruction under the description key`; `skips a path-less instruction with no description and warns`; `a second touch with the same file performs no second put`; `a rejecting publisher leaves the hook successful`; `a client without the entry method falls back`; `an unclassifiable failure skips the turn without a fallback`; `a row-9 failure after the first write is degraded, not skipped`; `assigns one loader outcome per touch`; `a zero-match touch writes nothing, lists nothing and sends no prompt`; `publishes an entry whose source equals the instruction path`; `a description-only entry carries the raw description as source`; `counts only bare instr- keys toward the full-body budget`; `six matching files produce five full bodies and one reference`; `a file holding a full entry keeps it when the budget is full`; `an oversize file is written as a reference and its full key is swept`; `records unpublished identities and republishes them at the next touch`; `the unpublished ledger evicts the oldest identity at the cap`; `drops a single ledger entry larger than the cap and warns once`; `an emptied ledger removes the storage key`; plus the six legacy cases, now explicitly synthetic.
- **Acceptance:** the six legacy cases pass unmodified apart from the env pin; a native touch produces exactly one `put` and zero `session.prompt`; the hook's effect resolves when the publisher rejects; the entry request carries `x-opencode-directory`; the oversize case asserts one `instr-ref-` write, one `remove` of the prior full key passed in `removals`, and no second list.
- **Rollback:** set `INSTRUCTION_INJECTION=synthetic` for the session; no code revert needed. Entries persist and are re-used by D-08 seeding.

### Δ3 — Fallback seeding, sweep and freshness (program §6.2/§6.4, §5.6)

- **Files:** `helpers/instruction-carrier.ts`, `instructions-loader.ts`, `plugins/tests/helpers/instruction-carrier.test.ts`, `plugins/tests/instructions-loader.test.ts`.
- **Change:** implement D-08 seeding from `value.source`, D-09's sweep over the `indexedPaths ∪ allPaths` live set with the freshness rebuild of `join(context.location.directory, '.opencode/instructions')`, and the D-09 both-keys tie-break; the sweep hands its index-derived dead keys to Δ2's `publishInstructionSet` as `removals` (D-14). No separate demotion rule lands here: the oversize full→ref remove is Δ2's (D-10), and this phase only projects dead keys. Delete the `FULL_SLOT_BUDGET` count. No outcome row is added: `LoaderOutcome` and its assignment are Δ2's (D-13).
- **Tests:** `falls back and seeds exclusions from listed entries`; `seedExclusions suppresses entries already listed`; `seeds the instruction identity from value.source`; `a legacy string-valued entry seeds the slug's identity`; `a failed seeding list seeds nothing and logs once`; `a fallback issues no remove`; `switching modes deletes no entry`; `a deleted source file is swept on the next touch`; `rebuilds the helper when an instruction file is deleted`; `keeps a key whose file is in allPaths but not indexedPaths`; `when both keys exist for an untouched identity the full-body key stays live`; `a zero-match touch removes no entry`; `a foreign instr-task-skills- key is never removed`.
- **Acceptance:** the sweep test asserts a `remove` for the deleted file and none for the foreign key; the both-keys case asserts the full-body key survives and the reference key is removed; the seeding cases assert zero `remove`; the native path reads and writes no `idempotency/` or `instruction_load:` key (Δ2 removed the token read), and program §6.3's `idempotencyKey` removal is checked by that phase, not here.
- **Rollback:** revert the commit and set `INSTRUCTION_INJECTION=synthetic`; seeded tokens are recomputed on the next touch, and no entry is deleted by the revert.

### Δ4 — Observability, switch safety and the type guard (program §6.4/§7.4)

- **Files:** `plugins/tests/instructions-loader.test.ts`, `plugins/tests/helpers/instruction-carrier.test.ts`.
- **Change:** run the D-12 probe as a delegated live check (`.opencode/instructions/live-verification.instructions.md`) — no test file is created and nothing is collected; add `loader outcomes and entry statuses do not overlap` to `plugins/tests/helpers/instruction-carrier.test.ts`, which hosts it because that module declares `LoaderOutcome` (Δ2) and imports `EntryStatus` (Δ1) — the guard is type-level, so `just opencode::typecheck` fails when the unions overlap even though the case body is an empty `expect`; assert the seeding direction in both switch orders; add the amended §6.4 payload-shape case (`value.text` equals the block); record in the plugin header that native delivery is one turn deferred.
- **Path rule:** test collection covers `plugins/**` only. `.opencode/tsconfig.json` includes `plugins/**/*.ts` and `plugins/tests/**/*.ts` (`:29-33`), and vitest collects the same directory with `plugins/tests/**` as the coverage exclusion (`vitest.config.ts:22,35-39`). A file under `.opencode/tests/` typechecks nowhere and runs nowhere, so every path in this plan stays under `plugins/`.
- **Tests:** `removal is visible in the entry list`; `loader outcomes and entry statuses do not overlap`; `native to synthetic keeps the entry list intact`; `synthetic to native duplicates a block at most once and deletes nothing`; `an entry value's text equals the steering block for that file`.
- **Acceptance:** no test asserts a rendered `<context key>` string; the type guard fails to compile if the unions overlap; the payload-shape case asserts the block against `value.text`, never against the serialised object.
- **Rollback:** remove the dedicated probe key; the sweep owns it.

**Amendment 2026-10-22 — the D-12 probe is a delegated live check.** No probe test file exists in this delta and nothing is collected; the earlier acceptance line that required a gated probe case is replaced by the delegated run. Rules, execution and reporting: `.opencode/instructions/live-verification.instructions.md`.

**Program D7 and §6.6, stated once:** the default flip (unset → `native`) is a deviation from program D7's staged default and requires program-maintainer approval before **Δ2** implements it; ADR-011:151 and :162 require verification first, which this delta cannot supply. Δ2 owns the code, the program maintainer owns the approval, and §6.5 records the change rather than flipping it (§7 row D7). The synthetic arm is removed by **program §6.6 (Phase 6)** only; no phase in this delta deletes it, and §8.3's gates remain the precondition.

## 7. Cross-reference and conflicts with program decisions

| Program | Status | Resolution and owner |
|---|---|---|
| D2 | **amend** | Value stays an object (`{text,source,priority}`), not a string. `text` carries the byte-exact block, so R-87's byte-for-byte check runs against `value.text`; the rendered `<context>` block is `JSON.stringify(value, null, 2)`, so the check is narrowed, not preserved verbatim. `source` is the §5 identity, which D-08 seeding needs. Owner: Δ1 (client signature), Δ2 (caller). |
| §6.4 payload case (509-510) | **amend** | The program asserts "each entry value equals the `buildSteeringMessage` output for that file byte for byte" (509). With an object value that fails by construction. The case becomes: `value.text` equals the block for that file, and `source` and `priority` are asserted separately. Owner: Δ4 (case), Δ2 (value). |
| D3 | **adopt** | The five-full-body budget is counted from the session's entry list; a file already holding a full entry keeps its role and is not re-budgeted; an oversize file degrades to `instr-ref-`. "New" is defined in D-10 as an identity with no full-body key in the snapshot. Owner: Δ2 (budget and count). |
| D5 | **adopt** | `x-opencode-directory` is sent on every loader entry request: `getClient(dependencies?, directory?)` adds the header only when a directory is supplied, and the loader passes `context.location.directory` (program D5:770, §6.1:468). Owner: Δ1 (client), Δ2 (caller). |
| D17 | **adopt** | One entry per instruction identity, each carrying that file's whole steering block (program D17, `migration-plan.md:782`). ADR-011:157-158 carries the whole steering block in one `putInstruction` value; §8's Granularity row records the departure and its reason. Owner: Δ2 (publish), Δ3 (sweep). |
| D7 | **amend, approval-gated** | Unset → `native` is implemented in Δ2, ahead of program D7's Phase 5 staging. ADR-011:151 and :162 require verification before the default; this delta has none, so the flip needs program-maintainer approval and program §6.5 records the default change of `resolveInjectionCarrier(env, agent)`, with no rename and no second selector. The carrier cases live in `plugins/tests/helpers/instruction-carrier.test.ts`, created in Δ2. The delta departs from §5.6:375 on one point beyond the default: an unknown `INSTRUCTION_INJECTION` value resolves to `native` rather than to the current default, which is `synthetic` through the program's Phase 4, so a typo cannot downgrade delivery; the warning latch itself follows §5.6:375 and names each distinct value once per process. The rollback is `INSTRUCTION_INJECTION=synthetic` (program D6). Owner: program maintainer (approval), Δ2 (implementation and carrier cases). |
| D19 | **adopt** | `helpers/instruction-payload.ts` is created in Δ1 with byte-identical output; no signature change. Owner: Δ1. |
| D20 | **amend** | Key builders take `{path?, description?}` as decided, and the path-less case uses a **new** `instr-desc-` family so the sweep can scope it. Owner: Δ1. |
| D24 | **adopt** | Probe via the model's reply and list-based removal. No rendered-context assertion. Owner: Δ4. |
| D25 | **amend** | Bare key is canonical, and normalization also applies on write/remove. The both-spellings case is program D25's Phase 1 unit case (`migration-plan.md:790`), so Δ1 adopts it unchanged; Phase 4 only records the key form the server returns. Owner: Δ1 (case), Δ4 (measurement). |
| D26 | **amend** | The program's catch-all is adopted unchanged: an unclassifiable error is logged once, skips the turn and does not fall back. The delta adds `method-absent` (program §5.6:383) and `discovery` (`service-client.ts:203-205`) as reasons so a missing method or service still falls back; `UnexpectedStatus` stays `transport`, and `message` is never parsed. Owner: Δ1 (mapping), Δ2 (action). |
| D27 | **amend, blocked on program Phase 1** | Program D27 accepts exactly three prefixes: `instr-`, `instr-ref-`, `instr-task-skills-` (792). The loader's fourth family `instr-desc-` must be accepted or rollback leaves those keys behind, so the accepted set becomes four, and `--prefix instr-` must not match `instr-ref-`, `instr-desc-` or `instr-task-skills-`. The tool that carries this, `scripts/instruction-entries.ts`, is not in the tree; it is a program Phase 1 deliverable. Owner: program (Phase 1 tool), not this delta. **Dependency:** until that tool ships, no prefix-scoped removal of `instr-desc-` keys exists — see §9 and §10. |

Conflict to flag for the program owner: R-74 publishes an oversize file as a reference entry, while `plugins/workflow.ts:173-176` skips publication entirely when `entryBytes > MAX_ENTRY_VALUE_BYTES`. The loader follows R-74; the workflow site's divergence is left to §6.6 and is not changed here.

## 8. Deviations from ADR-011

| Topic | ADR-011 / program says | This plan | Label and justification |
|---|---|---|---|
| Key pattern | Slash-free `^[a-z0-9][a-z0-9._-]*$` (ADR-011:40) | Same pattern, enforced client-side, plus `0`-prefix repair for a bad leading char | Alignment + small deviation: the pattern is not in `schema/dist/instruction-entry.d.ts` (it declares `Schema.String`); the regex lives in the `.js`. A local test pins our keys against the regex. |
| Slug mapping | ADR-011:157-158 takes the basename, lowercases, maps every character outside `[a-z0-9]` to `-` | `instructionSlugFor` strips the `.opencode/instructions/` prefix and `.instructions.md` suffix, keeps `.`, `_` and `-`, and suffixes a hash on collision | Deviation: a nested file yields `dir-file`, and two files differing only by punctuation stay distinct. Program §6.1's builders take `{path?, description?}`. |
| Unknown flag value | ADR-011:151 defines only `native` and `synthetic`; program §5.6:375 resolves any other value to the current default and warns once per distinct value per process | Unknown → `native` + one warning per distinct value per process; never `synthetic` | Deviation from the program: a typo must not downgrade delivery, and the current default is `synthetic` until Phase 5. The warning latch follows §5.6:375. |
| Object value shape | `{text, source, priority}`; object values render as pretty-printed JSON | Kept, against program D2's string value | Deviation **from the program plan**, alignment with ADR: `source` is required by seeding and sweeping. R-87 is narrowed to `value.text`; §6.4's case is amended in §7. |
| Value priority | `priority: 1` appears in the `put` example; the runtime treats the value as opaque JSON | `0` full body, `1` reference, `2` task skills | Deviation: ADR-011 names only `1`. Because the runtime does not interpret the field (open question 2), the plan uses it as its own family discriminator for the budget and the sweep. |
| Directory header | ADR-011:182 verifies that directory-scoped requests need `x-opencode-directory`; the route family is described at ADR-011:38; program D5 extends the header to every loader entry request | Sent on every loader entry request via `getClient(directory)` | Adopted from program D5, not a deviation: `getClient` builds `OpenCode.make` with a `headers` object (`service-client.ts:244-256`), and `context.location.directory` supplies the value. |
| Granularity | ADR-011:157-158 carries the whole steering block in one `putInstruction` value | One entry per instruction identity, each with its own `instr-` key and its own `text` | Deviation adopted from program D17 (`migration-plan.md:782`): the per-entry 256 KiB cap and the per-file diff and removal both need one key per file. |
| Read normalization | `api/instr-*` asserted verbatim | `api/` stripped on read and write; bare is canonical | Deviation: the assertion in ADR-011 migration step 5 is unobservable and the repo's own read-back (`instruction-entry-client.ts:34`) compares raw keys. |
| Single key family | One `instr-<basename>` family | Four prefix-scoped families | Deviation: program D27 already needs `instr-ref-` and `instr-task-skills-`; a fourth (`instr-desc-`) makes the path-less case sweepable. Foreign-family exclusion is impossible with one family. |
| Module and export names | ADR-011 migration step 1 names `helpers/instruction-entry.ts` exporting `putInstruction`, `removeInstruction` and `listInstructions` | `helpers/instruction-entry-client.ts` plus `helpers/instruction-carrier.ts`, exporting `writeEntry`, `removeEntry`, `listEntries`, `publishInstructionSet` and `resolveInjectionCarrier` | Deviation from the ADR, adopting program D11 (`migration-plan.md:776`): the repository already owns `instruction-entry-client.ts`, so the ADR's file and export names would create a second transport home. |
| Description-only source | Not specified | `source` is the raw `description` string, with no prefix or synthesized label | Deviation: `source` must equal the identity D-08 seeds, so a description-only entry compares equal to the synthetic arm's token identity instead of carrying a `description:` marker. |

## 9. Risks

- **Native default before the live evidence.** Mitigation: the §7 D7 row gates the flip on program-maintainer approval; `INSTRUCTION_INJECTION=synthetic` restores the old carrier for the session.
- **One duplicate across the synthetic → native switch.** Mitigation: the switch is one-way within a process, the duplicate is bounded to one entry per block, and the mode-switch test asserts no deletion; the synthetic → native direction is not claimed to dedupe.
- **Wrong directory header.** A request carrying a directory outside the session's scope answers `SessionNotFoundError` (D-06 row 5), which falls back without deleting anything; the loader always passes `context.location.directory`, and the delegated live check asserts the header value.
- **Double delivery during a fallback.** Mitigation: D-08 seeds from `value.source`, which is the same identity the synthetic arm reads at `:99`; a mode switch is tested in both directions; the native arm is the only path that writes while the flag is `native`.
- **Server key validation differs from the `.d.ts`.** Mitigation: local pattern test plus Δ4 recording the key form the server actually returns; a rejection surfaces as `unknown`, logs once and skips the turn (program D26), so the failure never becomes a second delivery channel.
- **Non-atomic put.** Mitigation: one writer per family; per-identity keys; lost updates limited to same-key re-renders.
- **Stale index hides a deletion.** Mitigation: D-09's `allPaths` comparison rebuilds the helper once per divergent touch.
- **A description-only entry is never swept.** `instr-desc-` keys are not index-derived, so D-09 never removes one: an instruction that stops matching keeps its key for the session. Mitigation is **blocked**: the only removal path is `--prefix instr-desc-` on `scripts/instruction-entries.ts`, which is absent from the tree and owed by program Phase 1 (§7 D27). Until it ships, the bound is one small key per description, rewritten in place; record the gap rather than claiming a remedy.
- **Prefix churn.** Mitigation: `instr-desc-` and `instr-ref-` are separate families, so a budget demotion writes a new key and the old one is swept in the same touch.
- **Ledger grows without bound.** Mitigation: D-14 caps it at 16 entries / 96 KiB with oldest-first eviction and drops an entry the ledger cannot hold; the republish pass deletes every entry it lands.
- **The probe is model-dependent.** Mitigation: it is a delegated live check and gates nothing in this delta.

## 10. Open questions

1. Does the server return keys with or without `api/` from `list`? Δ4 records the answer; D-03 works either way.
2. Does the server accept `priority` as any JSON number, or is the value opaque? If opaque, `priority` is ours alone and the budget can only count what we wrote — acceptable, but worth confirming.
3. Is the 256 KiB limit applied to the serialised value or per field? The client mirrors it as `JSON.stringify` bytes (`instruction-entry-client.ts:10-12`); if the server counts differently, the reference demotion may trigger earlier than needed.
4. Can `list` paginate or truncate on long sessions? Nothing in the installed declaration says so; D-09's sweep assumes a complete list and must stop sweeping if a truncation marker ever appears.
5. Should the sweep run for agents no longer active? It currently unions every materialised helper; a per-agent sweep would be tighter but would delete entries a returning agent still needs.
6. Does the task-skills site's request carry the child's directory? Program D5 says it passes `context.directory`; this delta does not touch that site, so the question is for §6.6.
7. Is `instr-desc-` worth a fourth family, or should a path-less instruction be skipped outright? Chosen: keep it, because skipping silently drops guidance that the synthetic path delivers today.
8. When does `scripts/instruction-entries.ts` land? The removal remedy for `instr-desc-` keys (§7 D27, §9) depends on a program Phase 1 file that does not exist, so no phase of this delta can verify it.
9. Does a republished ledger entry, written one turn late, arrive before or after the current turn's entries in render order? Nothing in ADR-011 fixes intra-entry order (open question 4 there), so the ledger's ordering claim is limited to "published, not ordered".

## 11. Out of scope

- Migrating `helpers/workflow-subtask.ts` (program §6.6), removing the synthetic branch (program §6.6), and closing the §8.3 removal gates.
- Any change to `plugins/workflow.ts`'s `WORKFLOW_ENTRY_KEY` payload, to `service-client.ts` discovery, or to the instruction indexer's glob matching.
- Any change to `mcp/`, `agents/`, `cli/`, or the Serena memory store.
- Operator tooling (`scripts/`), except the `instr-desc-` prefix amendment in §7, which is blocked on program Phase 1.
- The task-skills site's directory header, which program D5 already assigns to that site.

## 12. Verification entry points (by name only)

`just opencode::test`, `just opencode::typecheck`, `just opencode::lint`; `plugins/tests/instructions-loader.test.ts`, `plugins/tests/instruction-entry-client.test.ts`, `plugins/tests/helpers/instruction-carrier-classification.test.ts` (created in Δ1), `plugins/tests/helpers/instruction-carrier.test.ts` (created in Δ2), `plugins/tests/helpers/instruction-indexer.test.ts`, `plugins/tests/helpers/instruction-context-helper.test.ts`, `plugins/tests/helpers/service-client.test.ts`, `plugins/tests/workflow.test.ts`.

Memory anchors: `architecture/adr/ADR-011-native-session-scoped-instruction-entries`, `architecture/adr/ADR-011-implementation-plan`, `architecture/adr/ADR-010-workflow-tool-instruction-injection`, `skills/general/instruction-loading-mechanics`.

Every unit-test path above is collected by `.opencode/tsconfig.json` (`plugins/**`) and `.opencode/vitest.config.ts` (`plugins/tests/**`); no test file in this plan lives outside `plugins/`. Live verification: delegated live check, no test file (`.opencode/instructions/live-verification.instructions.md`).
