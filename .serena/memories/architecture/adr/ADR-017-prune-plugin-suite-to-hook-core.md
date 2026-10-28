---
id: ADR-017
title: Prune the workflow plugin subtree to its registered surface
status: accepted
date: 2026-10-23
scope: OpenCode workflow plugin subtree at .opencode/plugins — workflow.ts and the helpers only it reaches, plus the shared modules it must not disturb
---

# ADR-017: Prune the workflow plugin subtree to its registered surface

**Review basis (2026-10-25).** Three review lenses re-checked every figure and locator here against the tree: test inventory and locators (vitest run plus static it( sites), over-engineering and dead code (importers, call sites, duplicate contracts), and contract and typecheck seams (test imports, tool schemas, load behaviour). Where the earlier text disagreed, the reviewed value replaces it.

## Decision

The workflow plugin keeps its subtask trio registration, its per-session instruction entry write and both event subscriptions — session.created and session.agent.selected — and drops its unreachable second engine (835 lines) plus its own plumbing, split into B1 (no tool-contract change) and B2 (each changing a named tool input, output or load behaviour). The five rows reviewed on 2026-10-23 total 110 lines, B1 35 and B2 75; three rows added by the 2026-10-25 review add ~46, B1 ~20 and B2 ~26, for a prune of ~991 lines. The bar is: no new modules, no rewrites, no new behaviour tests; five test-file edits, each named in Order of change; every contract change is named and separable.

## User-ordered changes (2026-10-27)

Four orders added to `helpers/workflow-subtask.ts` (:214, :215, :507, :879) after the 2026-10-25 review. They amend the prune's work; the decision, the groups and the status stay as they are. Checked against the tree on 2026-10-27: `MAX_STEP_OUTPUT_CHARS = 4000` (workflow-types.ts:169) is the per-step cap the prune removes, `MAX_TAIL_ENTRY_CHARS = 12KB` (subtask-tail.ts:5) bounded the tail path on 2026-10-27 and, with its `truncated` flag, was removed on 2026-10-28 — see Truncation audit below, `MAX_ENVELOPE_BYTES = 8192` (workflow-types.ts:170) sizes the envelope trim the prune deletes, `createSemaphore` is defined at workflow-subtask.ts:33 and called once at :880, and docs/workflow-tool.md:344 documents `max_concurrent` as `1 to 8`, default 4.

| # | Order | Disposition and end state | Companions | Gate |
|---|---|---|---|---|
| 1 | Output truncation (:214) | Approved: `outputText` is the full `extractOutputText()`; `truncateOutput` (workflow-subtask.ts:213) and `MAX_STEP_OUTPUT_CHARS` (definition workflow-types.ts:169, import workflow-subtask.ts:11, call site :781) are deleted and the `truncated` flag is dropped from the subtask result: the 4000-char step cap goes, and on 2026-10-28 a user TODO removed the tail 12KB clip and its `truncated` flag too: entries store the full output and the orchestrator decides, so only the count (5), TTL (24 h) and 1,000-id caps remain. | workflow.ts (result :368, `subtask_run` description :257), subtask-tail.ts (its own length bound and flag, :33-40; both removed 2026-10-28), docs/workflow-tool.md, two tests (workflow-subtask.test.ts:16,414-425; workflow-subtask-structured.test.ts:4,289). | A code-mode consumer's own truncation is demonstrated before this lands. Nothing else bounds a direct result: `MAX_TAIL_ENTRY_CHARS` (12KB, subtask-tail.ts:5) clamped only the tail path and is gone, so bytes are bounded by count and TTL at the store, not by a byte ceiling. |
| 2 | Docs and instructions (:215) | Approved, but not docs-only: a four-file docs and instructions sweep. Actionable truncated-output guidance sits in docs/workflow-tool.md (cap row, "check `truncated`", field docs); .opencode/agents/rug.md (requires `truncated === false`, describes the marker, teaches the sentinel rule); .agents/skills/task-delegation/SKILL.md (`outputText` holds ~4000 chars); and .agents/skills/task-delegation/workflows/task-delegation-workflow.md (says ~8KB, naming the envelope cap). rug.md is user-owned, so this run leaves it to its owner; the workflows file's 8KB guidance refers to `MAX_ENVELOPE_BYTES` (workflow-types.ts:170), the envelope cap the prune removes, not a contradiction with 4000, and both guidance sets update; the "ask children for short answers" advice stays. | docs/workflow-tool.md, .opencode/agents/rug.md (owner edit), .agents/skills/task-delegation/SKILL.md, .agents/skills/task-delegation/workflows/task-delegation-workflow.md; lands with order 1. | All four files read back with no stale cap or marker guidance. |
| 3 | Child session titles (:507) | Approved (2026-10-28): V2 natively displays subtask statuses and running tasks, so the dynamic titles were a V1 display workaround and no replacement signal is required; removes `STATUS_MARKERS`, `childSessionTitle`, `TITLE_UPDATE_TIMEOUT_MS`, `settleWithin`, `updateChildSessionTitle`, its three call sites, and the write-only `running` map (init :884, set :929, delete :872). | docs/workflow-tool.md and the progress tests (workflow-subtask-progress.test.ts; 7 `it(` sites by grep). | Title path and `running` map removed; progress tests updated. |
| 4 | Concurrency (:879) | Superseded as written: `max_concurrent` 1-8 is already a documented workflow input threaded as `WorkflowContext.maxConcurrent` (workflow-types.ts:131, pinned to 1 at subtask-run.ts:24), and this ADR deletes workflow-runner.ts:333,:416, the only producer above 1. `createSemaphore` (:33, called :880) is dead after the prune. Disposition: delete the semaphore and its three tests (workflow-subtask.test.ts:109-145); do not add a harness key. | workflow-subtask.ts (semaphore plus its import), workflow-subtask.test.ts. | No producer above 1 survives the prune. |

**Interaction with the prune.** Orders 1 and 2 stack: together they remove the per-step 4000-char cap, the 8KB envelope trim behind the 8KB guidance, and the four files that describe them, while the 12KB tail clamp stayed until 2026-10-28, when a user TODO removed it with its flag, so they are one change and add no separate setup row to Order of change. Order 3 is independent of both and lands now: it removes a signal, not a bound, and V2 natively displays subtask statuses and running tasks, so removing the titles leaves no observability gap. Order 4 resolves by deletion rather than by a configuration key, because the prune already deletes the component that made concurrency above 1 reachable.

## Considerations

### Context

The plugin is nine files. Seven are reachable; two are orphans that only each other and four test files reach.

| File | Lines | Production importer |
|---|---|---|
| workflow.ts | 382 | none outside tests |
| workflow-subtask.ts | 1,025 | subtask-run.ts:1 |
| workflow-types.ts | 194 | subtask-ls.ts:2,3; subtask-run.ts:2,3; subtask-tail.ts:1; workflow-client-adapter.ts:23; workflow-subtask.ts:12,24 |
| subtask-ls.ts | 197 | workflow.ts:15,16 |
| subtask-tail.ts | 69 | workflow.ts:18 |
| workflow-client-adapter.ts | 100 | workflow.ts:19 |
| subtask-run.ts | 31 | workflow.ts:17 |
| workflow-runner.ts | 641 | none |
| workflow-script.ts | 194 | workflow-runner.ts:22 (dead) |
| **Total** | **2,833** | |

Sums: reachable 382+1,025+194+197+69+100+31 = 1,998; orphans 641+194 = 835; 1,998+835 = 2,833. Adding instruction-entry-client.ts (137), the one module shared with instructions-loader, gives the 2,135-line workflow-owned measure.

workflow-runner.ts is a second workflow engine: nothing in the plugin loads it, its only sibling is workflow-script.ts, and its only callers are four test files. The live plugin is over-built at the seams: 17 exports nothing imports, a fork-lineage scan that walks every session, a snapshot store nothing populates, a one-caller wrapper, and three cosmetic variants.

Scope: this ADR touches the workflow subtree only. goal-continuation.ts, tool-limit-reminder.ts, instructions-loader.ts, quality-gate-enforcer.ts and config/harness.config.ts are read, not changed; those internal mechanisms are out of scope.

### Decision table

Group A — delete, no behaviour change (DEAD):

| Area | Path:lines | Removed | Replacement |
|---|---|---|---|
| Second workflow engine | helpers/workflow-runner.ts:1-641 | 641 | nothing |
| Script sandbox | helpers/workflow-script.ts:1-194 | 194 | nothing |
| **Group A total** | 641+194 | **835** | |

Group B1 — shrink or inline, no tool-contract change:

| Area | Path:lines | Removed | Class | Replacement |
|---|---|---|---|---|
| One-caller wrapper | helpers/subtask-run.ts:1-31 | 31 | OVERENGINEERED | inline at workflow.ts:17; workflow-subtask-run.test.ts:3 imports @plugins/helpers/subtask-run directly, so that import is retargeted to the inline seam (one test edit); the inline imports createSubtask from workflow-subtask.ts:1,17, so its 1,025 lines stay reachable |
| Duplicate count clamp | helpers/subtask-tail.ts:23-25 | 3 | OVERENGINEERED | one clamp taking (max, default) from subtask-ls.ts:29-31 |
| TextEncoder byte count | workflow.ts:146 | 1 | OVERENGINEERED | Buffer.byteLength |
| Unused exports | workflow-subtask.ts:170; workflow-types.ts:9,56,184; subtask-ls.ts:5,6,8 | 0 | OVERENGINEERED | 17 export keywords dropped |
| Subtask contract restated three times | workflow.ts:219-244, 328-346 | ~20 | OVERENGINEERED, LOW | SubtaskParameters already fits; one schema, not three |
| **Group B1 total** | 31+3+1+0+20 | **55 (35 exact + ~20)** | | |

Group B2 — contract changes, independently approvable:

| Area | Path:lines | Removed | Class | Replacement | Change and user-visible effect |
|---|---|---|---|---|---|
| Fork-lineage scan | helpers/subtask-ls.ts:141-150, 152-160, 162-174, 184-186, 187-193 | 42 | OVERENGINEERED | children only: subtask-ls.ts:194 becomes children.map(sessionToEntry), and the dedupeByID call dropped at subtask-ls.ts:194 counts in the 42; :176-196 listSubtasksFromSessions and :119-139 listChildSessions are preserved | subtask_ls output drops forks; description :193 loses "and their forks"; rug.md:35 documents the fork promise and is edited alongside; 4 test edits at workflow-subtask-ls.test.ts:176,193,205,217 |
| Registration try/catch | workflow.ts:305, 307, 371-374, 376-378 | 9 | OVERENGINEERED | editor.add called directly; body :308-370 unchanged | load behaviour: a throwing editor.add now fails plugin load instead of logging subtask_ls.register.failed |
| id alias | workflow.ts:256 (257 is the count schema) | 2 | GIMMICK | task_id only | subtask_tail input: id is rejected; task_id is required |
| Extra status values | workflow.ts:202 | 1 | GIMMICK | ['ok','error'] | subtask_ls input: empty, timeout and aborted are rejected; resolveEntryStatus:67 yields only ok and error |
| Step snapshot, end to end | helpers/subtask-ls.ts:18-27 and 36-45; workflow.ts:316-318 | 21 | DEAD | nothing; :319 becomes fromSessions ?? [] | subtask_ls output: no snapshot rows, and the :316-318 fallback promise goes with them; workflow.ts:194 is the tool-description string and loses its fallback clause; workflow.ts:15 drops listSteps and readStoredSteps from the import (edited, no line removed); recordSteps has zero callers, so production always returned [] |
| Runtime instruction validator | workflow.ts:73-95 | ~20 | OVERENGINEERED, MED | import workflowPlugin and read its fields; the literal is already compile-time typed | no tool input or output change; 5 tests deleted (workflow-instructions.test.ts:226-244, workflow.test.ts:379) |
| Oversize pre-check | workflow.ts:58, 174-177, 291 | ~6 | OVERENGINEERED | writeEntry already fails on oversize; one failure path | the log line moves into writeEntry; four call sites pass entryBytes (workflow.test.ts:234-254) |
| **Group B2 total** | 42+9+2+1+21+20+6 | **101 (75 exact + ~26)** | | | |

Sums: the five exact rows are A 835 + B1 35 + B2 75 = 945 of 2,833 lines = 33.4%; the three rows added on 2026-10-25 add ~46, taking the prune to ~991, about 35.0%. The uncalled engine alone is 835/2,833 = 29.5%; 33.4% is the 945-line decided cut. Reachable exact cuts: 35+75 = 110 of 1,998 = 5.5%, or 7.8% with the added rows (156/1,998); orphans 835 = 100%. The tail store is not touched: the earlier 10-line TTL row is withdrawn because removing either the TTL or the 1,000-id cap changes tail output for two lines, and the cap is what bounds the store.

### Tests that go and stay

| Slice | Files | Lines | Tests |
|---|---|---|---|
| Deleted with Group A | 4 | 1,913 | 174 |
| Retained, exercise the surviving surface | 12 | 3,429 | 265 |
| Shared, instruction-entry-client | 1 | 250 | 28 |
| **Subtree total** | **17** | **5,592** | **467** |

Deleted files: workflow-runner.test.ts (785), workflow-runner-progress.test.ts (464), workflow-script.test.ts (337), workflow-fork-fanout.test.ts (327) = 785+464+337+327 = 1,913 lines; 64+18+87+5 = 174 tests (57/18/38/5 static it( sites; the parameterized script cases make up the difference).

### Impact on the other four plugins

No other plugin is edited. Headline: the 835-line engine and 174 tests leave that no other plugin references, and every cross-plugin contract stays byte-identical — the trio's 645 bytes of descriptions, the 18,451-byte instruction entry, and all four shared instruction modules.

- instructions-loader: unchanged. It reads the entry this plugin writes (workflow.instructions, workflow.ts:37, 18,451 bytes per session.created for rug/rug-workflow, removed for non-allowlisted agents at :168) and imports instruction-entry-client.ts:28,29 plus service-client, instruction-payload and instruction-carrier at :27-38. Those four total 137+262+112+493 = 1,004 lines and stay untouched; only instruction-entry-client's 137 sits inside the 2,135 measure. 18,451 is Buffer.byteLength(JSON.stringify(v)) at instruction-entry-client.ts:14, measured on worktree and HEAD.
- tool-limit-reminder: unchanged. The trio's 645 bytes of descriptions (229+243+173, workflow.ts:192-250) travel with every request in every session; the budget counts calls, not bytes.
- goal-continuation: unchanged. It shares the execute.before hook; this ADR registers no hook differently, so ordering and the goal-first gate are untouched.
- quality-gate-enforcer: unchanged. No gate, gate-runner or gate-config line moves.
- Shared state: the tail store keeps its 24 h TTL and 1,000-id cap, process-shared across sessions. The 25 MB of .opencode/plugins/sessions/ is out of scope and stays.

### Preserved

| Surface | Pinned by |
|---|---|
| subtask_ls / subtask_run / subtask_tail registration, workflow.ts:306-375 (:308, :324, :359) | ADR-012; tests/workflow-subtask*.test.ts |
| Per-session instruction entry write, workflow.ts:23-188, key workflow.instructions:37 | ADR-010, ADR-011; workflow-instructions.test.ts |
| session.created (295-297) and session.agent.selected (299-303) | ADR-011:169; workflow.test.ts |
| listSubtasksFromSessions (subtask-ls.ts:176-196) and listChildSessions (:119-139) | workflow.ts:314; ls, fork and parameters tests |
| subtask-run seam, inlined at workflow.ts:17 | tests/workflow-subtask-run.test.ts (68 lines, 4 tests; :3 import retargeted to the inline seam) |
| workflow-subtask.ts skill loader (1,025) | createSubtask imported by the inline; ADR-016:284-294 |
| workflow-types.ts (194), workflow-client-adapter.ts (100) | five importers as listed above |
| instruction-entry-client and the three shared modules | instructions-loader.ts:27-38 |
| bun shim typing | .opencode/tsconfig.json:31; stryker.config.mjs:13 |

### Order of change

Test-file edits, all four and the only test edits (no new behaviour tests): tests/helpers/workflow-subtask-run.test.ts:3 (import retarget), tests/helpers/workflow-subtask-ls.test.ts:176,193,205,217 (the four fork-lineage cases, rewritten), tests/workflow-instructions.test.ts:226-244 (validator tests), tests/workflow.test.ts:379 and :234-254 (validator test, entryBytes sites). tests/helpers/workflow-subtask-fork.test.ts is retained unchanged: it covers `fork_from` creation through createSubtask, which the prune does not touch. The progress suite (workflow-subtask-progress.test.ts) was deleted, not updated.

1. Group A: delete helpers/workflow-runner.ts, helpers/workflow-script.ts and their four test files. 835 implementation lines, 1,913 test lines, 174 tests. Irreversible: no flag remains and the tests that specified the engine leave with it; recovery is git history. Verify: just opencode::typecheck, then just opencode::test.
2. Group B1: inline the wrapper at workflow.ts:17, dedupe the clamp, swap TextEncoder, drop 17 export keywords, collapse the thrice-stated subtask contract — 35 exact lines plus ~20. workflow-subtask-run.test.ts:3 imports @plugins/helpers/subtask-run directly, so retarget that import to the inlined seam before typecheck passes. Verify typecheck and the subtask tests.
3. Group B2, one row per commit and separately approvable: fork lineage (4 rewrites at workflow-subtask-ls.test.ts:176,193,205,217 and rug.md:35; workflow-subtask-fork.test.ts is retained and still covers `fork_from` creation), registration try/catch (workflow.test.ts), id alias (tail test), status values (ls test), snapshot (workflow.test.ts), runtime instruction validator (workflow-instructions.test.ts:226-244 and workflow.test.ts:379, 5 tests deleted), oversize pre-check (entryBytes call sites at workflow.test.ts:234-254). 75 exact lines plus ~26.
4. Post-deletion cleanup, no other plugin touched: drop the stale citations at .opencode/reports/adr-005-implementation-audit.md:46,68 and docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md:64,280. The eslint entry at .opencode/eslint.config.js:78 is a shared did word-list word, not a rule, and stays unchanged.
Final gate: just opencode::typecheck && just opencode::test && just opencode::lint.

Steps sum to the table: the five exact rows are 835 + 35 + 75 = 945; with the three added rows the prune is ~991.

### Options considered

#### Option A: delete the engine, split the plumbing cuts (chosen)
Pros: 945 exact lines fewer, ~991 with the added rows, no other plugin changes, contract changes isolated in B2.
Cons: 174 tests leave; five contract deltas need a reviewer's sign-off.

#### Option B: keep the engine behind a config flag
Pros: script-mode workflows remain available.
Cons: 835 implementation and 1,913 test lines stay compiled and maintained for zero production callers; the flag has no reader.

#### Option C: port the engine to a skill later
Pros: keeps the capability without the plugin weight.
Cons: defers the decision, keeps all 835 lines meanwhile, and needs a new artifact this change forbids.

#### Option D: do nothing
Pros: no risk today.
Cons: 29.5% of the subtree has no caller and four files dominate its CI time.

### Scoring

Criteria, each scored -2 to +2: maintainability, flexibility, implementation ease, and initial implementation cost (higher is cheaper).

| Criterion | A | B | C | D |
|---|---|---|---|---|
| Maintainability | 2 | -2 | -1 | -2 |
| Flexibility | 1 | 1 | 2 | -1 |
| Implementation ease | 1 | -1 | -2 | 2 |
| Initial implementation cost | 1 | -1 | -2 | 2 |
| **Total** | **5** | **-3** | **-3** | **1** |

Option A wins at +5 because it removes the most code while confining every contract change to one approvable group; B and C keep 835 lines compiled for no caller, and D leaves 29.5% of the subtree uncalled.

### Consequences

- 174 tests and 1,913 test lines leave with the engine. Coverage that drops: script scanning and compilation, runner progress, fork fan-out. workflow-fork-fanout.test.ts also carried the subtask fan-out seam at :73; that seam keeps no direct test afterwards, though the subtask tool tests still exercise the path users call.
- B2 changes four tool behaviours (fork listing, the id input, three status values, the always-empty snapshot field) and one load behaviour. Typecheck and the retained tests pass only after the five test-file edits named in Order of change; nothing stays untouched, which is why each row is approved on its own.
- A throwing editor.add now fails plugin registration instead of being logged and swallowed. That is the intent: the three registrations are static, so partial registration is worse than none.
- Deadness is grep-based; a dynamic import or string-built path would evade it. Nothing outside this subtree imports the two orphans, and the root loader scans plugins/*.ts only.
- A cut becomes wrong if script-mode workflows return (restores the engine), if a harness passes subtask_tail id or the dropped status values (restore those two rows), or if forks must count as the caller's work (restores the lineage scan at a cost of 42 lines).
- Hook count and ordering are unchanged: two subscriptions, three tool registrations.

### Deferred follow-ups

Neither item is part of this prune, and both stay out of the 945-line arithmetic and the five test edits.

- Adapter messages and parent-model inheritance: workflow-client-adapter.ts:82-92 and workflow-subtask.ts:411-430, ~31 lines, HIGH risk. It edits the engine (workflow-subtask.ts) and WorkflowSdkClient, so it needs its own ADR rather than a row here.
- harness.config.ts:13-92: hoist the literals to as const, ~20 lines, read by five plugins. This ADR declares the file read-only; the hoist is an additive follow-up only.

## Implementation (2026-10-28)

Every decision row and all four user orders are implemented, except the three exclusions at the end of this section. The historical rows above are kept as written: they record what was decided and measured on 2026-10-23 and 2026-10-25, not the tree as it stands after the prune.

### Increments (13)

| # | Increment |
|---|---|
| 1 | Orphan engine and script deleted with four test files (`workflow-runner.ts`, `workflow-script.ts`, and their tests). |
| 2 | Dead semaphore removed. |
| 3 | Dead exports trimmed. |
| 4 | `subtask-run` inlined and its contract collapsed. |
| 5 | `TextEncoder` replaced by `Buffer.byteLength`. |
| 6 | Duplicated clamp shared. |
| 7 | Runtime config validator and oversize pre-check deleted. |
| 8 | Fork lineage removed. |
| 9 | Snapshot store and fallback removed. |
| 10 | Tool surface tidied: no `id` alias, `ok`/`error` only, no registration catch. |
| 11 | 4000-char step truncation removed: output is returned full; the 12 KB tail clip and `truncated` flag followed on 2026-10-28, leaving count, TTL and id caps. |
| 12 | Dynamic child titles and the running map removed; V2 renders statuses natively. |
| 13 | Docs and delegation guidance updated; dead `maxConcurrent`, envelope and `stats` fields removed. |

### Gate results

- Full suite: 38 files / 937 tests pass.
- Typecheck passes.
- Lint: 0 errors, one pre-existing warning.

### Mutation verification (2026-10-28)

Scoped Stryker runs per changed behavioural file; config thresholds break 72 / low 60 / high 80. Final gap-closure campaign:

| File | Score | Survivors |
|---|---|---|
| `plugins/workflow.ts` | 100% | 0 survivors, 0 no-coverage; the empty `task_id` and defensive branches are now tested |
| `plugins/helpers/workflow-subtask.ts` | 90.92% | 58 survivors, 2 no-coverage; survivors are mostly equivalence or defensive guards |
| `plugins/helpers/subtask-ls.ts` | 93.59% | 10 survivors, 0 no-coverage; the Effect, plain and null reader paths are tested |
| `plugins/helpers/subtask-tail.ts` | 84.21% | 9 survivors, 0 no-coverage; the write-path prune mutant is observably equivalent because reads re-filter |
| `plugins/helpers/workflow-client-adapter.ts` | 97.14% | 2 equivalent survivors |

`plugins/helpers/workflow-types.ts` has no behavioural mutants: the dead declarations were deleted rather than tested.

Gap-closing tests added: tail prune-on-write and mixed expiry; workflow empty-id and defensive fallbacks; ls Effect, plain, null and thenable paths; engine timeout wording, log truncation, missing-session duration, pre-abort label and `BudgetExceededError.name`; plus the new classify and edge suites.

Gate: 38 files / 937 tests pass; typecheck and lint clean (1 pre-existing warning).

### Exclusions

- `rug.md` fork-promise wording and its `truncated === false` guidance: user-owned, untouched.
- Adapter messages and parent-model inheritance: deferred to its own ADR.
- `harness.config` literal hoisting: deferred.

### Truncation audit (2026-10-28)

19 clamp and cut sites reviewed across the workflow plugin, its helpers and the docs that describe them. Disposition: 2 removed, 14 kept, 3 raises deferred.

- **Removed (2):** the 12 KB tail clip `MAX_TAIL_ENTRY_CHARS` (subtask-tail.ts:5) and its `truncated` flag, per a user TODO — entries store the full child output and the orchestrator decides how much to read back.
- **Kept (14):** count (5 entries), TTL (24 h), 1,000-id store cap, and the log, step and ledger bounds — structural bounds rather than content ceilings.
- **Deferred (3):** description cuts at 80 chars; raising them to 160 is a separate follow-up.

Removing the clamp leaves no byte ceiling: bytes are bounded by count × TTL instead. Accepted memory trade-off, because the count and TTL caps still bound total volume and the read decision moves to the orchestrator; the residual risk is one large child output inflating store and read cost for its 24 h window. Site-by-site table and rationale: `mem:audits/truncation-sites-2026-10-28`.