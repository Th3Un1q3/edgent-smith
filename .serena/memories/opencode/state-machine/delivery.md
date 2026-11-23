---
id: opencode/state-machine/delivery
type: entities
L0: "Contract part 7: ports (runShell, injectSkill, loadMemories, runSubagent), emit delivery order, callback contract, judge spawn and the two host event wirings."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/actions, opencode/state-machine/persistence]
---

# Contract 7 — ports and delivery

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/actions; next mem:opencode/state-machine/persistence.

## 7. Ports and delivery
- `createStateMachinePlugin(loadLibrary, ports)` takes four optional ports; the tests replace every one.
- `runShell(command,cwd)` — `bash -c`, 120 s timeout, 4 MiB buffer.
- `injectSkill(sessionId,name)` — `session.prompt({ text: '', skills: [{ id }] })`.
- `loadMemories(namespace)` — empty `{ full: [], index: [] }`.
- `runSubagent({parentID,agent,text,timeoutMs})` — `session.create` under the parent, `session.prompt`, then `session.wait`; a host missing the facility refuses with `spawn-failed: subagent-port-unavailable`.
- The plugin delivers each emit in order: `emit.prompt` and `emit.signals` become `session.synthetic`; `emit.subagent` runs a child through the port and sends its verdict as `callback.<reportTo>`; `emit.shell` runs the command and sends its result; `emit.skill` injects and sends `callback.skill_ready`; `emit.memories` reads and sends `callback.memories_ready` with `value`.
- A failed port reports `{ ok: false }` through the callback instead of throwing.
- `emit.signals` renders `machine.signalLine(sessionId, signal_keys)` with the fixed description "The session loop is listing the signals this state accepts.".
- Every `emit.prompt` carries the one-line description its action declared, sent as the synthetic's description; `promptDescription(emit)` falls back to `Sent synthetic message: <first 20 characters>...`.
- `signal_send` returns `Signal accepted.` for an accepted signal; a refusal is a `Tool.Error` carrying the rendered message and the structured refusal in `metadata`, catchable and retryable inside a Code Mode block.
- `emit.subagent` creates a child session under the caller and prompts it with the rendered text; the judge's `{verdict,reason}` becomes `{ok,output,spawnId}` on `callback.<reportTo>`, where `pass` sets `ok` and `reason` becomes `output`.
- Exactly one callback is sent per spawn: a refused port, an unreadable verdict and the `timeoutMs` expiry all arrive with `ok: false`, so a state never waits on a dead child.
- A verdict that arrives with no spawn in flight is dropped without a transition.
- `validate` emits one `spawn_subagent` entry action: agent `judge`, a literal text carrying the JSON verdict instruction, `reportTo` `subagent_ready`, 120 s timeout; `pass` → `memorize`, `{ok:false,verdict:"fail"}` recorded → `panic`, unavailable port or timeout recorded → stays `validate`.
- `system_user_input` is a machine event with entry point `userInput(sessionId,text)`; the plugin raises it from `session.inbox.enqueued` for a real user item, after opening the session and delivering any held goal request, so a `parked` or `panic` session restarts on the next message.
- `system_interrupted` is wired: subscribe `session.execution.interrupted`, keep only the four reasons and drop any other, send `machine.interrupted(sessionId,reason)`, deliver the emits; an interruption for a session the loop never opened is dropped rather than opening one.