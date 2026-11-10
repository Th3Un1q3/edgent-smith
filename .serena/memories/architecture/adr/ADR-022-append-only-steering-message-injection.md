---
id: ADR-022
title: Append-only synthetic steering messages for file-visit instruction injection
status: accepted
date: 2026-10-28
scope: OpenCode RUG harness — instruction injection carrier for .opencode/plugins
---

# ADR-022: Append-only synthetic steering messages for file-visit instruction injection

Supersedes `mem:architecture/adr/ADR-011-native-session-scoped-instruction-entries` (status `superseded`, 2026-10-20), which carries `superseded-by: ADR-022`. `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection` stays `proposed` — see Decision for why it is not retired here.

## Context

### The carrier seam as built

- The injection decision sits under `context.tool.hook('execute.before', …)` (`.opencode/plugins/instructions-loader.ts:463`), gated by `TARGETED_TOOLS = new Set(['edit','write','read'])` (`:42`) at `:465` after the path is read from the event input.
- Dedupe: `tokenKey` → `idempotency/<sessionID>` (`:45`) holds `instruction_load:<path>` with `:full`/`:ref` suffixes (`:475-508`); `FULL_BODY_BUDGET = 5` (`:43`) caps verbatim bodies, and later matches degrade to references.
- Carrier choice: `resolveInjectionCarrier` (`.opencode/plugins/helpers/instruction-carrier.ts:86-96`) reads `INSTRUCTION_INJECTION`, returns `'synthetic'` only for that exact value, and returns `'native'` otherwise — including for an unknown value, which warns once (`:92-96`). `InjectionCarrier = 'native' | 'synthetic'` (`:78`).
- Native arm: the keyed entry client (`.opencode/plugins/helpers/instruction-entry-client.ts:40-51`, `api/` prefix stripped on lookup) writes one JSON value per key per session. The runtime renders each entry as a `<context key="…">` block at the end of the instruction sequence, inside the per-request system array (`@opencode/plugin/dist/effect/session.d.ts:25`, `system: Array<SystemPart>`). The render position is taken from ADR-011's Rendering and Ordering sections plus this type; the renderer itself was not read (evidence: ADR prose, type corroboration).
- Synthetic arm: `context.session.prompt({ sessionID, text: message, resume: false })` (`instructions-loader.ts:501`) plus a stash at `pending/<sessionID>` (`:502`, key from `:46`); a later `context.session.hook('context', …)` (`:541`) pushes `{ type: 'text', text: pending }` onto `event.system` (`:544`) and removes the stash (`:545`).
- Delivery is not one per touch. A native touch that succeeds exits at `:521` before either write and delivers once; a native touch that falls back, and every `INSTRUCTION_INJECTION=synthetic` touch, delivers twice — the prompt append at `:501` and the `event.system` push at `:544`, both built from the same rendered string stashed at `:502`. The carriers are therefore mutually exclusive per touch, and the duplicate sits inside the fallback and synthetic branches, not between carriers. The `context` hook (`:541-545`) never reads the carrier or `INSTRUCTION_INJECTION`, and `helpers/instruction-carrier.ts:91-96` is consumed only at `:513`; `:489` is the no-op when every match is already tokenized. Whether both copies land in the same model request is unproven: it depends on inbox drain order for `resume: false`, which neither the types nor any test exercises, so the code guarantees both copies exist, not their request alignment (repo-verified trace, 2026-10-28).

### What the premise claimed and what holds

Verdict: **partially holds**. The premise was that system-instruction injection invalidates the provider cache, that an append avoids it, and that the loader should therefore default to the synthetic carrier.

- **"System injection resets the whole cached context" — false as stated.** Prefix caches diverge at the first differing token, so a changed system array invalidates from the divergence point forward, not from the start. Evidence class: vendor-documented (secondary sources; no primary provider document was opened).
- **The narrower cost is real.** The system prompt is rebuilt per request (`plugin/dist/effect/session.d.ts:25`, repo-verified), so a per-turn mutation makes consecutive requests differ and discards the cacheable head for every turn after the mutation — not for the earlier ones.
- **Native entries already had the property the premise asked for.** They render last, after the shared baseline (ADR-011 Rendering and Ordering; renderer unread), so the common prefix survives their presence.
- **An append leaves sent bytes untouched.** Appending cannot alter a token already sent; the appended text is uncached on the turn it lands and is re-read as prefix on every later turn (repo-verified mechanically).
- **"Recomputation dominates cost" — UNVERIFIABLE.** No cached-token, latency or spend telemetry exists in this tree.
- **The runtime models cache granularity.** `SystemPart` carries `cache?` (`@opencode/ai/dist/schema/messages.d.ts:10`), `CacheHint` carries `ttlSeconds` (`…/schema/options.d.ts:158-162`), and `CachePolicyObject` covers `tools`/`system`/`messages` (`:164-172`, repo-verified). "The whole context is recomputed" is not how this build represents the problem.
- **Cache TTLs are short.** Secondary sources describe an ephemeral TTL on the order of minutes, so the invalidation cost only bites when turns are frequent relative to the TTL. Evidence class: vendor-documented (secondary), and it is the axis on which the original premise was overstated.

The premise survives in narrower form, and this record acts on that form: mutating a per-request system prompt on file visits discards the cacheable head for every later turn and makes the system prompt a moving target, whereas an appended message leaves every previously sent token byte-identical.

### Evidence classes in this record

- **Repo-verified** — a `file:line` in this tree that a reader can open.
- **Runtime-binary** — the inbox facts this record relies on (the 409 `SessionInbox.LifecycleConflict`, the `onConflictDoNothing().returning(...)` insert, server-assigned `enqueued_seq`, and the delete on `projectDelivered`) come from the compiled `opencode` binary, whose bundled JavaScript is readable only with `grep -a`. They carry no stable line numbers and cannot be re-verified from repository source; the grep pattern is the locator. The route and its declared statuses are vendored and citable: `.opencode/node_modules/@opencode/client/dist/chunks/pty-handoff-qzsnm4q8.js:386-399`.
- **Vendor-documented (secondary)** — provider cache semantics, labelled as such in the premise section above.

## Criteria

Scored on a −2..+2 scale where +2 means materially better than the best alternative on that dimension and −2 materially worse. The set is chosen for this decision's dominant risk: a silent guidance loss plus a cache regression that is invisible without telemetry.

- **Guidance survival** — whether the instruction is still present after a compaction boundary, a move, or a fork. This is the kind of failure that costs a whole task, and it is the reason the entries carrier was accepted.
- **Prefix stability** — whether a file visit changes bytes already sent in an earlier request of the same session. The decision exists because of this cost.
- **Delivery cardinality** — whether one visit produces exactly one delivery. The observed defect is duplication, so a carrier that cannot express "once" fails regardless of its cache profile.
- **Transcript and token cost** — what the carrier adds per visit and per later turn.

Rejected as non-discriminating here: implementation ease (both carriers already exist and are tested), and attack surface (neither carrier admits new external input).

## Options considered

**A. Today's double delivery — `session.prompt` plus the `event.system` push.** Pro: text reaches the model by two routes, so one failing route still delivers. Con: two deliveries of the same text, duplicate transcript turn, and a system mutation on every visit (`instructions-loader.ts:501-502`, `:541-545`); ordering-dependent.

**B. Native entries as the default, synthetic retired (ADR-011 as accepted).** Pro: keyed, unrenderable twice, narrated on change and removal, compaction-derived. Con: unreachable from the plugin `Context` — `SessionDomain` omits `instructions` while it does include `synthetic` (`plugin/dist/promise/session.d.ts:143`, `effect/session.d.ts:143`), and the context carries no client or base URL, so operation needs a transport the plugin constructs from its own credentials; where that is unavailable the carrier needs a fallback that is not a system-array append, which is the fallback question the Decision answers.

**C. Appended synthetic steering message, single delivery path, no system mutation.** Pro: reachable from the plugin domain without extra transport; appends without a user-role turn (`SessionInboxSynthetic.type: "synthetic"`, `client/dist/promise/generated/types.d.ts:884-893`); leaves sent tokens untouched; carries an envelope that names the injector. Con: subject to compaction summarisation, no edit or removal lifecycle, and a per-visit transcript cost.

**D. Stable head plus volatile tail via `CachePolicyObject` with `CacheHint` TTLs.** Pro: expresses the cache intent precisely and the runtime supports per-part hints (`…/schema/options.d.ts:158-172`). Con: it is a cache annotation, not a delivery mechanism — it leaves both the duplication and the system mutation in place, and TTL policy the plugin does not own would then decide whether guidance reaches the model uncached.

**E. Per-visit prompt turns (`context.session.prompt`, one user message per visit).** Pro: trivially the append primitive, no system mutation. Con: enqueues a user inbox entry (`client.d.ts:48`, `types.d.ts:5512-5800`); guidance arrives framed as human input, which ADR-011's "What the user-role carrier costs" documents as a role-attribution failure.

## Non-negotiable requirements

- **N1 — one delivery per visit.** A single file visit produces exactly one message the model can see.
- **N2 — no retroactive system mutation.** No plugin path changes a system-array segment that a previous request in the same session already sent.
- **N3 — reachable carrier.** The delivery call must exist on the plugin `Context` without a transport the plugin builds from credentials it resolves itself.
- **N4 — attributable.** The delivery names itself as harness guidance rather than human input.

A, B and D fail N1. A fails N2. B fails N3 — the reason ADR-011 narrowed its own reach on 2026-10-20. E fails N4.

## Scoring

Filtering leaves **C as the only eligible option**; the criteria below therefore discriminate nothing between candidates and are recorded as C's profile, not as a contest.

| Criterion | C: appended synthetic |
|---|---|
| Guidance survival | −1 |
| Prefix stability | +2 |
| Delivery cardinality | +2 |
| Transcript and token cost | −1 |
| Total | +2 |

C's negative scores are accepted rather than offset: they are the cost of the prefix guarantee, and the Consequences section states what they buy and what they risk.

## Decision

File-visit instructions are delivered as **one appended synthetic steering message per visit**, carrying a correlation id, with **no system-prompt mutation on the file-visit path**.

The carrier is `context.session.synthetic({ sessionID, id, text, description, metadata })` — `SessionSyntheticInput` (`client/dist/promise/generated/types.d.ts:6006-6035`), available on `SessionDomain` (`plugin/dist/promise/session.d.ts:143`). The message text is the existing envelope, `<steering priority="high" reason="relevant files touched" type="instructions">…</steering>` as built at `.opencode/plugins/helpers/instruction-payload.ts:38`, which satisfies the attribute schema in `.opencode/instructions/steering-message.md`. The append carries a stable correlation id, `instruction_load:<path>`, in `metadata` only (`id` omitted: `SessionMessage.ID` requires a `msg_` prefix); idempotency is enforced loader-side against the session token map (`instructions-loader.ts:475-508`), with the 409-on-repeat contract stated under Design changes.

`context.session.prompt(...)` (`:501`), the `pending/<sessionID>` stash (`:46`, `:502`) and the `event.system.push` in the `context` hook (`:541-545`) are removed from the file-visit path. The native entry arm stays in the codebase as a selectable fallback.

**ADR-010 remains `proposed`, not superseded** (decision text in `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection`). Its carrier is a native session instruction entry, not a system-array append: `.opencode/plugins/workflow.ts` declares no `.hook(` at all (zero matches, verified 2026-10-28), and its own comment states the mechanism — "instructions travel as a session instruction entry … there is no system-prompt carrier and no fallback" (`.opencode/plugins/workflow.ts:244-246`). The block is resolved once per plugin lifetime from config (`:231`, `:233`) and written under one fixed key — `WORKFLOW_ENTRY_KEY = 'workflow.instructions'` (`:38`) — by `writeEntry(sessionID, WORKFLOW_ENTRY_KEY, options.block)` (`:150`) on session creation (`:252`) and on agent selection (`:257`); an agent outside the allowlist gets `removeEntry(sessionID, WORKFLOW_ENTRY_KEY)` instead (`:144`). Because a keyed entry is written on those events rather than a request-time mutation, consecutive requests carry the same entry and no segment already sent is rewritten, so it does not violate N2. Under the closing principle it is a review candidate, not a retirement.

## Consequences

### Carrier survival: the compaction tension

The entries carrier was accepted for four properties, and the append carrier does not inherit all of them.

- **Provenance and narration** — native entries are keyed and narrate change and removal (ADR-011 Decision). An appended message cannot be edited or removed; a later instruction can only contradict an earlier one in the transcript. This is a real loss of the update lifecycle, mitigated only by the envelope stating its own source.
- **Prefix stability** — native entries render last, so the baseline survives (ADR-011 Rendering and Ordering); appended messages are strictly better here because they never touch the system array at all.
- **Compaction survival** — the carriers differ, and the difference favours native. ADR-011 states that entry state survives compaction because the epoch model makes current values initial state, while a synthetic turn "can be summarized away" (ADR-011, "Compaction erodes it"), and its own open questions record that compaction of an already-admitted synthetic message is not evidenced. No plugin in this tree registers the hook today (`grep compaction` across `.opencode/plugins/**/*.ts` returns zero hits, repo-verified 2026-10-28), but the surface exists: `SessionHooks.compaction` (`@opencode/plugin/dist/effect/session.d.ts:129-142`) receives `SessionCompaction extends SessionContext` (`:42-45`) — `system`, `messages`, `tools` — plus a mutable `result?: SessionCompactionResult` (`:36-41`: `summary`, `providerState?`, `metadata?`, `tokens?`) documented as 'Set to use this compaction and skip the model request'. Guidance re-assertion is therefore drivable from the hook instead of worked around.
- **Move and fork** — entries are inherited as the parent's newest values (ADR-011); the message path is unevidenced there.

The loss is accepted, with two named mitigations and one condition each:

1. **Named fallback — native entries, triggered by a deployment requirement for compaction-proof guidance.** The arm stays selectable through `INSTRUCTION_INJECTION=native` (`.opencode/plugins/helpers/instruction-carrier.ts:90-96`). It is correct for any caller that supplies an entry transport; it is not the default because the default must work without one (N3).
2. **Re-append at the compaction hook.** The hook is available and is a pre-rewrite inspection point: the payload carries the messages about to be rewritten and a `result` that substitutes the summary and skips the model request, so the rewrite cannot precede it. Re-assert the current instruction set there, or reset the session token map at that boundary so a still-relevant file appends again on its next visit. When the server commits the rewritten history after `result` returns is unresolved, so the hook must not assume a second invocation; a guidance loss at that boundary is accepted (see below).

If neither mitigation is available in a given deployment, the accepted consequence is that guidance delivered before a compaction boundary may be summarized away, and the session continues without it.

**Dedupe strength is a property of the store, not of this design.** `context.storage` declares `get`/`set`/`remove`/`scan` and no medium (`@opencode/plugin/dist/effect/storage.d.ts:4-9`), so restart survival is unknown. Accepted behaviour under an unknown medium: dedupe is best-effort, and a cold map may re-deliver one block per file per session. That is bounded by the number of instruction files a session touches and observable in the duplicate counter, so it is accepted rather than guarded by a second mechanism; the id cannot serve as the guard, because the inbox row is gone after delivery.

**The compaction commit point is accepted, not guarded.** Re-append is opportunistic: the token-map reset may run from the compaction hook, and guidance lost at a boundary is accepted rather than watched for (user decision, 2026-10-28). The loss is bounded by the same count as the dedupe — at most one block per instruction file per session, and only for files appended before the boundary and not revisited after it.

### What improves

- The request's system array is byte-identical across turns on the file-visit path, so the shared baseline stays a cacheable prefix.
- One delivery, so the duplicate text and the hook-ordering dependence disappear.
- No credential-bearing transport: `synthetic` is on `SessionDomain` (`promise/session.d.ts:143`) while `instructions` is not.
- Guidance is typed `"synthetic"` (`types.d.ts:884-893`) and named by its envelope, instead of arriving as a user turn.

### What degrades

- **Transcript growth** — one message per distinct instruction file per session, bounded by the token map rather than by length; body size is separately capped at `FULL_BODY_BUDGET = 5` (`instructions-loader.ts:43`).
- **Uncached tail** — the appended text is uncached when it lands and is read as prefix on every later turn.
- **Superseded guidance stays in the transcript** — there is no removal operation, so a wrong instruction can only be contradicted, never withdrawn.

### Tests that pin the old default

- `.opencode/plugins/tests/instructions-loader.test.ts:125` — "injects the pending instructions into the model request system prompt": asserts the `event.system` content this decision removes.
- `.opencode/plugins/tests/instructions-loader.test.ts:189` — "an empty pending value leaves the system prompt untouched": its subject, the pending stash, no longer exists.
- `.opencode/plugins/tests/instructions-loader.test.ts:202` — "synthetic mode still sends the steering prompt": asserts the `session.prompt` delivery that becomes a synthetic message.
- `.opencode/plugins/tests/instructions-loader.test.ts:275` — "unset INSTRUCTION_INJECTION resolves to native": pins the default that the append carrier takes over.

## Design changes required

One bullet per file; each states the behaviour and the contract the code must satisfy. Citations are the ones the gap survey evidenced.

- `.opencode/plugins/instructions-loader.ts` — the file-visit path delivers through `context.session.synthetic(...)` instead of `session.prompt` plus the pending stash, and the `context` hook that pushed `event.system` is never registered.
  - Idempotency source: correlation key `instruction_load:<path>` carried in `metadata` only — `id` is omitted because `SessionMessage.ID` requires a `msg_` prefix and a non-prefixed key fails schema validation. Dedupe is the loader's token map alone, never the id. Dedupe is the loader's token map alone (`:475-508`), because the inbox row is deleted on delivery and can no longer conflict. A 409 (`SessionInbox.LifecycleConflict`, raised when `.onConflictDoNothing().returning(...)` returns an empty set) is treated as **already delivered**: the loader logs `instruction_load:duplicate` with the path, increments a per-session duplicate counter, and records the path as tokenized. It is never a silent swallow, because a swallowed 409 is guidance loss exactly where the mitigation should fire. When the map is cold but the conversation already holds the block, the loader accepts one duplicate: re-reading a marker costs a round trip and cannot see a compacted transcript, while a duplicate is bounded and visible in that counter, so the visible duplicate is preferred to the invisible loss.
  - Delivery mode: `delivery` is omitted, so the server applies its `'steer'` default (the field is optional and insert uses `f.delivery ?? 'steer'`); `'queue'` is reserved for a message that must not interrupt a running turn.
  - Ordering: server-assigned `enqueued_seq`, so visit order equals call order and no client sequencing is needed.
  - Size policy: one appended message is capped at `MAX_ENTRY_VALUE_BYTES` (`helpers/instruction-entry-client.ts:12`, 256 KiB), enforced plugin-side before the append because no server-side cap is known. That constant is the right reuse: it is the only size gate in the system and the entry carrier already refuses a value above it, so the append path inherits the ceiling the native arm enforces and no message can exceed what an entry could have stored. Five full bodies are about 70 KB of current repo content and 1.25 MB at the per-entry ceiling, so the cap binds; past it, bodies degrade to their `:ref` form **before** the append, because an appended message cannot be edited back. `MAX_LEDGER_BYTES` (`helpers/instruction-carrier.ts:147`) bounds the ledger, never the message. **The server-side cap is assumed absent** (user decision, 2026-10-28): the 256 KiB plugin-side ceiling is the only bound, the assumption is recorded rather than verified, and the plugin refuses the append above it — degrading bodies to `:ref` first, and skipping the append with a log entry when a single body alone still exceeds the ceiling.
  - Drain: on the first synthetic resolution for a session, list the entries, remove every `instr-*` key (full, `-ref-`, `-desc-`, and legacy `instr-task-skills-*`), set the seeded marker, then append. Only a native touch sweeps today (`sweepRemovals`/`applyRemovals`, `:308-321`, `:422`) and the synthetic branch never reaches it (`:529-536` seeds exclusions only), so without the drain the session receives the same guidance twice for its remaining life. The drain is a one-time system-array mutation and the single migration exception to N2 and to the Principle; its bounds and price are stated under Rollout.
  - Compaction: register the compaction hook and treat the token set as unseeded at that boundary, or re-append directly from the hook; the hook is a pre-rewrite inspection point and must not assume a second invocation; a loss at that boundary is accepted (see Consequences).
- `.opencode/plugins/helpers/instruction-carrier.ts` — unset and empty resolve to `synthetic`.
  - An explicit `if (value === 'native') return 'native'` precedes the default return, the rejected-value warning changes from `using native` to `using synthetic` (it is false otherwise), and `'synthetic'` stays accepted as a literal even though it now selects the default.
  - `'native'` remains the escape hatch and the only value that reaches the entry machinery (`:513-528`).
- `.opencode/plugins/helpers/instruction-payload.ts` — each block carries the instruction path in its `description` element as well as in `text`.
  - The envelope keeps `priority="high" reason="relevant files touched" type="instructions"` (`:38`) and every block keeps `<path>`, so a message stays attributable after summarisation without a system-side caption.
- `.opencode/plugins/tests/helpers/instructions-loader-harness.ts` — the harness records synthetics and exposes hook registration.
  - `session` gains `synthetic`, pushed verbatim so `id`, `metadata`, `description` and `delivery` are assertable, modelled on `goal-continuation-harness.ts:45,84,146-150`.
  - `prompts` (`:24`) and the `prompt` stub (`:96-99`) stay for the explicit-native cases only; a `hasHook(name)` accessor replaces assertions on an unchanged `event.system` array, which is vacuous once nothing writes to it (`:62`).
- `.opencode/plugins/tests/instructions-loader.test.ts` — delivery assertions move to the synthetic channel.
  - Delete `:125` (its subject, the system push, is removed) and `:189` (the pending stash is removed); rewrite `:202` as the single-delivery test and `:275` for the inverted default; keep the explicit-native cases `:214`, `:264`, `:327`.
  - Re-point `:239`, `:387`, `:564`, `:598`, `:608`, `:625` from prompts to synthetics with expected counts unchanged: ten assertions in scope, not four.
  - The single-delivery test asserts exactly one synthetic per eligible visit, `id === 'instruction_load:<path>'`, the envelope prefix, an empty prompt list, and that a second visit adds nothing.
- `.opencode/plugins/tests/helpers/instruction-carrier.test.ts` — the three cases pinning the old default change with it: `:95` (unset or empty resolves to native), `:100` (reads the flag on every call), `:106` (rejected value resolves to native and warns once).
  - Contract: unset and empty resolve to synthetic, the warning names synthetic, and only an explicit `'native'` resolves native.
- `.opencode/instructions/steering-message.md` — the doc gains the append contract the carrier depends on.
  - Under the existing Instructions Loader example (`:33-42`, the envelope is already documented): one message per file visit, nothing re-delivered for a repeated path, `instruction_load:<path>` in `metadata` only (`id` omitted: `SessionMessage.ID` requires a `msg_` prefix) with the loader as the enforcing party, no edit or removal path for an appended message, and the path in `description`.
  - Under 'Adding a New Steer Message' (`:57-60`): add the delivery step — `context.session.synthetic(...)`, never `event.system`, never `session.prompt` for steering.

Implementation markers of the form `TODO[@ADR-022]: <what>; <motivation>` sat at every planned edit site and were removed once the corresponding change landed; see git history for the handoff state — `.opencode/plugins/instructions-loader.ts`, `.opencode/plugins/helpers/instruction-carrier.ts`, `.opencode/plugins/helpers/instruction-payload.ts`, `.opencode/plugins/tests/instructions-loader.test.ts`, `.opencode/plugins/tests/helpers/instructions-loader-harness.ts`, `.opencode/plugins/tests/helpers/instruction-carrier.test.ts` and `.opencode/instructions/steering-message.md` — so the plan is greppable in the tree.

## Rollout

This is a breaking change in behaviour, not in API.

- **In-flight sessions.** An existing session keeps its `instr-*` entries, which continue to render, and the append adds the same blocks. A session whose first carrier resolution is synthetic never enters the native branch, so no list-and-delete runs and no drain is triggered (`:513-528`, `:529-536`). The window closes only by the drain above; until then the session receives double guidance.
- **Installs that set nothing.** These flip to synthetic silently. The only signal is the `carrier=` line at `:469`, logged at debug level and invisible by default, and no in-tree config file sets the variable, so exposure is external operator environments.
- **Installs that set `synthetic`.** They keep working and stop meaning anything, because the literal now equals the default; it cannot be removed without breaking them.
- **Installs that set `native`.** Unchanged: the arm is retained and remains the only path into the entry machinery.
- **Drain sequence, as behaviour.** On the first synthetic resolution for a session: list entries, remove every `instr-*` key (full, `-ref-`, `-desc-`, legacy `instr-task-skills-*`), set the seeded marker, then append. Drain before append, so a block is never present in both carriers even briefly. Version-keying (`instr-v2-…`) is not a drain: the server renders what is stored, and the plugin cannot un-render a key it stops writing.
- **The drain is the one sanctioned exception to N2 and the Principle.** Removing `instr-*` entries mid-session changes what later requests see, which is what N2 forbids. It is admitted because it removes only entries this decision retires — no live guidance and no unrelated content — it runs once per upgrading session, and it is idempotent, since a second run lists nothing to remove. Cost: one cache invalidation at the rollout boundary, as the system tail shrinks once. Benefit: without it the session renders its entries and receives the same blocks as appends for the rest of its life, which is permanent double guidance and a larger, unbounded prefix cost. A bounded single invalidation is preferred to an unbounded duplication, and every other mutation of the system array stays forbidden.
- **Plan documents that disagree.** `docs/plan/2026-10-21-instructions-loader-adr-011-delta/` carries both readings — unset → native at `migration-plan.validated.md:49` and `:335`, unset → synthetic at `migration-plan.md:231` and `:272`. This record settles it as synthetic.

## Principle

> **OpenCode plugin changes are append-only wherever possible: add entries, add messages, add files — never rewrite context that has already been sent.**

A sent request is immutable evidence of what the model was told. Any plugin that edits the system array mid-session changes a block the provider has already cached and the model has already been conditioned on, and it pays twice: cache divergence on every later turn, and an instruction set that differs between the turn that reasoned and the turn that acted.

The review question every future plugin answers before it ships: **does any code path change bytes that an earlier request of the same session already sent, and if so, what does that change buy that an append cannot?** A plugin that cannot answer the second half appends instead.
