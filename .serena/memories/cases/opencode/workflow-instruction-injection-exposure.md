---
id: cases/opencode/workflow-instruction-injection-exposure
type: cases
L0: "Gated on tools.includes('workflow'); Code Mode surfaces plugin tools only as execute, so the gate never fired; a live log proves it."
hotness: 0.8
ttl: 180d
version: 2
freshness: 2026-10-20
directory: cases/opencode
claim_ids: [claims/opencode/plugin_e2e_harness_recipe]
provenance: architecture/adr/ADR-010-workflow-tool-instruction-injection
---
# Workflow instruction injection: Code Mode exposure and live proof

## Context
ADR-010 injects the task-delegation instructions when the workflow tool is available.
Source: mem:architecture/adr/ADR-010-workflow-tool-instruction-injection.

## Symptom
- Plugin logged `workflow.instructions.loaded` (9,499 bytes) but never `workflow.instructions.injected`.
- Unit tests were green, so the gate looked correct.

## Investigation
- `opencode session export` has no system prompt, so export cannot show injection.
- Instrumentation showed `event.tools` = [edit, glob, goal, grep, question, read, shell, skill, subagent, webfetch, websearch, write, execute] for an allow-all agent.
- `workflow` never appears because plugin tools are surfaced through Code Mode `execute`.

## Root cause
The gate checked `tools.includes("workflow")`; that name is not model-visible.

## Fix
`WORKFLOW_EXPOSURE_TOOLS = ["workflow", "execute"]`, gate on the first match, log `exposure`.

## Proof
Standalone session logged `workflow.instructions.injected blockBytes=9560 tools=[...] exposure=execute stripped=false`;
9,499 plus a 61-byte wrapper equals 9,560.
injected is info; context and skipped are debug with skipped carrying only tools; nothing truncates the block, so blockBytes is uncapped.

## Lessons
- Test under an agent that exposes the tool; a mocked tool list proves nothing.
- A completed run plus its branch log is proof; `session export` is not.
- Gate on exposure, not registration.
- Injected is info and carries blockBytes/tools/exposure/stripped; context and skipped are debug, and skipped carries only tools, so a silent no-op needs debug logging.
- Config belongs in `harness.config.ts`; auto-discovered plugins receive empty options.

## Links
- mem:architecture/adr/ADR-010-workflow-tool-instruction-injection
- mem:claims/opencode/plugin_e2e_harness_recipe
- mem:troubleshooting/opencode-plugin-live-diagnosis
- .opencode/instructions/opencode-plugin-interfaces.instructions.md