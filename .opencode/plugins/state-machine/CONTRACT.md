# Contract: self-improving loop machine

The binding shape of the session machine lives with the machine, in `machines/session/`: `machine.json` carries
the definition, `signals.manifest.json` the signal declarations, `definitions.ts` the action and guard bodies,
the template texts, the signal codecs and the machine's own helpers, and `context.ts` the context shape, its
defaults, the snapshot field allowlist and its limits. `machines/index.ts` is the registry (`MachineModule`,
`MACHINES`, `DEFAULT_MACHINE`), where each entry carries `{ id, definition, manifest, transientStates,
definitions, contexts }`, and the module also exports the default snapshot codec, the default state ids and the
callback names. `core/` holds the assembler `core/machine.ts` and the generic signal engine `core/signals.ts`,
plus generic infrastructure shared across machines; it defines no session field, state, signal, template,
callback or machine id. The plugin that drives the loop is `.opencode/plugins/state-machine.ts`.

The structure is extensible by addition: a new machine is a directory under `machines/` holding `machine.json`,
`signals.manifest.json`, `definitions.ts` and `context.ts`, plus one registry entry in `machines/index.ts` that
wires all four. `core/` is not edited to add a machine.
Tests in `.opencode/plugins/tests/state-machine.test.ts` hold the same claims.

## 1. Effects have three dispositions

1. **State only.** A pure `assign`: set the goal, increment an attempt, push a lesson. No event, no callback.
2. **Outbound, no answer.** `prompt` and `dispatch` emit; the plugin turns the emit into a synthetic message.
   Nothing comes back, because the reply arrives later as an ordinary agent signal.
3. **Outbound, answer required.** A shell run, a skill injection, a memory read. The action emits; the plugin
   performs the work and sends `callback.<name>` back into the actor. The callback arm records the payload in
   `context`, and later arms read it.

Dispositions 2 and 3 share one mechanism — an `emit` the plugin observes — and differ only in whether a callback
is expected. The actor never performs I/O and never blocks.

**Guards run before a transition's actions.** A guard cannot read a value that its own arm is about to record.
`callback_ok` therefore tests the callback event's `payload.ok`; `record_callback` stores the same payload for
later arms and for diagnostics.

## 2. Event vocabulary

- `agent_sent_signal.*` — the only tool-reachable family: `SET_GOAL`, `CLAIM_WORK`, `GOAL_ACHIEVED`,
  `GOAL_INCOMPLETE`, `LESSON`. Each event carries `{ type, payload? }`; `SET_GOAL` uses `payload.goal` and
  `LESSON` uses `payload.text`. Payloadless signals carry no payload; any payload they receive is dropped.
- `emit.*` — raised by actions, never by the model: `prompt{text}`, `dispatch{agent, text}`, `shell{cmd,
  reportTo}`, `skill{name, reportTo}`, `memories{namespace, reportTo}`, `signals{signal_keys?}`.
- `callback.*` — sent by the plugin after its async work: `callback.quality_check_ready`, `callback.skill_ready`,
  `callback.memories_ready`, the machine's `CALLBACK_NAMES` from `context.ts`, each with `{ok, exitCode?, output?, value?}`.
- Host events: `system_idle`, `system_user_input`, `system_interrupted{reason}` where `reason` is one of `user`,
  `shutdown`, `superseded` or `inactivity`.

`signal_send` maps its `type` to `agent_sent_signal.<TYPE>` and validates `payload` against the declaration of that
signal in the current state. `emit.*`, `callback.*` and `system_*` are not reachable from the tool.

## 3. Context

`context.ts` declares `LoopContext`, the fresh and restored defaults and the snapshot field list; core treats the
context as an opaque record and reads no field by name.

| key | written by | read by |
|---|---|---|
| `goal` | `SET_GOAL` record | work, park and panic prompts |
| `intent` | validate, memorize, panic arms | memorize prompt, improvement guard |
| `attempts` | `GOAL_INCOMPLETE` under the limit | `counter_below` in validate |
| `memories` | lessons from work, memorize and panic | work prompt |
| `improvements` | the improvement lesson | park summary |
| `injectedSkills` | `mark_skill` after `callback.skill_ready` | `request_skill` |
| `injected` | `record_callback` when the payload carries `value` | work prompt (`preferences/user`) |
| `results` | every `record_callback` | `callback_ok`, diagnostics |
| `policy` | `set_tools_policy` on `define_goal` entry, `clear_tools_policy` on its exit; restored from the snapshot | the tool gate |
| `failure` | `fail`, a failed callback | panic prompt |
| `maxAttempts`, `memoryLimit` | initializer | attempt guard, `push` cap |

## 4. States and transitions

There is no final state. Every transition is evented; there is no `always` and no `after`.

| state | entry | transitions |
|---|---|---|
| `define_goal` | prompt `goal_request`; `update_signals_policy`; request `preferences/user` memories; install the tool policy | `SET_GOAL` → `work` (records `payload.goal`); `callback.memories_ready` → self (records value) |
| `work` | prompt `work_towards_goal`; `update_signals_policy`; request `task-delegation` when absent | `CLAIM_WORK` → `check`; `callback.skill_ready` → self (records, marks skill); `callback.memories_ready` → self |
| `check` | run `just opencode::typecheck` | `callback.quality_check_ready` [`callback_ok`] → `validate`; otherwise → `panic` with the failure |
| `validate` | prompt `validation_self_report`; the loop agent answers with one of the signals | `GOAL_ACHIEVED` → `memorize` (intent improvement); `GOAL_INCOMPLETE` [`counter_below`] → `memorize` (attempt + 1, intent lesson); otherwise → `panic` (attempts exhausted) |
| `memorize` | prompt by intent; `update_signals_policy` | `LESSON` [improvement] → `parked` (push improvement); `LESSON` [text present] → `work` (push lesson) |
| `parked` | prompt `park_summary` | `system_user_input` → `define_goal` (reset goal, intent, attempts, idle count) |
| `panic` | entering arm prompts with the failure; entry `update_signals_policy` | `LESSON` [text present] → `work` (push lesson, reset attempts); `system_user_input` → `define_goal` (reset) |

`check` is transient: it exists only between `CLAIM_WORK` and the shell callback. `system_idle` is one arm on the machine root, not a per-state
arm: it targets `validate` under `not_parked`, so an idle in any working state reaches goal evaluation, `check` included, while an idle in
`parked` neither changes state nor emits.

`system_interrupted` → `parked` is a single arm on the machine root, guarded by "not already in `parked`", so
`define_goal`, `work`, `check`, `validate`, `memorize` and `panic` all park on it, `panic` included, because taking
control is not a failure. In `parked` the guard fails, so the event there neither changes state nor emits.
`session.execution.failed` is not an interruption and keeps the panic path.

## 5. Actions

| action | disposition | params |
|---|---|---|
| `prompt` | emits `emit.prompt` with its description | `{ template, description }` |
| `update_signals_policy` | sets the enabled signal set for `stateId`; emits `emit.signals` with those keys only when `notify_agent` is true | `{ stateId, set_enabled_signals, notify_agent }` |
| `request_dispatch` | emits `emit.dispatch` | `{ agent }` |
| `record` | assigns `set`, `increment` or capped `push` from a payload field or a literal | `{ op, key, source }` |
| `request_shell` | emits `emit.shell` | `{ cmd, reportTo }` |
| `request_skill` | emits `emit.skill` only when the name is absent | `{ name }` |
| `request_memories` | emits `emit.memories` | `{ namespace }` |
| `record_callback` | stores `results[reportTo]`, folds `value` into `injected[key]`, records `failure` on `ok: false` | `{ reportTo, key? }` |
| `mark_skill` | appends the skill name once | `{ name }` |
| `set_tools_policy` | assigns `policy` when the context carries none | `{ stateId, allowedTools, errorMessage }` |
| `clear_tools_policy` | clears `policy` | none |
| `fail` | records a `failure` | `{ reason, detail? }` |

`update_signals_policy` enables each manifest signal named in `set_enabled_signals`, or maps a new name to
`{ description, schema }`, where `schema` names the manifest signal whose codec validates it. `stateId` is supplied
by the workflow definition because XState forbids reading the actor snapshot while it initialises. An explicit empty
`set_enabled_signals` enables no signal for that state, while a state that sets no policy at all falls back to the
signals its `on` arms declare.

`request_skill` carries its own absence check because `entry` actions cannot be guarded. The guard rule still holds
everywhere a transition can express the condition.

## 6. Guards

| guard | tests | params |
|---|---|---|
| `field_present` | the named payload field is a nonblank string | `{ field: 'goal' \| 'text' }` |
| `counter_below` | a context counter is under a limit, which may be another context field | `{ key: 'attempts', limit }` |
| `improvement_lesson` | the intent is `improvement`; the `LESSON` schema has already refused blank text | none |
| `callback_ok` | the callback event reports success | none |
| `not_parked` | the machine is not in `parked` | none |

## 7. Ports and delivery

`createStateMachinePlugin(loadLibrary, ports)` takes three optional ports; the tests replace all three:

| port | default |
|---|---|
| `runShell(command, cwd)` | `bash -c`, 120 s timeout, 4 MiB buffer |
| `injectSkill(sessionId, name)` | `session.prompt({ text: '', skills: [{ id }] })` |
| `loadMemories(namespace)` | empty `{ full: [], index: [] }` |

The plugin delivers each emit in order: `emit.prompt`, `emit.dispatch` and `emit.signals` become
`session.synthetic` (a dispatch checks that the validator agent exists, creates a child, and falls back to the
self-report synthetic when the agent is unavailable or creation fails); `emit.shell` runs the command and sends its
result; `emit.skill` injects and sends `callback.skill_ready`; `emit.memories` reads and sends
`callback.memories_ready` with `value`. A failed port reports `{ ok: false }` through the callback instead of
throwing. `emit.signals` renders `machine.signalLine(sessionId, signal_keys)` with the fixed description
`"The session loop is listing the signals this state accepts."`.

Every `emit.prompt` carries the one-line description its action declared, and the plugin sends it as the synthetic's
description, which the session view shows beside the message. `promptDescription(emit)` falls back to
`Sent synthetic message: <first 20 characters>...` for a prompt emit that supplies none.

`signal_send` returns `Signal accepted.` for an accepted signal. A refusal is a `Tool.Error` carrying the rendered
message and the structured refusal in `metadata`; the agent can catch it inside a Code Mode block and retry.

No state currently emits `dispatch`; `validate` prompts the loop agent for its verdict directly. The dispatch
capability remains available for a future validator child.

`system_user_input` is a machine event with a `userInput(sessionId, text)` entry point. The plugin raises it from
`session.inbox.enqueued` for a real user item, after opening the session and delivering any held goal request, so a
`parked` or `panic` session restarts on the next message; §10 covers which items are delivered.

`system_interrupted` is wired: the plugin subscribes to `session.execution.interrupted`, keeps only the four reasons
and drops any other before it reaches the machine, then sends `machine.interrupted(sessionId, reason)` and delivers
the emits. An interruption for a session the loop never opened is dropped rather than opening one.

## 8. Snapshot persistence

`core/snapshot.ts` persists one JSON value per session under `state-machine/<sessionId>`; the session's
`context.ts` owns what that value may contain. `snapshotCodec` (exported as `DEFAULT_SNAPSHOT`) supplies the
allowlisted field set and the text limit, and the store binds and reads through it without naming a field.

- `createSnapshotRecord` writes the allowlisted field set plus `storedAt` and `expiresAt` (30 days). Memories are
  idempotency keys (`mem:<path>:complete`, `mem:<path>:ref`, `skill:<name>:complete`), results are stored whole so a
  workflow can read command output, and only the goal text is capped. Any other context key is dropped.
- `parseSnapshotRecord` validates the known shape, ignores unknown fields, and returns `'expired'` or
  `'shape-invalid'` when the record is unusable.
- `SnapshotStore.read` returns `present`, `absent` (`missing` | `expired` | `shape-invalid`) or `rejected`;
  `write` resolves `false` when the store rejects it and never fails the caller.

`StateMachine.ensure(sessionId, agent)` reads the snapshot on a session's first access and shares one read between
concurrent callers:

| read result | outcome |
|---|---|
| `present` | actor restored from the stored state and context, `policy` included; entry actions run again and only their emits are dropped |
| `present` in `check` | treated as absent: `check` is transient, and restoring into it would wait for a callback that no longer exists |
| `absent` (missing, expired or malformed) | actor created at the agent's configured start state with a fresh context |
| `rejected` | no actor; the session's gate allows until a later signal starts it |

`StateMachine.persist(sessionId)` returns `written`, `skipped` (no machine or no store) or `write-failed`; the plugin
calls it after a signal, a callback and an idle event, and logs `write-failed` without the payload. A rejected write
keeps the previous record.

The plugin registers `execute.before` and logs `{ tool, input keys }`, never the payload.

## 9. Tool policy gate

The loop declares the one rule in its own definition: `define_goal`'s entry action `set_tools_policy` allows
`signal_send`, `execute`, `question` and `skill`, and its exit action `clear_tools_policy` removes the rule. The rule
lives in the machine context as `policy`, so a transition keeps it in step and the snapshot carries it. Every other
state declares no rule, so every tool passes there. `set_tools_policy` writes the declaration only when the context
carries no policy yet, so a restored snapshot's own `policy` wins over it.

`core/policy.ts` owns only the decision: `decide({ agent, isChild, state, policy, tool })` allows when the agent is not
`rug`, the session has a parent, no rule is active, or the tool is listed; otherwise it returns the rule's message with
`<name>` and `<state>` substituted.

The plugin registers `execute.before`, logs `{ tool, input keys }`, returns early for another agent or a child session,
opens the session's machine, then decides from that machine's state and policy. A block fails the hook with
`Tool.Error` carrying the message and `metadata = { code: 'tool_blocked', tool, state, allowed_tools }`, so the call
never runs. `parentID` is read once per session through `context.session.get` and cached; opening awaits the memoised
restore, so the first call after a reload is gated by the restored policy.

## 10. User-message reset

`session.inbox.enqueued` is subscribed beside the session events. Only `data.item.type === 'user'` is delivered: the
handler sends `system_user_input` with the text, delivers the emits, then persists. `synthetic`, `compaction` and `move`
items are ignored, so a plugin-sent prompt or a steering message can never reset the loop.

`parked` and `panic` reset to `define_goal`; `define_goal`, `work`, `check`, `validate` and `memorize` have no arm and
keep their state. `resetRound` clears goal, intent, attempts and idle count, and keeps memories, improvements, injected
skills, injected values and results. A handler failure is caught, so one bad item cannot end the subscription.

## 11. Host effects

| emit | host call | callback |
|---|---|---|
| `emit.dispatch` | dormant: no state emits it; when used, `session.create` with the validator agent, then `session.prompt`; a missing agent or a failed create sends the self-report synthetic | none: a child's signals never reach the parent |
| `emit.memories` | `readMemories(context.location.directory, namespace)` in `core/memory.ts` | `{ ok: true, value }`, empty when the file is missing, `{ ok: false }` when unreadable |
| `emit.skill` | `session.prompt` with the skill | `{ ok: true }` or `{ ok: false }` |
| `emit.signals` | none; renders `machine.signalLine` and sends a synthetic | none |

`core/memory.ts` reads `<directory>/.serena/memories/<namespace>.md` directly — no MCP, no gateway. The namespace is
checked segment by segment (`..`, a leading `/`, a backslash and an empty segment are refused). Level-2 headings become
the index, list bullets the full entries.

## 12. Decisions

- **An attempt is a `GOAL_INCOMPLETE` reaching `validate`.** Only that signal, under the limit, increments `attempts`; an idle routes to
  `validate` with no action, so it adds no attempt. The fourth failure enters `panic` with `failure.reason = 'attempts exhausted'`.
- **Panic is diagnostic.** It is entered by attempts exhausted and a failed quality check; an idle cannot enter it, because idle routes to
  `validate`. Each arm records the reason before prompting. `panic` is not a dead end: a lesson retries, user input starts over.
- **Parking replaces ending.** An improvement lesson parks the loop; the summary is sent once; the next user input
  resets the round and returns to `define_goal`.
- **Skills and memories are events, not local state.** The context keeps only what came back: `injectedSkills` and
  `injected`.
- **The loop renders what it remembers.** `work` re-renders `memories` on every entry, and `record` caps the list at
  `memoryLimit`.
- **One state library import site.** `loadStateMachineLibrary` owns the dynamic `import('xstate')`; the rest of the
  module receives the library.
- **The state surface is the library's own.** States and transitions use the library's `MachineConfig` and
  `TransitionConfig`, so a state naming an unknown event or an arm carrying a rejected key fails the typecheck. Action
  and guard payloads stay local unions (`ActionSpec`, `GuardSpec`), because their bodies live in `machines/session/definitions.ts`
  and are registered through `createActions` and `createGuards`; naming the setup maps' parameterised types here
  would need `setup` at module scope.
- **Signals are derived per state.** No state config carries a `signals` block: the table comes from the signals the
  state's `on` arms carry, described by that machine's own `signals.manifest.json` beside its `machine.json`, plus any
  set `update_signals_policy` enables.
  `validateSignal` enforces shape, vocabulary, declaration and payload; `assertSignalDeclarations` fails
  `createStateMachine` when a declaration and its transition arms disagree.
- **Refusals are errors; acceptance is neutral.** A refusal is `Tool.Error` with `message` and `metadata`. An
  accepted signal returns `Signal accepted.`; the next prompt carries the guidance.
- **Advertising is explicit.** `update_signals_policy` emits `emit.signals` only when `notify_agent` is true; the
  plugin sends a separate synthetic.
  Undeclared `signal_keys` are omitted at render time. `TOOL_SIGNALS` lives in `core/signals.ts` and is re-exported
  by `core/machine.ts`.
- **The verdict is self-reported.** `validate` prompts the loop agent for `GOAL_ACHIEVED` or `GOAL_INCOMPLETE`; it
  does not create a validator child. The dispatch capability remains unused.
