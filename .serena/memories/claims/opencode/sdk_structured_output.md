---
id: claims/opencode/sdk_structured_output
type: claims
L0: "Native body.format JSON-Schema exists but opencode-go/deepseek-v4.1-flash thinking mode rejects forced tool_choice; workflow subtask rejected it (ADR-003 uses tag-delimited <result_json>); formatted sessions break GET message"
hotness: 0.85
ttl: 60d
version: 2
freshness: 2026-09-21
directory: claims/opencode
confidence: 0.9
status: active
claim_ids: [claims/opencode/sdk_subagent_spawn]
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---

fact: OpenCode session.prompt natively supports JSON-Schema structured output, but the available model opencode-go/deepseek-v4.1-flash rejects forced tool_choice in thinking mode, so native structured output was REJECTED for the workflow subtask; ADR-003 uses tag-delimited manual <result_json> output instead (whole-text stripCodeFence+JSON.parse remains the fallback).

native contract (verified live probe at opencode serve, artifacts in /tmp/wf-schema):
- body.format = { type: json_schema, schema, retryCount? }; parsed value at response.data.info.structured; StructuredOutputError appears in response.data.info.error.
- v2 SDK exports OutputFormatJsonSchema and JsonSchema types; the v1 typed client omits format, so passing it needs a cast.
- Blocking failures: thinking mode maps the schema to a forced tool_choice and returns APIError "Thinking mode does not support this tool_choice"; a formatted session then breaks GET /session/{id}/message with 400 "Expected OutputFormatJsonSchema, got ...". Avoid session.messages on formatted sessions.

Source: live probe at opencode serve + /tmp/wf-schema, and .opencode/plugins/helpers/workflow-subtask.ts.
Cross-refs: mem:architecture/adr/ADR-003-tag-delimited-structured-output, mem:claims/opencode/sdk_subagent_spawn, mem:cases/opencode/sdk_skills_injection.