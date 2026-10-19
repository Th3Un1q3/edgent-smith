---
id: ADR-008
title: Minimal Goal Continuation (v0) Without a Todo Field
status: accepted
date: 2026-10-07
scope: OpenCode v2 harness — task-continuation enforcement for primary rug sessions
---

# ADR-008: Minimal Goal Continuation (v0) Without a Todo Field

## Decision

Task continuation in the OpenCode v2 harness is enforced by one idle-driven nudge loop: a single LLM-callable `goal` tool with two actions, `set` and `clear` that both return a terse `{ content: 'ok' }` with no echoed goal text, plus one V2 Effect plugin that re-prompts an agent which went idle while holding a declared goal. `set` writes the goal record `goal/<sessionID>` shaped `{text, nudges}` and the gate record `goal-gate/<sessionID>` shaped `{armed, goalSet, steeringSent}`; `clear` removes the goal key and, only when a goal was set this turn, disarms the gate record, and an absent goal key means done. The plugin subscribes through the unary `context.event.subscribe()` narrowed with `Stream.filter(isIdle)`, runs two load-time scans (gate hydration from `goal-gate/`, then `goal/` replay to cover the restart gap), claims every nudge before sending (read, increment `nudges`, persist, then send), sends via `session.synthetic({ sessionID, text, resume: true })`, and wraps the send in `Effect.ignore` so a failed send never terminates the subscription. Nudging stops at the idle loop's single timing constant `MAX_NUDGES`. The caller scope and the `text` requirement are enforced inside `execute`. No todo field is added and no todo-enforcer plugin is reintroduced. The goal-stack, close-time gate, judgment, and failure-taxonomy machinery of the full design is deferred to the extension path below; the goal-first enforcement gate ships in v0 (see Enforcement — goal-first gate).

## Considerations

### Context

The prior enforcer (`todo-enforcer.ts`) has been removed. There is no todo field in the harness and none will be reintroduced. Continuation therefore needs a signal that survives the absence of an explicit plan surface, and the obvious candidate — the workflow envelope — is **insufficient**: a workflow can report `ok` while the turn's intent is unmet, so envelope status cannot be trusted as a completion signal. The dominant failure mode is agent-side stopping: the agent ends a turn before the user's goal is achieved.

The governing constraint is **minimal tooling**: exactly one new LLM-callable tool is permitted, no dedicated enforcer plugin is allowed, and persistence must reuse `ctx.storage`. The core job needs two signals — "working on X" and "done" — and one trigger, the idle transition. Everything else in the superseded full design handles goal *structure*, which the loop does not need to prove itself.

### Mechanism

#### Tool surface — one tool, two actions

```json
{
  "name": "goal",
  "description": "Declare or clear this session's continuation goal.",
  "input": {
    "type": "object",
    "properties": {
      "action": { "type": "string", "enum": ["set", "clear"] },
      "text":   { "type": "string" }
    },
    "required": ["action"]
  }
}
```

This block is the tool's single definition, inlined into the plugin: the plugin declares `goalInput` (this schema) plus a literal name and description, rather than importing an exported `goalTool` object. `text` is optional in the schema. `execute` validates `action === 'set' && !text` and returns an error; a conditional `required` would need a discriminated union, and one manual check avoids it. Caller scoping is self-enforced inside `execute`: read `context.agent` and return early unless `isInToolScope(agent)` holds — `ALLOWED_ORCHESTRATORS.has(agent) || enforced.has(agent)`, where `ALLOWED_ORCHESTRATORS` is the orchestrator set `rug`, `rug-workflow`, `rug-team-coach` and `enforced` is the set produced by `selectEnforced`. `Tool.Info` exposes no caller field, and the agent `permission` config is inverted for this purpose (`rug`, `rug-workflow`, `rug-team-coach` set `"*": "deny"`), so a config allowlist would deny the orchestrator by default.

| Action | Mutating | Required | Effect |
|---|---|---|---|
| `set` | yes | `text` (validated in `execute`) | Write or replace the goal record; reset `nudges` only when `text` changes; disarm the gate (`goalSet: true`). Returns `{ content: 'ok' }`. |
| `clear` | yes | — | `storage.remove` the goal key; disarms the gate record only when a goal was set this turn. Returns `{ content: 'ok' }`. Absence means done. |

`get` is dropped: the loop reads storage directly and audit reads storage too. No `id`, no payload beyond `text`.

#### Persisted state — two records per session

```ts
type GoalRecord = {
  text: string    // declared intent — the only continuation signal
  nudges: number  // nudges sent since the last text change
}

type GateState = {
  armed: boolean        // false once a goal is set or cleared this turn
  goalSet: boolean      // true when `set` ran this turn
  steeringSent: number  // steering nudges sent this turn
}
```

`set` writes both `goal/<sessionID>` and `goal-gate/<sessionID>`; `clear` removes the goal key and, only when `goalSet` is true, rewrites the gate record with `armed: false`. A goal key present means open; absent means no goal or done. The gate record persists so a plugin hot reload does not lose turn state. `setAt`, `lastNudgeAt`, and `status` are dropped: the two timestamps exist only to serve TTL and backoff, the two guards that stall, and `clear` removes the key instead of writing a terminal state, so `status` has no job. No stack and no store beyond the gate record.

#### Plugin loop — one subscription

Plugin path: `.opencode/plugins/goal-continuation.ts`; it exports a V2 `Plugin` with `id` and `effect`. All three live plugins are V2 Effect plugins on `@opencode/plugin` 2.0.24; a V1 `{ event: (input) => ... }` object does not register, so the idle callback would silently never run.

Load, once:

1. `storage.scan({ prefix: "goal-gate/" })` hydrates the gate `Map` from persisted state, following `StorageScanResult.next` until exhausted.
2. `storage.scan({ prefix: "goal/" })` evaluates every record with the same decision function used at idle. This replay covers the restart gap: `session.idle` is `ephemeral` and is not re-emitted for an already-idle session. For an open goal with no gate record (the pre-persistence upgrade gap), the scan hydrates that session's gate disarmed — `{ armed: false, goalSet: true, steeringSent: 0 }` — so the upgrade fires no false enforcement burst.

Per `session.idle` (`context.event.subscribe()` — unary, narrowed with `Stream.filter(isIdle)`):

1. Read `goal/<data.sessionID>`. Absent → return.
2. Decide solely from `nudges < MAX_NUDGES`. No backoff, no TTL.
3. **Claim before send**: read, increment `nudges`, `storage.set`, then send. A concurrent reader sees the incremented value and skips; a crash between write and send drops one nudge (acceptable).
4. Send via `session.synthetic({ sessionID, text, resume: true })` — not `session.prompt`, which enqueues a user turn the user never wrote. `resume: true` is explicit; the default is not assumed.
5. Wrap the send in `Effect.ignore`. A failed send must not terminate the `Stream.runForEach` consumer; a terminated consumer silences every goal in every session for the process.

Nudge text: `Goal still open: "<text>". Continue, or call goal.clear if done.`

Constants: `MAX_NUDGES` only — the idle loop's single timing constant. No `BASE`, no `TTL`. Enforcement adds a separate cap, `maxSteeringRepeats` (see Enforcement — goal-first gate).

The loop stops when the agent calls `goal.clear` or `nudges` reaches `MAX_NUDGES`. On cap the plugin stops nudging and keeps the record for audit.

#### Failure surface

| Failure | Guard |
|---|---|
| Race: double nudge / lost write | Claim before send: increment and persist, then send; a concurrent reader skips. |
| Throwing send kills the subscription | `Effect.ignore` around the send. |
| Restart strands an open goal | Two load-time scans: `goal-gate/` hydration, then `goal/` replay. |
| Never-set goal | Enforced agents: the gate denies non-read-only tools until `goal set`. Non-enforced orchestrators: absence = no enforcement (fail-safe, opt-in). Other agents: `goal` is out of tool scope and returns `Tool.Error`. |
| Nudge storm | `MAX_NUDGES` cap; no backoff needed. |
| Stale goal | `MAX_NUDGES`; nudge text invites `goal.clear`. |
| Corrupt or absent storage | try/catch read → treat as no goal. |
| V1 hook shape silently no-ops | V2 `event.subscribe` stream. |

The single most important guard is the decision rule `nudges < MAX_NUDGES` with no time-based fields: it removes the entire class of "waiting for an idle event that never arrives" stalls, the failure mode that silently stops the loop. `MAX_NUDGES` already bounds nudge storms, so nothing is lost. It does not cover the restart gap; the two load-time `storage.scan` passes do.

#### Accepted v0 limitations

Documented, not fixed:

- User composition does not suppress a nudge.
- A user reply makes the session non-idle only during the agent's turn, so an open goal re-fires afterward.
- A never-set goal leaves v0 inert for non-enforced agents; enforced agents must set a goal first (see Enforcement — goal-first gate).
- A crash between the claim write and the send drops one nudge.

## Enforcement — goal-first gate

An enforced agent must call the `goal` tool before any non-read-only tool in each user turn. The gate denies the offending call with a typed `Tool.Error` carrying the remedy and injects a capped steering nudge. It adds no tool and no plugin: it is a second `execute.before` hook inside `.opencode/plugins/goal-continuation.ts`, beside that plugin's `session.idle` subscription. The minimal-tooling constraint holds — exactly one LLM-callable tool, no dedicated enforcer plugin — because the gate registers neither and guards the `goal` tool the idle loop already owns. The clause is not violated: the gate is an `execute.before` hook inside the existing plugin, not a dedicated plugin.

Scope split: the idle loop owns the end of a turn (a declared goal that stopped); the gate owns the start (a turn that began without one). The v0 limitation "a never-set goal leaves v0 inert" is the gap the gate closes for enforced agents.

### Config — one central block

The gate reads one config block, `goalEnforcement`, keyed under the owning plugin id `goal-continuation` in `.opencode/plugins/config/harness.config.ts`.

```ts
// .opencode/plugins/types/goal-enforcement.ts
export type GoalEnforcementConfig = {
  enforceAll: boolean
  agents: string[]
  optOut: string[]
  readOnlyAllowlist: string[]
  maxSteeringRepeats: number
}
```

```ts
// .opencode/plugins/config/harness.config.ts
const goalEnforcement: GoalEnforcementConfig = {
  enforceAll: false,
  agents: ['rug', 'rug-workflow'],
  optOut: [],
  readOnlyAllowlist: ['question', 'read', 'glob', 'grep', 'skill'],
  maxSteeringRepeats: 3,
}

export const harnessConfig = {
  plugins: {
    'goal-continuation': goalEnforcement, // section keyed by the owning plugin id
  },
} as const
```

| Field | Meaning |
|---|---|
| `enforceAll` | True: every agent is enforced unless listed in `optOut`. |
| `agents` | Enforced ids when `enforceAll` is false. |
| `optOut` | Ids exempt under `enforceAll`. |
| `readOnlyAllowlist` | Tools permitted before the goal is set. |
| `maxSteeringRepeats` | Steering nudges per turn (N). |

`goalTool` is not a field: the plugin registers the tool under the literal name `'goal'` and the gate compares the same constant, so a typo cannot make the escape unreachable.

At load, once: select the enforced set with `selectEnforced`, keeping every configured id regardless of whether it is known; log a warning for an unknown id and for an explicit `goal` deny, then emit one activation line (`enforced agents: ...` or `enforcement disabled`).

```ts
const cfg = goalEnforcement
const maxSteeringRepeats = Math.max(0, Math.floor(cfg.maxSteeringRepeats)) // 0 keeps the denial, drops steering
const allowlist = cfg.readOnlyAllowlist
const isReadOnly = (tool: string) => allowlist.some(pattern => pattern.endsWith('*') ? tool.startsWith(pattern.slice(0, -1)) : tool === pattern)
const isInToolScope = (agent: string) => ALLOWED_ORCHESTRATORS.has(agent) || enforced.has(agent)
```

```ts
const candidates = new Set<string>(cfg.agents)
if (cfg.enforceAll) for (const id of known.keys()) candidates.add(id)
const selection = selectEnforced(candidates, id => known.has(id), isGoalDenied, cfg.optOut)
const enforced = new Set(selection.enforced)
```

The selection is config-authoritative: `selectEnforced(candidates, isKnown, isGoalDenied, optOut)` returns `{ enforced, unknown, denied }`, keeping every configured id regardless of whether it is known. An unknown id or unresolvable permissions warns (naming the agent) but the agent is still enforced — a runtime resolution gap must not silently disable the gate. `isGoalDenied(id)` reads `Agent.Info.permissions` — rules shaped `{action, resource, effect}`, with the tool name in `action` and the pattern in `resource` — and returns true only when the last rule matching action `'goal'` and resource `'*'` has effect `deny`; an unknown id or unresolvable permissions returns false, so the agent stays enforced. An explicit, resolved `goal` deny is the sole permission that removes a configured agent; a denied id is logged and not enforced. At the end of selection the plugin emits one effect-start log line: `enforced agents: <sorted ids>` when any agent is enforced, else `enforcement disabled`. Required install steps: no `"goal": "allow"` line is required to enforce an agent (config is authoritative); delete the vestigial `'todo-enforcer': { maxConsecutiveErrors: 3 }` block from `.opencode/plugins/config/harness.config.ts` and the `todoFollowupErrorCount` / `todoFollowupBrokenAt` fields from `.opencode/plugins/helpers/kv-store.ts`.

The allowlist is a predicate, not an exact `includes`: an entry ending in `*` matches by prefix. `question` is mandatory — pre-goal it is the only route to a human. The gate also blocks `execute`, so the code-mode MCP surface is unreachable pre-goal.

### Tool ownership and `codemode: false`

`goal-continuation.ts` owns both the `goal` tool and the gate in one `effect` closure: `context.tool.transform(editor => editor.add({...}))` registers the tool, `context.tool.hook('execute.before', ...)` registers the gate, and the gate's `Map` belongs to that closure. No other plugin registers `goal`.

Register with `options: { codemode: false }`. Omitting `options` falls into the `{ codemode?: true }` branch, and the harness reserves the direct name `execute` for a tool with `options.codemode === false`. `codemode: false` makes `goal` directly callable rather than reachable only through `execute`, which the gate blocks. Never pass `pinned` with `codemode: false` — the union types it `never`.

```ts
// registers the tool defined in "Tool surface" — the single source for name, description, and input
editor.add({
  name: 'goal',
  description: "Declare or clear this session's continuation goal. Call before other tools when goal-first enforcement is active.",
  input: goalInput,
  options: { codemode: false },
  execute: (input, toolContext) => Effect.gen(function* () { /* v0 actions below */ }),
})
```

`execute` self-enforces caller scope: `context.agent` must satisfy `isInToolScope` or it returns `Tool.Error`. `set` with empty or missing `text` fails with `Tool.Error` and leaves the gate armed. `set` with text writes `{ text, nudges: prior?.text === text ? prior.nudges : 0 }` — the v0 conditional reset — then writes the gate record with `armed: false, goalSet: true` and returns `{ content: 'ok' }`. `clear` removes `goal/<sessionID>`, disarms only when a goal was set this turn, and returns `{ content: 'ok' }`; a clear with no goal set removes a stale record but leaves the gate armed, so one call cannot bypass enforcement.

### Per-turn arm/disarm lifecycle

Gate state lives in an in-memory `Map` keyed by session, but the map is a write-through cache of the persisted `goal-gate/<sessionID>` record. Persisting it means a plugin hot reload (v2 rebuilds the effect closure) restores the pre-reload state instead of assuming unarmed: a disarmed session stays disarmed and `steeringSent` survives the reload. Storage is read only on a cache miss; the load-time `goal-gate/` scan hydrates the cache before any hook observes it.

```ts
type GateState = { armed: boolean; goalSet: boolean; steeringSent: number }
const gate = new Map<string, GateState>() // sessionID -> turn state
```

- **Arm** on `context.session.hook('prompt', ...)`: `writeGate(sessionID, { armed: true, goalSet: false, steeringSent: 0 })`, which commits the cache first, then persists. `SessionHooks` has no `synthetic` key, so a `session.synthetic` send cannot fire it. `SessionPrompt` carries no origin, so the hook cannot distinguish a user prompt from a plugin injection; two live plugins inject with `session.prompt` (`instructions-loader.ts`, `quality-gate-enforcer.ts`) and must migrate to `session.synthetic`, gated on an equivalence test, or each injection re-arms the gate and resets the cap.
- **Resume:** the load-time `goal-gate/` scan hydrates the map, so a session with a persisted record resumes with that state. For a session first seen mid-process with no record, `execute.before` lazily creates and persists `{ armed: true, goalSet: false, steeringSent: 0 }` when no entry exists, so a resumed turn arms on its first tool call. A prose-only resumed turn fails open — the accepted blind spot below.
- **Disarm:** `goal set` sets `armed: false, goalSet: true`; `goal clear` with `goalSet` true sets `armed: false`. The next user prompt re-arms. Compaction and `context` are separate hooks and neither arms nor disarms.

### Enforcement hook — hard deny plus capped steering

`context.tool.hook('execute.before', ...)`; the hook failure type is `Tool.Error`, so denying is `Effect.fail`. Do not append `.pipe(Effect.orDie)`: the hook's failure channel *is* the denial channel, and `orDie` reroutes the remedy away from the tool-error path.

```ts
yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
  const agent = event.agent as unknown as string
  if (!enforced.has(agent)) return
  if ((yield* parentOf(event.sessionID))) return            // child exemption, primary
  let st = yield* readGate(event.sessionID)
  if (st === undefined) { st = { armed: true, goalSet: false, steeringSent: 0 }; yield* writeGate(event.sessionID, st) }
  if (!st.armed) return
  if (event.tool === 'goal') return
  if (isReadOnly(event.tool)) return
  if (st.steeringSent < maxSteeringRepeats) {
    yield* context.session.synthetic({
      sessionID: event.sessionID, text: steeringText(event.tool), delivery: 'steer', resume: true,
    }).pipe(
      Effect.tap(() => Effect.sync(() => { st.steeringSent += 1 })), // count only successful sends
      Effect.tap(() => writeGate(event.sessionID, st)),
      Effect.ignore,
    )
  }
  return yield* Effect.fail(new Tool.Error({ message: errorText(event.tool, agent, allowlist) }))
}))
```

The deny path never writes the goal record and never rewrites the gate beyond the counter, so a parallel `goal set` cannot be clobbered into resurrection. `parentOf` resolves `Session.parentID` once and caches per session.

The denial is unbounded; only steering repeats are capped, and a denied call already returns the remedy, so the cap prevents steering storms, not enforcement.

Error text (remedy-carrying):

```
Goal required before other tools. Agent '<agent>' enforces goal-first. Call the `goal` tool with
{"action":"set","text":"<what this turn will accomplish>"} before '<tool>'. Read-only tools
(question, read, glob, grep, skill) remain available. To finish without work, set a one-line
goal, then clear it.
```

Steering text:

```
<steering priority="high" reason="tool '<tool>' blocked: no goal set for this turn" type="instructions">
Goal-first gate: call `goal` with {"action":"set","text":"<this turn's goal>"} before using '<tool>'.
Read-only tools (question, read, glob, grep, skill) remain available. When the turn is complete,
call `goal` with {"action":"clear"}.
</steering>
```

### Read-only allowlist

`['question', 'read', 'glob', 'grep', 'skill']`. These tools pass before a goal is set; everything else — including `execute`, `edit`, `write`, `bash`, and every MCP tool — is denied until `goal set`. `question` is mandatory: pre-goal it is the only route to a human. `list` is a phantom name (`list_mcp_*` is real) and is dropped. An enforced agent whose only read path is the code-mode gateway must declare a goal first.

### enforceAll semantics

- `enforceAll: false` (default): only ids in `agents` are enforced.
- `enforceAll: true`: every agent is enforced unless in `optOut`; a new agent inherits enforcement with no config edit.
- `optOut` is the exemption that keeps `enforceAll` safe.
- In both modes, an agent whose permissions explicitly and resolvably deny `goal` is logged and left unenforced; an unknown id or unresolvable permissions is logged but still enforced.

### Escape hatches

- **Subagent children:** skip any session whose `Session.parentID` is set. This is the primary exemption — a subtask created with `agent: 'rug-workflow'` and an explicit `parentID` is exempt even though its agent id is enforced.
- **Per-agent opt-out:** `optOut` removes an id from the enforced set even under `enforceAll`.
- **`goal clear`:** disarms after a set this turn; the next user turn re-arms, so a completed turn is not stuck behind the gate.

### Blind spot and its handling

`execute.before` never fires on a prose-only turn, so an agent that answers without tools escapes the hard gate — an accepted v0 limitation. The gate's job is to manufacture the `goal/<sessionID>` record the idle loop needs; it gates tool use, not stopping.

The plugin's `session.idle` handler closes the gap: if the gate is `armed && !goalSet`, send one `session.synthetic` nudge. A `context.system` arm is deferred; `SessionContext` carries no `kind`, so it cannot identify the primary request.

### Edge cases

| Scenario | Behavior |
|---|---|
| Goal never set | Gate stays armed; every non-allowlisted tool fails; steering repeats up to N. |
| Subagent child | Exempt by `parentID`; also skipped when the child agent id is not in tool scope. |
| Resumed / compacted session | Lazy arm on first tool call; compaction neither arms nor disarms. |
| Concurrent tool calls | Each evaluates independently; a deny may overshoot `steeringSent` by the parallel width. Counter drift is harmless. |
| `goal clear` before any set | Removes a stale record; gate stays armed. |
| `goal` or allowlisted tool pre-goal | Allowed; `goal set` disarms. |
| `set` with empty text | `Tool.Error`; gate stays armed. |
| `goal set` with unchanged text | Record written, `nudges` preserved (v0 conditional reset); gate disarms. |
| Prior-turn goal | A new user turn re-arms, so the agent re-declares per turn. |
| `enforceAll` + new agent that allows `goal` | Enforced with no config change; child exemption still holds via `parentID`. |
| `enforceAll` + new agent that denies `goal` | Logged and left unenforced; the gate never arms for it. |
| Unknown id in `agents` | Kept and enforced; logged as unknown. |
| `maxSteeringRepeats` <= 0 | Clamped to 0; denials continue, no steering. |
| Plugin absent / not yet written | No hook, no gate — fail-open. |

### Composition with the v0 idle loop

Both hooks live in `goal-continuation.ts` and read `goal/<sessionID>`; the gate keeps its turn state in a `goal-gate/<sessionID>` record backed by an in-memory cache.

- Gate owns the start: no goal record → tool calls denied, which forces the `goal set` that creates the record.
- Idle loop owns the end: record present and `nudges < MAX_NUDGES` → synthetic nudge.
- No double-nag: the gate persists its turn state, so a reload restores it rather than re-arming, and the idle loop fires only on an existing `goal/` record.
- No idle-loop guard against the gate; a tool-free stall is handled by the idle nudge, not by suppressing the loop.
- Both load scans (`goal-gate/` then `goal/`) must follow `StorageScanResult.next`; a truncated scan strands open goals or loses gate state.
- Counters stay separate — `steeringSent` per turn, `nudges` per goal.

### Verification

Ship only with these tests green (`just opencode::test`):

1. **Arm/disarm:** a user prompt arms the gate; a `session.synthetic` send does not re-arm.
2. **Migration equivalence:** `session.synthetic` delivers the same text to the same session before the next model request as `session.prompt({ resume: false })` did for `instructions-loader.ts` and `quality-gate-enforcer.ts`. If it fails, drop the migration and document that injected prompts re-arm the gate.
3. **Direct callability:** with `codemode: false`, `goal` appears in the tool list and is callable without `execute`.
4. **enforceAll safety:** an agent whose permissions resolve to a `goal` deny is excluded from `selectEnforced`; one that allows it, and an unknown one, are included.
5. **Config clamp:** `maxSteeringRepeats: -1` and `0` both behave as 0; unknown ids are kept and logged.
6. **Hook wiring:** `session.synthetic` does not fire the `prompt` hook, and `session.idle` is not re-emitted for an already-idle session.
7. **Child exemption:** `parentOf(sessionID)` resolves `Session.parentID` for a spawned subtask and returns null for a primary session.

The no-deadlock and no-steering-loop guarantees rest on runtime behavior the harness types do not express: `session.idle` is `ephemeral` and is not re-emitted for an already-idle session (test 6); `session.prompt` fires the `prompt` hook while `session.synthetic` does not (tests 1 and 6); `Session.parentID` is resolvable at `execute.before` time (test 7); and `Agent.Info.permissions` yields a resolvable `goal` entry for every enforced agent (test 4). Ship the gate only with these tests green.

## Deferred — Extension path

The full goal-stack design below was specified, red-teamed, and judged too complex for v0. It is retained as ordered future work so nothing is lost. Each step adds a verb, a hook, or a field — never a new store.

### Ordered work items

1. **Park/resume** — `suspend`/`resume` verbs; a timer or subscription triggers resume. Cost: two verbs plus a trigger registry. Risk: a goal strands if its trigger never fires.
2. **Goal stack + depth cap** — LIFO records, top-only activation, subtask auto-push/pop, configurable cap (default N=3, overflow rejected). Cost: a stack machine inside the plugin. Risk: ordering bugs, premature turn completion, depth overflow forcing premature close.
3. **Close gates** — deterministic `closeGates` declared at push, resolved against a close-gate registry, run in `onComplete`. Cost: a close-gate registry plus a shared close-gate-status cache. Risk: flaky or timing-out close gates block a legitimate close.
4. **Judgment subagent + `validating`** — an independent subagent for qualitative checks, with a transient `validating` status and async verdict delivery. Cost: a subagent, a transient status, a failure horizon. Risk: hangs, cost, recursion.
5. **`blocked`/`dependsOn` auto-resume** — per-goal blocked state, event subscriptions, and a readiness queue. Cost: subscription wiring plus readiness bookkeeping. Risk: missed events strand goals.
6. **Technical-failure taxonomy** — `session.error` subscription plus a send try/catch and a bounded retry horizon. Cost: error classification and tuned constants. Risk: over-counting aborts as failures.
7. **Suppression hooks** — cancel the pending nudge on user message, open question, or retry status; metadata-tagged delivery queue. Cost: a delivery queue plus cancellation paths. Risk: races with the idle handler.
8. **Restart re-evaluation** — re-derive volatile state (idle timers, reminder schedule) on load. Cost: a second evaluation path at load. Risk: stale volatile state; double-firing.

### Preserved design detail

#### Goal lifecycle and transitions

Four durable statuses and one transient status partition behavior.

| Status | Behavior |
|---|---|
| `started` | Active LIFO top (exactly one). Reminders armed; close policy armed. |
| `blocked` | Waiting on a dependency/event. Auto-resumes on event fire or prerequisite completion, but only at LIFO top. |
| `suspended` | Agent-declared pause. Resumes on explicit `resume` or `until` expiry only. |
| `validating` | Transient, non-persistent, bounded. Close policy running. Read-only; never an action target. |
| `completed` | Terminal. Popped from the active stack, retained for audit with `outcome`. |

`added` is removed: `push` activates atomically, so ADDED→STARTED is one call.

| From | Action | To | Guard / hook |
|---|---|---|---|
| ∅ | `push` | `started` | Depth < N; id unique (incl. completed). `onAdd`: resolve close gates, reject unknown, arm reminders. |
| ∅ | `push` (unresolved `dependsOn`) | `blocked` | Same guards; `onAdd` demotes. Verb stays single-shaped. |
| ∅ | `push` (a `validating` goal is LIFO top) | error | No `push` may pass a `validating` top; wait or let validation resolve. |
| `started` | `push` (subtask) | `started` (new top) | Depth < N; parent remains beneath. |
| `started` | `suspend(on)` | `blocked` | `onSuspend`: subscribe event/goal; cancel nudge. |
| `started` | `suspend(until)` / bare | `suspended` | `onSuspend`: arm `until` timer; cancel nudge. |
| `blocked` | `resume` | `started` | Authoritative; no dependency guard. `onResume`. |
| `suspended` | `resume` | `started` | `onResume`: re-arm reminders, re-run dirty close gates. |
| `started` | `resume` | `started` | Idempotent no-op; returns current state; hooks do not re-fire (race-safe). |
| `blocked`/`suspended` | `suspend` | error | Only `started` may suspend; error names current status and next step. |
| `blocked` | (event fires) | ready, then `started` at top | Auto-resume activates only at LIFO top; else mark ready. |
| `started` | `complete` | `validating`→`completed`\|`started` | `onComplete`: run close gates, then judgment if policy demands; pass→`completed`, fail→`started` + steering. |
| `started` | `complete(abandoned)` | `completed` | Skips close gates/judgment; fires dependency listener; audited. |
| `validating` | user message | `started` | Cancel pending validation. |
| `validating` | timeout / subagent error | `started` | Bounded by failure horizon; fail closed. |
| `completed` | any | error | Terminal; re-open needs a new `push`. |
| any | `list` | — | Read-only. |

`validating` never persists; a rebuild coerces a persisted `validating` to `started`.

#### Hooks model

A hook is plugin logic bound to a state change, run inside the plugin's single serial writer. The agent never supplies executable hooks; it declares data (`closeGates`, `closePolicy`, `dependsOn`) at `push`, and fixed hooks interpret it.

| Hook | Fires on | Minimal behavior |
|---|---|---|
| `onAdd` | `push` | Resolve `closeGates` against the close-gate registry; reject unknown names; subscribe `dependsOn`; arm reminders if `started`. |
| `onSuspend` | `suspend` | Arm `until` timer or `on` subscription; cancel pending nudge. |
| `onResume` | `resume` / auto-resume | Re-arm reminders; re-run close gates dirty since last pass; clear block reason. |
| `onComplete` | `complete` | **Run attached close gates** (exit 0 = pass); if `closePolicy` includes judgment, spawn the independent judgment subagent → `validating`; emit a `<steering type=quality-gate>` batch; pass→`completed`, fail→`started`. |
| `onTerminal` | any terminal (incl. abandoned) | Fire the dependency-completion listener so dependents unblock. |

At least `onComplete` running attached close gates is mandatory; judgment is optional per `closePolicy`.

#### Automations

- **Close gates attach at `push`.** `closeGates` are close-gate names resolved against the quality-gate-enforcer's close-gate registry; unknown names rejected at `onAdd`. `onComplete` and the enforcer share one close-gate-status cache keyed by close-gate name.
- **Close gates run on completion.** `onComplete` runs deterministic close gates; a fail is a normal (non-error) result carrying the close-gate batch, returning the goal to `started` so the agent fixes and re-calls `complete`. A close-policy failure steers the turn immediately, not through an idle reminder.
- **Bounded retry.** After K consecutive close-policy failures, auto-suspend with the failure summary.
- **Nested subtask auto-push/pop.** The plugin auto-`push`es a marked subtask-goal when a subtask starts and auto-`complete`s it on return; depth cap applies; the turn-goal still requires validation.
- **Event-driven auto-resume.** A `blocked` goal auto-resumes when its `on` event fires or its prerequisite `completed`; it activates only at LIFO top, otherwise it is marked ready and activated on pop.
- **Idle reminders.** `session.idle` only, exponential backoff, armed in `started`; cancelled on user message, close, open question, or retry.
- **Serial writer.** Every transition funnels through one in-plugin queue; `ctx.storage` is untrusted and `expectedStatus` is a secondary guard.

#### Edge-case handling

| Scenario | Behavior |
|---|---|
| `push` duplicate id | Reject; ids unique across the session incl. completed. |
| `push` while `validating` is top | Error; no `push` may pass a `validating` top. |
| `push` unresolved `dependsOn` | `onAdd` demotes to `blocked`; verb single-shaped. |
| `suspend` on non-`started` | Error naming current status and next step; declare `dependsOn` at `push` for a mid-goal dependency. |
| `resume` on `started` | Idempotent no-op returning current state; hooks do not re-fire. |
| `complete` when not `started` | Error naming current status and next step. |
| `list` output | `{stack:[{id,goal,status,closePolicy,closeGates,outcome?,reason?,since}],activeId,depth,maxDepth}` top-down. |
| `complete` failing close gates | Returns `started` (normal result) + close-gate batch; agent re-calls. |
| `complete` async judgment | Enters transient `validating`; verdict delivered asynchronously. |
| `validating` hangs | Bounded by failure horizon; fails closed to `started`. |
| `validating` across restart | Not persisted; rebuild coerces to `started`. |
| User message while `validating` | Cancels validation → `started`. |
| `complete(abandoned)` | Audited (visible in `list`), not default; fires dependency listener. |
| Depth-cap overflow | `push` rejected naming the top goal; subtask overflow surfaces steering. |
| Deterministic policy, no close gates | Rejected at `push`; defaults to `judgment`. |
| Close-gate timeout/error | exit 124 or non-zero → fail; reason carries exit code + output. |
| `blocked` event fires under newer goal | Marked ready; activates on pop, never jumps stack. |
| Re-open completed | No verb; new `push`. |

#### Removed from the original goal tool

| Removed | Why |
|---|---|
| `validate` action | Inferable from `complete`; reintroduces untrusted agent attestation; validation lives in `onComplete`. |
| `start` action + `added` status | `added` was inert (no reminders, no hooks); `push` activates atomically. |
| `suspend.reason` field | Status derived from presence of `on` vs `until`. |
| User-message auto-resume trigger | Cannot distinguish relevant from unrelated messages; resumes only on explicit `resume` or `until`. |
| Persisted `validating`/`validated` | Volatile state with no subagent after restart; coerced to `started`. |
| Second close-gate-status store | One shared cache keyed by close-gate name. |

Final action set of the deferred design: `push`, `suspend`, `resume`, `complete`, `list` — five verbs, four durable statuses, one transient.

### Options considered

#### Option A: Reintroduce a todo tool/field plus a todo-enforcer plugin

Pros:
- Reuses the known, already-built enforcement pattern.
- Cheapest initial implementation (existing code can be restored).

Cons:
- Directly violates the minimal-tooling constraint (new todo surface + enforcer).
- A flat list cannot express turn-goal vs subtask nesting, suspend/resume, or blocked-on-event.

#### Option B: Workflow-envelope-derived continuation

Pros:
- No new tool and no new persistence.
- Uses data the harness already emits.

Cons:
- The envelope can report `ok` while the turn's intent is unmet — an insufficient signal.
- No place to encode close policy, depth, or suspension.

#### Option C: Idle-driven goal-stack plugin with a restricted goal tool

Pros:
- Exactly one new tool; persistence reuses `ctx.storage`.
- Strict LIFO correctly separates subtask completion from turn completion.
- Hybrid close policy grounds completion in evidence plus independent judgment.
- Per-goal blocked/suspended states plus bounded failure horizon avoid spinning.

Cons:
- The plugin absorbs significant logic (close-gate orchestration, subagent spawning, timers).
- Judgment subagent adds latency and cost and can itself err.

### Scoring

Criteria (each scored -2 to +2):
- Maintainability — ease of understanding and evolving over time
- Flexibility — adaptability to future requirements
- Implementation ease — straightforwardness with the current stack
- Initial implementation cost — effort to build (higher score = cheaper)

| Criteria | Opt A | Opt B | Opt C |
|---|---|---|---|
| Maintainability | -1 | 0 | +2 |
| Flexibility | -2 | -2 | +2 |
| Implementation ease | +2 | +1 | -1 |
| Initial implementation cost | +2 | +1 | -1 |
| Total | +1 | 0 | +2 |

Option C won on total score in the full design; v0 adopts only its idle-driven core and defers the rest. Option A is additionally **disqualified by constraint override**: reintroducing a todo tool/field or a dedicated enforcer violates the minimal-tooling constraint regardless of its score. Option B is eliminated on correctness, not cost — the envelope cannot detect an unmet turn intent.

### Consequences

Positive:
- No todo surface is added; exactly one new tool (`goal`) enters the harness.
- Two actions, two state fields, one subscription, one timing constant — the smallest shape that proves the loop.
- The decision rule is a single comparison, so no time-based stall class exists.
- Claim-before-send is correct by construction; a crash costs at most one nudge.
- Tiny `ctx.storage` state makes restart recovery cheap and deterministic.

Negative:
- v0 detects only agent-side stopping; it cannot tell a completed turn from a stalled one.
- Nudges are not suppressed by user composition and can re-fire after a user reply.
- The plugin does not run close gates or judgment in v0, so "done" remains the agent's own claim; the goal-first gate is not a close gate.
- A never-set goal makes v0 inert for non-enforced agents; enforced agents are gated into setting one first.

### Alternatives considered

- **Re-introducing a todo tool/field** — rejected by the minimal-tooling constraint override.
- **Workflow-envelope-derived continuation** — rejected: the envelope can report `ok` while intent is unmet.
- **Session-wide mute** — rejected as too coarse; suspension must be per-goal (deferred design).
- **No suspend, fixed timed retry only** — rejected: cannot resume on unblock events and retries blindly against a repeating wall (deferred design).
- **Time-based guards (backoff `BASE`/`lastNudgeAt`, TTL `setAt`)** — dropped from v0: backoff stalls when the post-nudge turn is shorter than `BASE`, and TTL is wrong both ways, killing long tasks and under-bounding abandoned ones.

### Open questions

- The value of `MAX_NUDGES` and whether it varies by session type.
- Whether the nudge text should name the clear action differently for short goals.
- When to ship the deferred park/resume step, and how its trigger registry is wired.
- The exact default for N (stack depth) and whether N varies by session type.
- Judgment-subagent model selection, and whether a judgment goal can itself require validation (recursion policy).
- The precise bound and backoff constants for the technical-failure horizon.
- How `blocked` prerequisites are discovered and wired to their auto-resume events.
- The `ctx.storage` schema and versioning strategy for forward-compatible restart rebuild.
- Exact interaction boundary with the harness agent `permission` config (frontmatter `"*": "deny"`), which owns permission denials; `afk-enforcer.ts` is quarantined at `.opencode/plugins-quarantine/afk-enforcer.ts` and is not live.
- Whether "re-evaluate once on restart" should also fire on client-switch session resume.