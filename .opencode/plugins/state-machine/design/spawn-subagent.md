> **Historical design record.** Superseded by `CONTRACT.md` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# spawn_subagent — design

Replaces the dormant `request_dispatch` (`definitions.ts:63-65`, `:116`, `:150`, `:514-518`; `core/machine.ts:157-161`; `CONTRACT.md:97`, `:135-136`, `:150-151`, `:223`). Nothing else changes shape: one action, one emit variant, one plugin port, one callback name.

The action is only worth having if a state emits it. `request_dispatch` was declared, typed, handled by the plugin, and reached by no arm — that is the audit defect, and `spawn_subagent` inherits it the moment it ships without an arm.

## 1. Parameter shape

```ts
export interface SpawnSubagentParameters {
  readonly agent: string
  readonly description: string
  readonly template?: TemplateId
  readonly text?: string
  readonly reportTo?: CallbackName
  readonly timeoutMs?: number
}
```

| field | type | optional | rule |
|---|---|---|---|
| `agent` | `string` | required | Target agent id for the child. Must resolve through `context.agent.get` (`state-machine.ts:212`) before `session.create` accepts it; an unresolvable id is a failed spawn, not a throw. |
| `description` | `string` | required | The one line shown beside the spawn, as `prompt` requires (`definitions.ts:44-46`). |
| `template` | `TemplateId` | optional | One of the named templates (`definitions.ts:21-37`), rendered with the current context by the same `renderTemplate` the prompt action uses. |
| `text` | `string` | optional | A literal prompt, delivered verbatim. Wins over `template` when both are present. |
| `template` \| `text` | — | at least one | An entry with neither is refused when the action runs, exactly as `prompt` does (`definitions.ts:39-46`). |
| `reportTo` | `CallbackName` | optional | Callback name the verdict arrives under. Defaults to `subagent_ready`. |
| `timeoutMs` | `number` | optional | Abandonment window. Defaults to `120_000`, mirroring the `runShell` port (`CONTRACT.md:131`). |

`CallbackName` is `string` (`core/machine.ts:58`), so nothing type-checks `reportTo` against a real arm. A typo would hang the state forever. The assembler must walk the state tree at load and refuse an action whose `reportTo` matches no `callback.<name>` arm — build it (§5, "emit-path validation").

```ts
export interface SubagentEmit {
  readonly type: 'emit.subagent'
  readonly agent: string
  readonly text: string
  readonly description: string
  readonly reportTo: CallbackName
  readonly timeoutMs: number
}
```

`spawnId` is absent on purpose: the action stays deterministic and the plugin assigns the correlation id (the child session id) at delivery.

## 2. Emit path

The plugin receives `emit.subagent` through the same drain as every other emit: the action returns it from `dispatch`, `takeEmits` collects it (`core/machine.ts:891-895`), and `deliver` switches on `type` (`state-machine.ts:228-264`). One new `case 'emit.subagent'` calling a new port.

**A subagent facility exists.** `context.session.create({ parentID, agent })` followed by `context.session.prompt({ sessionID, text })` is already wired for the old dispatch path (`state-machine.ts:219-224`), with `context.agent.get` as the existence check (`:212`). So the seam is a port in the `CONTRACT.md:127-133` table, not an invented host interface:

```ts
runSubagent(request: {
  parentID: string, agent: string, text: string, timeoutMs: number
}): Effect.Effect<CallbackPayload>
```

The default implementation creates the child under the parent's session id, prompts it, and waits. `context.session.wait` is present in the session domain (`@opencode/plugin/dist/effect/session.d.ts:143`), but its semantics are **not visible** in what I read; whether the verdict is read from `wait`'s return, from a message listing, or from the child's final assistant message must be settled before the default port is written. The port contract is what the machine depends on; the read mechanism is an implementation detail behind it.

The verdict re-enters through `machine.callback(sessionId, reportTo, payload)` (`core/machine.ts:932-940`), which dispatches `callback.<reportTo>` into the actor. No new event type, no new channel.

## 3. Verdict contract

The judge is prompted to end its reply with one JSON object:

```json
{ "verdict": "pass", "reason": "typecheck and tests pass on the changed files" }
```

`verdict` is `"pass"` or `"fail"`; `reason` is one non-empty string. The port maps it onto the existing `CallbackPayload` (`context.ts:15-20`), extended with one field:

```ts
export interface CallbackPayload {
  readonly ok: boolean            // verdict === 'pass'
  readonly exitCode?: number
  readonly output?: string        // the judge's reason, verbatim
  readonly value?: InjectedMemories
  readonly spawnId?: string       // child session id; absent on the three port callbacks
}
```

Every terminal state of a spawn produces exactly one callback, so no state can wait on a dead child:

| child outcome | callback |
|---|---|
| judge returns `pass` | `{ ok: true, output: "<reason>", spawnId }` |
| judge returns `fail` | `{ ok: false, output: "<reason>", spawnId }` |
| agent id unresolvable / `create` throws | `{ ok: false, output: "spawn-failed: <cause>", spawnId: "" }` |
| reply carries no parseable verdict | `{ ok: false, output: "verdict-unreadable: <first 200 chars>", spawnId }` |
| `timeoutMs` elapses | `{ ok: false, output: "timeout", spawnId }` |

A crash is not a hang, and a hang is not a crash: all five rows arrive at the same arm pair.

### Pass arm

```json
{
  "target": "memorize",
  "guard": { "type": "callback_ok", "params": {} },
  "actions": [
    { "type": "record_callback", "params": { "reportTo": "subagent_ready" } }
  ]
}
```

### Fail arm

```json
{
  "target": "#session.panic",
  "actions": [
    { "type": "record_callback", "params": { "reportTo": "subagent_ready" } },
    {
      "type": "prompt",
      "params": {
        "template": "quality_check_failed",
        "description": "Report the judge's reason and park the loop."
      }
    }
  ]
}
```

No `record{op:'fail'}` is needed: `record_callback` already records a `failure` on `ok: false` (`CONTRACT.md:102`), and `quality_check_failed` renders its `reason` and `detail` (`definitions.ts:185-188`). Both arms live in one array under `callback.subagent_ready`, pass first, exactly as `check` splits on `callback_ok` (`machine.json:217-251`).

## 4. Lifecycle

| step | what it means | status |
|---|---|---|
| **Creation** | action emits `emit.subagent`; plugin creates the child under the parent session | **core supports delivery** — `EmitRequest` union `core/machine.ts:180`, drain `:891-895`, switch `state-machine.ts:228-264`; the host call exists at `state-machine.ts:219-224`. Only the new union member, switch case and port are missing. |
| **In-flight guard** | a second spawn while one is pending must not start a second child | **must be built.** `/` The machine needs a context field recording the pending `reportTo` (added to `COPIERS`, `context.ts:235`, or `boundSnapshot` drops it — `core/snapshot.ts`, rule 7), plus a `spawn_pending` guard (added to `GuardType`, `definitions.ts:138-144`). `/` The plugin needs a `Map<sessionId, spawnId>` that answers a duplicate with `{ ok: false, output: "spawn-in-flight" }` rather than dropping it. `/` Precedent for per-session dedupe is `ensure`'s `Deferred` map (`core/machine.ts:845-866`), but it dedupes session *load*, not children. |
| **Timeout / abandonment** | the child never answers | **must be built.** No core timeout exists for emits; `runShell`'s 120 s bound lives in the port (`CONTRACT.md:131`). The port races `timeoutMs` against the child wait and always settles the callback. |
| **Cancellation** | the turn is interrupted while a child runs | **partly supported.** `system_interrupted` → `parked` is a root arm (`core/machine.ts:948-952`, `CONTRACT.md:86-89`), so the machine stops cleanly. Cancelling the *child* is not supported: `parked` has no `callback.subagent_ready` arm, so a late verdict is dropped silently by XState, and the child keeps running. Must be built: cancel on interrupt via `session.remove` (`session.d.ts:143`) and add a `parked` arm that records the late verdict. |
| **Cleanup on session end** | the parent ends with a child alive | **must be built.** The plugin subscribes to exactly four events — `session.created` (`state-machine.ts:355`), `session.inbox.enqueued` (`:374`), `session.idle` (`:402`), `session.execution.interrupted` (`:421`). No deletion event is handled. Snapshot expiry is 30 days (`core/snapshot.ts:19`) and is not cleanup. Whether the host cascades child deletion on parent removal is **not visible**; the design must not assume it. |

### What core already gives, and what it does not

- **`pending` / `wake` (`core/machine.ts:722`, `:776`, `:783`, `:798-804`) is not reusable here.** It holds entry emits until the first real user item, and `markAwake` clears it on *any* event (`:880-885`). It answers "is the loop awake", not "is a child running".
- **The actor is per-session and keyed by session id** (`ensure`, `:845-866`). A child session has no machine; `machine.idle(childId)` returns `[]`. That is why the child cannot report through its own loop and the verdict must ride the parent's callback.
- **Transient states** are the right home for a spawn state: `machines/index.ts:33` lists `check`, and restore treats a stored transient as absent (`core/machine.ts:837`). A new `judge` state joins that list, so a reload mid-spawn starts a fresh spawn instead of waiting on a child that the reload forgot.

## 5. Callback naming

**Rule: one name per spawn *purpose*, never per use.** `reportTo` is a parameter, its default is `subagent_ready`, and the two arms are written once for that name. Everything that varies per spawn — pass or fail, reason, correlation — rides the payload, not the name. `quality_check_ready`, `skill_ready` and `memories_ready` follow the same rule (`machine.json:136`, `:177`, `:212`): the name is the port, the payload is the occasion.

How a judge differs from the three existing signals:

- **Nothing new in the event namespace.** All four are `callback.<name>` events (`core/machine.ts:198`, `:218`) with a `CallbackPayload`. `spawn_subagent` is a fourth *source*, not a fourth mechanism.
- **It is distinguishable by `spawnId`.** The three port callbacks omit it; a spawned judge's payload always carries it. `field_present` already reads a payload field, but its union is `'goal' | 'text'` today (`definitions.ts:130-132`), so requiring `spawnId` either widens that union or is absorbed by the new `spawn_pending` guard.
- **Staleness is the one genuinely new condition.** A `skill_ready` has no lifetime; a judge can answer after the state that wanted it is gone. `spawn_pending` compares `payload.spawnId` with the context's pending entry and fails the arm when they differ, so an abandoned child's verdict is recorded and ignored instead of transitioning a state that moved on.

## 6. CONTRACT.md draft

§5 action row:

> | `spawn_subagent` | emits `emit.subagent` and the plugin runs a child agent under the current session; the child's verdict returns as `callback.<reportTo>` (default `subagent_ready`) with `{ ok, output, spawnId }` | `{ agent, description, template?, text?, reportTo?, timeoutMs? }` |

§7 prose (3 sentences):

> `emit.subagent` creates a child session under the caller and prompts it with the rendered text; the judge's `{ verdict, reason }` becomes `{ ok, output, spawnId }` on `callback.<reportTo>`, where `pass` sets `ok` and `reason` becomes `output`. Exactly one callback is sent per spawn — create failure, an unreadable verdict and the `timeoutMs` expiry all arrive with `ok: false`, so a state never waits on a dead child. A spawn whose state has been left is still settled, and the `spawn_pending` guard makes the late callback a no-op instead of a transition.

## 7. Ship now versus wait for a runtime

**Can ship now, as a typed placeholder that is *not* the audit defect:** the `SpawnSubagentParameters` type, the `emit.subagent` union member, the plugin switch case plus a `runSubagent` port whose test implementation returns a canned verdict, one emitting state with the arm pair above, the contract rows, and a unit test proving `pass` reaches `memorize` and `fail` reaches `panic`. That proves the callback plumbing end to end against a fake child — the same standard the `runShell` and `injectSkill` ports are held to today.

**Needs a real subagent runtime:** the default `runSubagent` body (create, prompt, read the verdict), `timeoutMs`, child cancellation, session-end cleanup, and `spawn_pending` against a live child.

**Does declaring it as a placeholder risk the audit defect?** Yes, exactly, unless the arm ships in the same change. `request_dispatch` was declared, typed and handled by the plugin, and no arm emitted it (`REFACTOR-PROPOSAL.md:15-19`); the plugin code for it is still there at `state-machine.ts:206-242` and is dead. An action with no arm is the same defect with a new name, and a green suite would not notice — the suite has no test that every declared action is emitted by some arm.

**Recommendation:** ship it reachable — one state (`towards_goal.judge`, transient) emits it, the arm pair exists, and the fake port proves both branches — then land the real port body as a second change behind the same contract. The contract and the arms do not move between the two changes.

**Rejected alternative:** declare the action, the emit variant and the plugin case now, and add the emitting state "when a judge agent exists". That is `request_dispatch` reproduced: a handled emit nobody raises, plus a CONTRACT paragraph explaining that nothing raises it (`CONTRACT.md:150-151`).

## 8. Two forks to settle

1. **Which state owns the spawn.** Two readings: `validate` *becomes* the spawn (the self-report prompt at `machine.json:254-261` is replaced by a judge child, and `GOAL_ACHIEVED`/`GOAL_INCOMPLETE` disappear from that state), or `judge` is a new transient sibling between `check` and `validate`, leaving the self-report in place. The first removes a round-trip and rewrites the two existing arms; the second adds a state and keeps both paths testable. They produce different `machine.json` diffs, so the choice is not cosmetic.
2. **Who reads the verdict.** The port parses the child's final message (needs a message-read call whose availability I could not confirm — **not visible**), or the child is prompted to send a signal that the plugin translates into the parent's callback (today "a child's signals never reach the parent", `state-machine.ts:207`). The port signature is identical either way; the failure modes are not — message parsing fails on prose, signal bridging fails if the child's loop is not the machine under test.
