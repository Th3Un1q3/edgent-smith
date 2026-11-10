---
id: conventions/opencode-plugin-append-only-context
L0: "OpenCode plugin changes stay append-only: add an entry, message, or file instead of rewriting context already sent, so the provider's cacheable prefix survives every later turn."
freshness: 2026-10-28
provenance: /workspace/.opencode/plugins/instructions-loader.ts; /workspace/.opencode/plugins/workflow.ts; /workspace/.opencode/instructions/steering-message.md; mem:architecture/adr/ADR-022-append-only-steering-message-injection (read 2026-10-28)
---

# OpenCode plugin changes are append-only

## Principle

Extend established context; do not rewrite it. A plugin change adds a new entry, a new message, or a new file rather than mutating a per-request system prompt or editing a message that has already been sent.

The reason is mechanical, not stylistic: the inference provider caches the request prefix. A mutation anywhere in that prefix discards the cacheable prefix for every later turn, so the provider recomputes the whole prompt instead of taking a cache hit. An append leaves the earlier bytes intact and stays inside the cached prefix.

## Scope

The principle binds every layer this repository controls:

- **Instruction loader** — `/workspace/.opencode/plugins/instructions-loader.ts`. Guidance reaches the session by adding a keyed entry or an appended steering block; it never rewrites the instruction sequence already in place.
- **Workflow instruction injector** — `/workspace/.opencode/plugins/workflow.ts`. Guidance is written as one session-scoped instruction entry under a fixed key (`writeEntry(sessionID, WORKFLOW_ENTRY_KEY, options.block)`, `:150`; `WORKFLOW_ENTRY_KEY = 'workflow.instructions'`, `:38`) and removed when the agent leaves the allowlist (`removeEntry`, `:144`). It is never spliced into the system array: the file declares no `.hook(` and its comment states "there is no system-prompt carrier and no fallback" (`:244-246`).
- **Any plugin added later** — including its helpers, config, and prompt payloads. New capability means a new entry, message, or file; a correction means a new block that says what it supersedes.

## Review question for a plugin PR

> Does this change add to the context, or does it rewrite bytes that were already established? If it rewrites, can the same effect be reached by appending a new entry, message, or file?

A change that answers "rewrites, and cannot append" is not automatically rejected. It is a claim that must name the cost — the discarded prefix and the recomputation it forces on every later turn — so a reviewer can weigh it.

## Correction without mutation

Retracting earlier guidance stays append-only: emit a new block that states what it supersedes. Editing the earlier block so it looks as if it always said the new thing trades a cheap append for a cache miss and an unattributable transcript.

## Related

- Decision record: `mem:architecture/adr/ADR-022-append-only-steering-message-injection`. It carries the options, criteria, and decision; this memory carries the standing rule and does not restate that analysis.
- Steering mechanics and narration of change and removal: `.opencode/instructions/steering-message.md`, section "Adding a New Steer Message".
- Adjacent authoring conventions: `mem:claims/opencode/plugin_conventions`.
- Convention-change propagation (rule, template, domain about, and index update together): `mem:harness/delegation/convention-change-propagation`.
