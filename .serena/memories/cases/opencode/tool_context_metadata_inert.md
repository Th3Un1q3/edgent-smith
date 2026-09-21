---
id: cases/opencode/tool_context_metadata_inert
type: cases
L0: "OpenCode plugin tool context.metadata() returns an unexecuted Effect; it never updates the running tool part. Use client.tui.showToast + client.session.update instead"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-21
directory: cases/opencode
provenance: operator-verified live session 2026-09-21 (opencode 1.18.18)
claim_ids: [claims/opencode/workflow_progress_transport]
---
# ToolContext.metadata is inert

## Symptom
Implementing live tool progress via context.metadata({title, metadata}) (typed in @opencode-ai/plugin tool.d.ts) produced no visible UI change.

## Root cause
context.metadata(...) returns an UNEXECUTED Effect object ({_id:Effect, op:WithFiber, ...}) that the plugin tool wrapper never runs; it neither throws nor updates the running tool part, so state.title stays null.

## Evidence (2026-09-21, opencode 1.18.18)
- Runtime probe: typeof context.metadata === function and metadataResult captured as an Effect object.
- Read-only SQLite probe: running tool part state.title stayed null; only 2 message.part.updated events fired across a 255s run (a 1s heartbeat would produce hundreds).

## Fix
Use client.tui.showToast(...) and client.session.update(...) (child-session titles) instead.

## Caveats
- context.client does NOT exist; use the outer-closure client of the plugin.
- Plugin tools cannot render the built-in inline task subagent block: that view is hard-gated to literal tool name task plus state.metadata.{sessionId,parentSessionId}.

## Lesson
Unit-green is not live-working: tests asserted the callback was CALLED, but the runtime discarded its result.

Source: live session 2026-09-21. See claims/opencode/workflow_progress_transport, troubleshooting/opencode-plugin-live-diagnosis.