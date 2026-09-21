---
id: claims/opencode/workflow_progress_transport
type: claims
L0: "Working live-progress transport for an OpenCode plugin tool (1.18.18): client.tui.showToast milestones, client.session.update child titles, and the tool result title/output/metadata at completion only"
hotness: 0.8
ttl: 60d
version: 1
freshness: 2026-09-21
directory: claims/opencode
provenance: operator-verified live session 2026-09-21 (opencode 1.18.18)
claim_ids: [claims/opencode/sdk_subagent_spawn]
---
# Workflow live-progress transport

Claim: the working live-progress transport for an OpenCode plugin tool (1.18.18) is (a) milestone toasts, (b) child-session titles, and (c) the tool RESULT that renders at completion only.

## Channels
- Toasts: client.tui.showToast({body:{title,message,variant,duration}}).
- Child titles: client.session.update({path:{id}, body:{title}}). The v1 param key is path.id; the v2 shape uses sessionID.
- Result: the tool RESULT {title, output, metadata} renders at completion only.

## Formats
- Run id: wf#<6 hex>, generated once per run.
- Start toast: started · wf#<id>
- Milestone: <status> <ok>/<total> · wf#<id> · <description> (status is ok or the failing status; the leading token must reflect outcome).
- Terminal ok: workflow ok · <ok>/<n> subtasks · wf#<id> · <n>.<d>s
- Timeout: workflow timed out after <n>ms · wf#<id>
- Abort: workflow aborted · wf#<id>
- Other: workflow <status> · wf#<id> · <reason>
- Child titles: wf#<id> · [running] <desc>, then wf#<id> · [ok]|[error]|[aborted] <desc> (desc capped 80).

## Result metadata
Includes a bounded per-subtask table {description,status,durationMs} derived from the serialized envelope steps; it can be shorter than executed if the 8KB trim drops steps.

## Guard
All client I/O must be guarded and bounded so a hung or failing call never stalls or fails a run.

Source: live session 2026-09-21. Evidence: cases/opencode/tool_context_metadata_inert. See architecture/adr/ADR-003-tag-delimited-structured-output, claims/opencode/sdk_subagent_spawn.