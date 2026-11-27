> **Historical design record, superseded 2026-11-26** by `mem:opencode/state-machine-contract` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# spawn_subagent — design

Replaces the dormant `request_dispatch` (`definitions.ts:63-65`, `:116`, `:150`, `:514-518`; `core/machine.ts:157-161`; `mem:opencode/state-machine-contract`, `:135-136`, `:150-151`, `:223`). Nothing else changes shape: one action, one emit variant, one plugin port, one callback name.

The action is only worth having if a state emits it. `request_dispatch` was declared, typed, handled by the plugin, and reached by no arm — that is the audit defect, and `spawn_subagent` inherits it the moment it ships without an arm.

## 1. Parameter shape

```ts
export interface SpawnSubagentParameters {
  readonly agent: string
  readonly description: string
  readonly text: string
  readonly skills?: readonly string[]
  readonly reportTo?: CallbackName
  readonly timeoutMs?: number
}
```

| field | type | optional | rule |
|---|---|---|---|
| `agent` | `string` | required | Target agent id for the child, passed to `session.create` (`ports/subagent-port.ts:107`); a create the host refuses becomes `{ ok: false, output: "spawn-failed: …" }` (`:143-150`), not a throw. |
| `description` | `string` | required | The one line shown beside the spawn, as `prompt` requires (`definitions.ts:44-46`). |
| `text` | `string` | required | A template rendered by `renderPromptText` over the loop context and the leaf state, the same renderer and scope `prompt` uses (`machines/session/action-builders.ts:69-78`, `:83-91`; `machines/session/prompt-template.ts`). A text with no expression renders unchanged. |
| `skills` | `readonly string[]` | optional | Skill names the child is asked to load, carried on the emit only when the action declares them (`withSkills`, `action-builders.ts:80-81`). The port attaches each name as a skill id on the child's prompt call (`skillAttachments`, `ports/subagent-port.ts:77-81`). The spawn records nothing in the parent's `injectedSkills`; the child session owns the skills it loads. |
| `reportTo` | `CallbackName` | optional | Callback name the verdict arrives under. Defaults to `subagent_ready`. |
| `timeoutMs` | `number` | optional | Abandonment window, clamped to `SUBAGENT_TIMEOUT_MS` (`120_000`), mirroring the `runShell` port bound (`mem:opencode/state-machine-contract`). |

`CallbackName` is `string` (`core/machine.ts:58`), so nothing type-checks `reportTo` against a real arm. A typo would hang the state forever. The assembler must walk the state tree at load and refuse an action whose `reportTo` matches no `callback.<name>` arm — build it (§5, "emit-path validation").

```ts
export interface SubagentEmit {
  readonly type: 'emit.subagent'
  readonly agent: string
  readonly text: string
  readonly description: string
  readonly skills?: readonly string[]
  readonly reportTo: CallbackName
  readonly timeoutMs: number
}
```

The emit carries no correlation id: the action stays deterministic, and the runner keys its pending entry by parent session id (`ports/subagent-port.ts:133-141`).

## 2. Emit path

The plugin receives `emit.subagent` through the same drain as every other emit: the action returns it from `dispatch`, the actor's `takeEmits` hands it over (`core/machine-contract.ts:265`, `core/machine-service.ts:399`), and `deliver` routes it through the per-type table in `hooks/emit-delivery.ts`, where `'emit.subagent'` spawns the child and settles its callback (`:40-41`).

**A subagent facility exists.** The default port declares `session.create`, `session.prompt` and `session.wait` against `context.session`, and refuses by name the one the host omits (`ports/subagent-port.ts:88-103`). So the seam is a port in the `mem:opencode/state-machine-contract` table, not a new channel:

```ts
runSubagent(request: {
  parentID: string, agent: string, text: string,
  skills?: readonly string[], timeoutMs: number
}): Effect.Effect<CallbackPayload>
```

The default implementation creates the child under the parent's session id, prompts it, and waits (`ports/subagent-port.ts:88-111`). The prompt call carries `text` and, when the request names skills, one `{ id }` attachment per name (`skillAttachments`, `:77-81`); a spawn with no `skills` sends the same `{ sessionID, text }` call as before, because the attachment object is empty. The verdict is read from `wait`'s return, stringified (`replyText`, `:24`); the port contract is what the machine depends on, and the read mechanism stays an implementation detail behind it.

The verdict re-enters through `machine.callback(sessionId, reportTo, payload)` (`core/machine-service.ts:158`), which dispatches `callback.<reportTo>` into the actor. No new event type, no new channel.

## 3. Verdict contract

The judge is prompted to end its reply with one JSON object:

```json
{ "verdict": "pass", "reason": "typecheck and tests pass on the changed files" }
```

`verdict` is `"pass"` or `"fail"`; `reason` is one non-empty string. The port maps it onto the existing `CallbackPayload` (`context.ts:15-20`), unchanged, and returns that payload plus one optional field (`JudgeVerdict`, `ports/subagent-port.ts:32`):

```ts
export interface CallbackPayload {   // context.ts:15-20
  readonly ok: boolean
  readonly exitCode?: number
  readonly output?: string
  readonly value?: InjectedMemories
}

type JudgeVerdict = CallbackPayload & { readonly verdict?: 'pass' | 'fail' }
```

The port sets `ok` and `output` on every path and adds `verdict` only when the reply parsed (`readVerdict`, `:61-71`); it never sets `exitCode` or `value`.

Every terminal state of a spawn produces exactly one callback, so no state can wait on a dead child:

| child outcome | callback |
|---|---|
| judge returns `pass` | `{ ok: true, output: "<reason>", verdict: "pass" }` |
| judge returns `fail` | `{ ok: false, output: "<reason>", verdict: "fail" }` |
| agent id unresolvable / `create` throws | `{ ok: false, output: "spawn-failed: <cause>" }` |
| reply carries no parseable verdict | `{ ok: false, output: "verdict-unreadable: <first 200 chars>" }` |
| `timeoutMs` elapses | `{ ok: false, output: "timeout" }` |
| a spawn is already pending for the session | `{ ok: false, output: "spawn-in-flight" }` |

A crash is not a hang, and a hang is not a crash: all six rows arrive at the same arm pair.

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

No `record{op:'fail'}` is needed: `record_callback` already records a `failure` on `ok: false` (`mem:opencode/state-machine-contract`), and `quality_check_failed` renders its `reason` and `detail` (`definitions.ts:185-188`). Both arms live in one array under `callback.subagent_ready`, pass first, exactly as `check` splits on `callback_ok` (`machine.json:217-251`).

## 4. Lifecycle

| step | what it means | status |
|---|---|---|
| **Creation** | action emits `emit.subagent`; the runner creates the child under the parent session | **built** — `SubagentEmit` is a union member (`core/machine-contract.ts:159-160`, `:201`), `emit.subagent` has a delivery case (`hooks/emit-delivery.ts:40`), `spawn_subagent` builds the emit (`machines/session/action-builders.ts:83-91`), and the runner creates, prompts and reads the child (`ports/subagent-port.ts:88-111`). |
| **In-flight guard** | a second spawn while one is pending must not start a second child | **partly built.** `/` The runner refuses a duplicate with `{ ok: false, output: "spawn-in-flight" }` through its `pending` map keyed by parent session id (`ports/subagent-port.ts:133-141`). `/` The machine cannot see that refusal: it needs a context field recording the pending `reportTo` (added to `COPIERS`, `context.ts:235`, or `boundSnapshot` drops it — `core/snapshot.ts`, rule 7), plus a `spawn_pending` guard (added to `GuardType`, `definitions.ts:138-144`). `/` Precedent for per-session dedupe is `ensure`'s `Deferred` map (`core/machine.ts:845-866`), but it dedupes session *load*, not children. |
| **Timeout / abandonment** | the child never answers | **built.** No core timeout exists for emits, so the runner races `timeoutMs` against the child wait (`Effect.timeoutOption`, `ports/subagent-port.ts:143-150`) and settles `{ ok: false, output: "timeout" }`; `runShell`'s 120 s bound lives in its port (`mem:opencode/state-machine-contract`). |
| **Cancellation** | the turn is interrupted while a child runs | **partly supported.** `system_interrupted` → `parked` is a root arm (`core/machine.ts:948-952`, `mem:opencode/state-machine-contract`), so the machine stops cleanly. Cancelling the *child* is not supported: `parked` has no `callback.subagent_ready` arm (`machine.json:654`), and the child keeps running. A late verdict never reaches XState: `settle` and `settleVerdict` drop a `subagent_ready` callback when no spawn is pending, logging `verdict … dropped, no spawn in flight` (`state-machine.ts:209-231`, `:427-441`). Must be built: cancel on interrupt via `session.remove` (`session.d.ts:143`), and stop `settle` dropping the verdict so a parked arm can record it. |
| **Cleanup on session end** | the parent ends with a child alive | **must be built.** The plugin subscribes to exactly four events — `session.created` (`state-machine.ts:355`), `session.inbox.enqueued` (`:374`), `session.idle` (`:402`), `session.execution.interrupted` (`:421`). No deletion event is handled. Snapshot expiry is 30 days (`core/snapshot.ts:19`) and is not cleanup. Whether the host cascades child deletion on parent removal is **not visible**; the design must not assume it. |

### What core already gives, and what it does not

- **`pending` / `wake` (`core/machine.ts:722`, `:776`, `:783`, `:798-804`) is not reusable here.** It holds entry emits until the first real user item, and `markAwake` clears it on *any* event (`:880-885`). It answers "is the loop awake", not "is a child running".
- **The actor is per-session and keyed by session id.** Every consumer reaches it through `access`, the attach-or-fail accessor in `core/machine-service.ts`: a session with no in-memory entry is restored from its snapshot rather than answered with an empty result, and one that cannot be restored fails instead. The verdict rides the parent's callback, not a read of the child's machine.
- **Transient states** are the right home for a spawn state: `machines/index.ts:33` lists `check`, and restore treats a stored transient as absent (`core/machine.ts:837`). A new `judge` state joins that list, so a reload mid-spawn starts a fresh spawn instead of waiting on a child that the reload forgot.

## 5. Callback naming

**Rule: one name per spawn *purpose*, never per use.** `reportTo` is a parameter, its default is `subagent_ready`, and the two arms are written once for that name. Everything that varies per spawn — pass or fail and the reason — rides the payload, not the name. `quality_check_ready`, `skill_ready` and `memories_ready` follow the same rule (`machine.json:136`, `:177`, `:212`): the name is the port, the payload is the occasion.

How a judge differs from the three existing signals:

- **Nothing new in the event namespace.** All four are `callback.<name>` events (`core/machine.ts:198`, `:218`) with a `CallbackPayload`. `spawn_subagent` is a fourth *source*, not a fourth mechanism.
- **It is not distinguishable in the payload.** A spawned judge returns a `CallbackPayload` plus `verdict`, and `CallbackPayload` carries no correlation field (`context.ts:15-20`). `field_present` reads one payload field (`guard-builders.ts:31`), and no payload value identifies which spawn produced it.
- **Staleness is the one genuinely new condition.** A `skill_ready` has no lifetime; a judge can answer after the state that wanted it is gone. The runner keeps at most one pending spawn per session (`ports/subagent-port.ts:133-141`), so a late verdict is still settled but cannot be told apart from the current one; a `spawn_pending` guard needs a correlator the payload does not carry. **Historical:** an earlier draft of this section gave the payload a `spawnId` field; the shipped type has none (`context.ts:15-20`).

## 6. mem:opencode/state-machine-contract draft

§5 action row:

> | `spawn_subagent` | emits `emit.subagent` and the plugin runs a child agent under the current session; the child's verdict returns as `callback.<reportTo>` (default `subagent_ready`) with `{ ok, output, verdict }` | `{ agent, description, text, skills?, reportTo?, timeoutMs? }` |

§7 prose (3 sentences):

> `emit.subagent` creates a child session under the caller and prompts it with the rendered text plus any skills it names; the judge's `{ verdict, reason }` becomes `{ ok, output, verdict }` on `callback.<reportTo>`, where `pass` sets `ok` and `reason` becomes `output`. Exactly one callback is sent per spawn — create failure, an unreadable verdict and the `timeoutMs` expiry all arrive with `ok: false`, so a state never waits on a dead child. A spawn whose state has been left is still settled, but the payload carries no correlator, so a `spawn_pending` guard cannot yet tell a late callback from a current one.

## 7. Ship now versus wait for a runtime

**Can ship now, as a typed placeholder that is *not* the audit defect:** the `SpawnSubagentParameters` type, the `emit.subagent` union member, the plugin switch case plus a `runSubagent` port whose test implementation returns a canned verdict, one emitting state with the arm pair above, the contract rows, and a unit test proving `pass` reaches `memorize` and `fail` reaches `panic`. That proves the callback plumbing end to end against a fake child — the same standard the `runShell` and `injectSkill` ports are held to today.

**Needs a real subagent runtime:** child cancellation, session-end cleanup, and `spawn_pending` against a live child. The default `runSubagent` body (`ports/subagent-port.ts:88-111`), the `timeoutMs` race (`:143-150`) and the one-spawn-per-session guard (`:133-141`) are implemented, and the harness drives them against a fake session (`tests/helpers/state-machine/harness.ts:212-224`).

**Does declaring it as a placeholder risk the audit defect?** Yes, exactly, unless the arm ships in the same change. `request_dispatch` was declared, typed and handled by the plugin, and no arm emitted it (`REFACTOR-PROPOSAL.md:15-19`); the plugin code for it is still there at `state-machine.ts:206-242` and is dead. An action with no arm is the same defect with a new name, and a green suite would not notice — the suite has no test that every declared action is emitted by some arm.

**Recommendation:** ship it reachable — one state (`towards_goal.judge`, transient) emits it, the arm pair exists, and the fake port proves both branches — then land the real port body as a second change behind the same contract. The contract and the arms do not move between the two changes.

**Rejected alternative:** declare the action, the emit variant and the plugin case now, and add the emitting state "when a judge agent exists". That is `request_dispatch` reproduced: a handled emit nobody raises, plus a CONTRACT paragraph explaining that nothing raises it (`mem:opencode/state-machine-contract`).

## 8. Two forks to settle

1. **Which state owns the spawn.** Two readings: `validate` *becomes* the spawn (the self-report prompt at `machine.json:254-261` is replaced by a judge child, and `GOAL_ACHIEVED`/`GOAL_INCOMPLETE` disappear from that state), or `judge` is a new transient sibling between `check` and `validate`, leaving the self-report in place. The first removes a round-trip and rewrites the two existing arms; the second adds a state and keeps both paths testable. They produce different `machine.json` diffs, so the choice is not cosmetic.
2. **Who reads the verdict.** The port parses the child's final message (needs a message-read call whose availability I could not confirm — **not visible**), or the child is prompted to send a signal that the plugin translates into the parent's callback (today "a child's signals never reach the parent", `state-machine.ts:207`). The port signature is identical either way; the failure modes are not — message parsing fails on prose, signal bridging fails if the child's loop is not the machine under test.
