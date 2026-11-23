---
id: opencode/state-machine/host-effects
type: entities
L0: "Contract part 9: reset semantics for real user messages, and the host effects behind emit.memories, emit.skill, emit.signals and the retired emit.dispatch."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/persistence, opencode/state-machine/decisions]
---

# Contract 9 — user reset and host effects

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/persistence; next mem:opencode/state-machine/decisions.

## 10. User-message reset
- `session.inbox.enqueued` is subscribed beside the session events; only `data.item.type === 'user'` is delivered: the handler sends `system_user_input` with the text, delivers the emits, then persists.
- `synthetic`, `compaction` and `move` items are ignored, so a plugin-sent prompt or a steering message can never reset the loop.
- `parked` and `panic` answer a user item by raising `reset_goal`, which `towards_goal` handles by clearing `goal`, `intent` and `attempts` and entering `define_goal`.
- `define_goal`, `work`, `check`, `validate` and `memorize` have no arm and keep their state.
- The reset keeps `memories`, `improvements`, injected skills, injected values and `results`.
- A handler failure is caught, so one bad item cannot end the subscription.

## 11. Host effects
- `emit.dispatch` is retired: no state emits it; the plugin answers with a failed `subagent_ready` naming its replacement, `emit.subagent`, and `{ ok: false }`.
- `emit.memories` → `readMemories(context.location.directory, namespace)` in `core/memory.ts` → `{ ok: true, value }`, empty when the file is missing, `{ ok: false }` when unreadable.
- `emit.skill` → `session.prompt` with the skill → `{ ok: true }` or `{ ok: false }`.
- `emit.signals` → no host call; renders `machine.signalLine` and sends a synthetic.
- `core/memory.ts` reads `<directory>/.serena/memories/<namespace>.md` directly, with no MCP and no gateway.
- The namespace is checked segment by segment: `..`, a leading `/`, a backslash and an empty segment are refused.
- Level-2 headings become the index; list bullets become the full entries.