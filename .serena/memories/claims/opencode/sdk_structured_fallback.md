---
id: claims/opencode/sdk_structured_fallback
type: claims
L0: "Workflow subtask schema fallback: response_schema prompt block, strip code fences, JSON.parse, required-key check, max one corrective retry; data untruncated"
hotness: 0.85
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.92
status: active
claim_ids: [claims/opencode/sdk_subagent_spawn, claims/opencode/sdk_structured_output]
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---

fact: When body.format is rejected, workflow subtasks obtain structured output through a prompt contract plus parse, not through a full JSON-Schema validator.
contract (implemented in .opencode/plugins/helpers/workflow-subtask.ts):
- Append schemaBlock to the prompt: instruction text plus a <response_schema> JSON block (SCHEMA_INSTRUCTION / SCHEMA_RETRY_INSTRUCTION).
- Parse with stripCodeFence then JSON.parse; a reply is usable only when schema.required is a non-empty string array and every key is an own property of the parsed object (hasRequiredKeys); otherwise unusable.
- Allow at most ONE same-session corrective follow-up (runTurn retry); skip the retry on timeout, parent abort, info.error, or empty text.
- Status mapping: unusable parse -> status error; empty text -> status empty; success -> status ok with data = parsed value.
- outputText is truncated (truncateOutput/MAX_STEP_OUTPUT_CHARS); data is the untruncated parsed value.
- Limitation: presence-only required check; no additionalProperties, type, or nested-schema enforcement.
Verification: real E2E exercised structured fan-out->reduce and data-driven branching.
Source: workflow-subtask.ts (parseStructured/hasRequiredKeys/runTurn/classifyResponse). Cross-refs: mem:claims/opencode/sdk_subagent_spawn, mem:cases/opencode/sdk_skills_injection.