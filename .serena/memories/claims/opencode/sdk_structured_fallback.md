---
id: claims/opencode/sdk_structured_fallback
type: claims
L0: "Workflow subtask schema output: primary is one <result_json> block via parseTagged (scan last-to-first, strip inner fence, JSON.parse); stripCodeFence+JSON.parse is fallback; <response_schema> remains schema block"
hotness: 0.85
ttl: 60d
version: 2
freshness: 2026-09-21
directory: claims/opencode
confidence: 0.92
status: active
claim_ids: [claims/opencode/sdk_subagent_spawn, claims/opencode/sdk_structured_output]
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---

fact: When body.format is rejected, workflow subtasks obtain structured output through a prompt tag contract plus parse, not through a full JSON-Schema validator.
contract (implemented in .opencode/plugins/helpers/workflow-subtask.ts):
- Append schemaBlock to the prompt: schema-instruction text plus a <response_schema> JSON block (SCHEMA_INSTRUCTION / SCHEMA_RETRY_INSTRUCTION).
- PRIMARY parse path: extract one <result_json> ... </result_json> block with parseTagged/parseStructured - scan tagged blocks from the LAST opening tag to the FIRST, slice, trim, strip an inner code fence, JSON.parse (first success wins).
- FALLBACK parse path: whole-text stripCodeFence then JSON.parse when no tag block parses.
- A reply is usable only when schema.required is a non-empty string array and every key is an own property of the parsed object (hasRequiredKeys); otherwise unusable.
- Allow at most ONE same-session corrective follow-up (runTurn retry); skip the retry on timeout, parent abort, info.error, or empty text.
- Status mapping: unusable parse -> status error; empty text -> status empty; success -> status ok with data = parsed value.
- outputText is truncated (truncateOutput/MAX_STEP_OUTPUT_CHARS); data is the untruncated parsed value.
- Limitation: presence-only required check; no additionalProperties, type, or nested-schema enforcement.
Verification: real E2E exercised structured fan-out->reduce and data-driven branching.
Source: workflow-subtask.ts (parseTagged/parseStructured/hasRequiredKeys/runTurn/classifyResponse). Cross-refs: mem:architecture/adr/ADR-003-tag-delimited-structured-output, mem:claims/opencode/sdk_subagent_spawn, mem:cases/opencode/sdk_skills_injection.