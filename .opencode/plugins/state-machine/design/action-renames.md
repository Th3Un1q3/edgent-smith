> **Historical design record, superseded 2026-11-26** by `mem:opencode/state-machine-contract` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# Action renames, skill-callback removal, per-memory idempotency

Nothing here is applied: no code, `machine.json`, `mem:opencode/state-machine-contract`, `signals-contract.md` or test was edited.

Sources read whole: `machines/session/definitions.ts` (600 lines), `machines/session/machine.json` (569),
`core/memory.ts` (80), `machines/session/context.ts` (272). Partial: `state-machine.ts:90-309`,
`core/machine.ts:160-173,932-940`, plus the four test files named below. Counts are `grep -rn` over
`.opencode/plugins/{state-machine,state-machine.ts,tests}` on 2026-11-22, excluding `node_modules`.

## 1. Rename set

### Action-id strings

| id | refs | `definitions.ts` | `machine.json` | `mem:opencode/state-machine-contract` | `tests/state-machine.test.ts` |
|---|---|---|---|---|---|
| `request_shell` → `run_shell` | 5 | 3 (115, 149, 509) | 1 (209) | 1 (99) | 0 |
| `request_skill` → `activate_skill` | 9 | 4 (117, 151, 491 comment, 519) | 1 (167) | 3 (61, 100, 112) | 1 (753) |
| `request_memories` → `recall_memories` | 6 | 3 (118, 152, 524) | 1 (92) | 1 (101) | 1 (740) |
| total | 20 | 10 | 3 | 5 | 2 |

Each `definitions.ts` id occupies three sites: an `ActionSpec` arm, an `ACTION_TYPES` entry, a body key.
`request_skill` adds a fourth, the `SkillArguments` doc comment at 491 ("The part of the collect-actions argument
`request_skill` reads"). A stale name in prose is still a rename site.

`mem:opencode/state-machine-contract` sites: sections 3 and 5.

Two more files carry the old ids and are not part of the rename. `REFACTOR-PROPOSAL.md` has 9 (3 each) and
describes 13 action ids, `fail` and `clear_tools_policy` included, so it is a superseded run: delete it or mark it
historical in the same PR rather than re-edit it. `.tmp/state-machine/design.md` and `.tmp/machine.head.ts` are
scratch copies outside the plugin tree.

### Parameter type names: rename, 9 occurrences, one file

`ShellParameters` (58, 115, 509), `SkillParameters` (67, 117, 519) and `MemoriesParameters` (71, 118, 524) become
`RunShellParameters`, `ActivateSkillParameters` and `RecallMemoriesParameters`. Only `definitions.ts` names them and
no JSON references a type, so the rename keeps one vocabulary between the `type` string and the interface that
types its params at a cost of three lines. `MarkSkillParameters` is deleted with its action (§2), not renamed.

### Emit kinds: unchanged

`emit.shell`, `emit.skill` and `emit.memories` keep their names. They are the plugin boundary's vocabulary
(`core/machine.ts:145-173`, consumed at `state-machine.ts:243-265`), not action ids.

`request_dispatch` keeps its name even though it now sits beside `run_shell`; renaming it is a separate decision
(§5 fork 1). `prompt`, `record`, `update_signals_policy`, `record_callback`, `set_tools_policy` and
`admit_identity` are untouched.

Rename ids and the three param interfaces in one sweep, `definitions.ts` first. Rejected: cascading the rename
into the emit kinds, which buys vocabulary symmetry by touching `core/machine.ts`, `state-machine.ts` and three
test files for no behaviour change.

## 2. What the skill callback is today

The chain, observed:

1. `work` entry runs `request_skill { name: 'task-delegation' }` (`machine.json:166-171`).
2. `definitions.ts:519-523` returns early when `context.injectedSkills` already holds `skillKey(name)`, else emits
   `{ type: 'emit.skill', name, reportTo: 'skill_ready' }`.
3. `state-machine.ts:248-256` calls `injectSkill` (`context.session.prompt({ skills: [{ id }] })`), then
   `settle(sessionId, 'skill_ready', { ok })`, which dispatches the event `callback.skill_ready`.
4. `machine.json:177-192`, `work.on["callback.skill_ready"]`, is an action-only arm with no `target`. It runs
   `record_callback { reportTo: 'skill_ready' }`, which stores `results.skill_ready` and, on `ok: false`, writes
   `failure: { reason: 'skill_ready failed' }`; then `mark_skill { name }`, which appends
   `skill:<name>:complete` to `injectedSkills`.
5. `CALLBACK_NAMES` in `context.ts:115` declares `'skill_ready'`, and `SkillEmit.reportTo` is required
   (`core/machine.ts:163-167`).

### What disappears, site by site

| Site | Change |
|---|---|
| `machine.json` `work.on["callback.skill_ready"]` | delete the arm; it is the only consumer |
| `machine.json` `work.entry` `request_skill` | rename; write the marker on itself |
| `definitions.ts` `request_skill` body | `enqueue.assign({ injectedSkills })` when absent, then `enqueue.emit({ type: 'emit.skill', name })` with no `reportTo` |
| `definitions.ts` `mark_skill` and `MarkSkillParameters` (94-96, 121, 536-540) | delete; no caller remains |
| `definitions.ts` `SkillArguments` (491-499) | `enqueue.emit` no longer takes `reportTo` |
| `core/machine.ts` `SkillEmit` (163-167) | drop `reportTo` |
| `state-machine.ts` `emit.skill` case (248-256) | `injectSkill(...).pipe(Effect.ignore)`, no `settle` |
| `context.ts` `CALLBACK_NAMES` (115) | drop `'skill_ready'` |
| `mem:opencode/state-machine-contract` sections 3 and 5 | prose: activation is fire-and-forget, `injectedSkills` written at request time |
| `tests/state-machine.test.ts:183` | still passes, the port spy records the injection; 502 must assert the marker without `machine.callback('ses_1', 'skill_ready', ...)` |
| `tests/state-machine/persistence.test.ts:253-263` | "records a failed skill injection as an outcome" loses its subject; replace it with an assertion that activation failure writes no `results`, or delete it |
| `tests/helpers/state-machine/harness.ts` | `failSkillInjection` has no observable outcome left; keep it only if repurposed to assert a log line |

### Consequences

Activation becomes fire-and-forget. A failed `injectSkill` no longer reaches `results` and no longer sets
`failure`; it is invisible unless the plugin logs it. That is the behaviour loss the user must accept, or the
design adds one warn line in the `emit.skill` case.

No transition is lost. The arm had no `target`, so the state stays `work` either way, and `machine.callback` on an
unknown entry returns `[]` (`core/machine.ts:938-939`), so a stray event is inert rather than an error.

Nothing depends on a state it never enters, but something depends on a field it never gets. `mark_skill` is the
only writer of `injectedSkills`. Delete the arm and leave the marker where it is, and the absence check at 520 is
always false, so the skill is re-injected on every `work` entry
(`CLAIM_WORK → check → validate → memorize → work`). Moving the assign into the action is mandatory, and it also
removes `mark_skill` and its type (11 action ids become 10). Assign before emit, so a re-entry between emit and
callback cannot emit twice.

Unverified: whether assembly rejects a `reportTo` that `CALLBACK_NAMES` no longer declares. The design removes the
field instead of depending on the answer.

Delete the arm and `mark_skill`, write the marker at request time, accept a silent injection failure plus one warn
log. Rejected: keeping `record_callback` and dropping only `mark_skill`, which preserves an outcome nobody reads
while still re-injecting the skill forever.

## 3. Per-memory idempotency tokens

### Today

`memoryKey(path, kind)` mints `mem:<path>:<kind>` (`core/memory.ts:26`) and `skillKey(name)` mints
`skill:<name>:complete` (24); `isMemoryKey` (28-29) classifies both. The memory form is keyed by namespace, not by
memory: the only production call passes a namespace, `memoryKey(namespace, 'ref')` in an error message
(`state-machine.ts:122`). `parseMemory` splits a file into `index` (`##`-prefixed headings) and `full` (`-`-prefixed bullets)
(`core/memory.ts:45-57`).

Nothing checks those tokens. `memoryKey` and `isMemoryKey` have no production reader beyond that message; the only
other references are `tests/state-machine/memory.test.ts:26-34`. Recall is unconditional: `recall_memories` emits
`emit.memories` on every `define_goal` entry (`machine.json:91-96`), the port reads the file, and
`record_callback { key: 'preferences/user' }` overwrites `context.injected[namespace]`. Today's dedup is a
namespace-level overwrite, and the `:complete`/`:ref` tokens are vestigial. The skill path is the working
analogue: `skill:<name>:complete` is written by `mark_skill` and read by the `request_skill` body.

### Specification

A memory's identity is its text: `memoryToken(namespace, text)` returns
`'mem:' + namespace + '#' + sha1(text).slice(0, 8) + ':complete'`. Text beats an ordinal because inserting a bullet
does not shift every later token, and editing a bullet re-delivers it, which is what you want. Headings are not
memories; `index` passes through unfiltered.

Literal example: `mem:preferences/user#3f9a1c2b:complete`.

Storage is `context.memoryTokens: string[]` in `machines/session/context.ts`, added to `freshContext`,
`restoreContext`, `readStored`, the `SnapshotField` union and `COPIERS` (rule 7: an unlisted field vanishes on
reload). Cap it at `MEMORY_TOKEN_LIMIT = 200`, dropping oldest first.

Lifetime is the session, persisted in the snapshot. It does not reset on a new goal, on `system_user_input`
(`parked` or `panic` back to `define_goal`), or on `panic` to `work`. That matches `injectedSkills`, which a test
already pins across a user reset (`tests/state-machine/user-reset.test.ts:152`); it clears only when the snapshot
does.

Invariant: a token and the content it gates clear together or not at all. `injected[namespace]` is merged (union,
dedup by token) and never replaced by an empty filtered result. Otherwise a fully deduped recall empties
`injected['preferences/user']` and `work_towards_goal` renders `Preferences: none` for a session that has
preferences.

Checking happens at the port, because only the port sees the file:

1. `recall_memories` becomes `enqueueActions` and emits
   `{ type: 'emit.memories', namespace, known: context.memoryTokens.filter(t => t.startsWith('mem:' + namespace + '#')) }`.
2. `loadMemories` parses, partitions `full` into delivered and already-known by hash, and returns
   `{ value: { full: delivered, index }, tokens: deliveredTokens }`. Tokens are minted only for delivered entries.
3. `CallbackPayload` gains `tokens?: readonly string[]`; `record_callback` with a `key` unions `payload.tokens`
   into `memoryTokens` and merges `value.full` into `injected[key]`.
4. `memoryKey` and `isMemoryKey` are deleted, replaced by `memoryToken` and `isMemoryToken`.

Ten memories with three already recalled: `full` holds ten bullets, three of them tokenised. Recall returns seven
and mints three tokens, and the prompt still shows all ten, three from the merged `injected` and seven new. The
next recall of the same file returns nothing and mints nothing. Edit bullet four and exactly that one
re-delivers.

Content-hash tokens per bullet, in the snapshot, with a merged `injected`. Rejected: a namespace-level skip ("any
token for this namespace, so do not emit"), which cannot express partial recall and ages into a stale preferences
block.

## 4. Wire format and migration

One consumer-visible change, from the callback removal. The renames change no wire format.

Action ids are machine-definition data: `machine.json` is read by the assembler, and an id outside `ACTION_TYPES`
has no body (`createActions` is typed `Record<ActionType, unknown>`). No host event or tool payload carries
`request_*`, so renaming is not a wire change, though it is a breaking change for two repo consumers,
`mem:opencode/state-machine-contract` and the two test lines.

Removed strings, exactly: the event `callback.skill_ready`, the registry entry `'skill_ready'` in `CALLBACK_NAMES`,
the result key `results.skill_ready`, the field `SkillEmit.reportTo`, the id `mark_skill` and the type
`MarkSkillParameters`. Added strings: `known` on `emit.memories`, `tokens` on the callback payload, the snapshot
field `memoryTokens`, and the `mem:<namespace>#<hash8>:complete` shape.

Snapshot compatibility: the restore path reads `memoryTokens` only when `isStringArray` passes, so a snapshot
written before the change restores with `[]` and every memory re-delivers once. Additive, no migration.

The change is atomic per action id. `definitions.ts` and `machine.json` must land in the same commit, because a
JSON arm naming an id with no body is an unresolved action and the tests read the same pair. Three sequential
commits, one id each, are safe; "defs now, JSON later" is not.

Sequence, each green on its own:

1. `run_shell`, `activate_skill`, `recall_memories`, the three param interfaces, `mem:opencode/state-machine-contract`, the two test lines.
2. Skill callback removal: the `machine.json` arm, the marker write in `activate_skill`, deleting `mark_skill`,
   `SkillEmit.reportTo`, `CALLBACK_NAMES`, the `state-machine.ts` emit case, the tests, `mem:opencode/state-machine-contract`.
3. Per-memory tokens: `core/memory.ts`, the `context.ts` field, the `recall_memories` params, the port filter,
   `CallbackPayload.tokens`, the `record_callback` merge, `mem:opencode/state-machine-contract`.

## 5. Forks for you

1. `request_dispatch`. After the rename it is the only `request_*` left, and by `REFACTOR-PROPOSAL.md` no arm
   reaches it (I did not re-check every arm). Rename it to `dispatch_agent`, fold it into `run_shell`, or leave it?
2. Silent skill-injection failure. Accept it, or add one `[state-machine]` warn line in the `emit.skill` case?
   Without either, a broken skill is undetectable.
3. Memory identity. Content hash (this design) or bullet ordinal? A hash re-delivers on edit, which is usually
   what you want; an ordinal does not.
4. Token reset. Never in-loop (this design, mirroring `injectedSkills`) or clear on a new goal, which re-reads
   preferences every goal and negates the tokens?

## 6. Facts not visible in the tree

- Whether the assembler validates `reportTo` against `CALLBACK_NAMES`. `machines/index.ts` was not read; the
  answer decides whether keeping `reportTo` is legal.
- Whether `request_dispatch` is truly unreachable. Inherited from `REFACTOR-PROPOSAL.md`, not re-checked.
- Live skill-injection behaviour. The unit suite runs against a fake host, and
  `live-verification.instructions.md` asks for a `rug` run for hook changes, which this stage does not perform.
