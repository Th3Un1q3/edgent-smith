---
id: claims/opencode/sdk_structured_output
type: claims
L0: "OpenCode session.prompt supports JSON-Schema output, but opencode-go/deepseek-v4.1-flash thinking mode rejects it; a formatted session also breaks GET message; use prompt+parse"
hotness: 0.85
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.9
status: active
claim_ids: [claims/opencode/sdk_subagent_spawn]
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---

fact: OpenCode session.prompt natively supports JSON-Schema structured output, but the available model opencode-go/deepseek-v4.1-flash rejects it in thinking mode, so workflow subtasks use a prompt+parse fallback.

native contract (verified live probe at opencode serve, artifacts in /tmp/wf-schema):
- body.format = { type: json_schema, schema, retryCount? }; parsed value at response.data.info.structured; StructuredOutputError appears in response.data.info.error.
- v2 SDK exports OutputFormatJsonSchema and JsonSchema types; the v1 typed client omits format, so passing it needs a cast.
- Blocking failures: thinking mode maps the schema to a forced tool_choice and returns APIError "Thinking mode does not support this tool_choice"; a formatted session then breaks GET /session/{id}/message with 400 "Expected OutputFormatJsonSchema, got ...". Avoid session.messages on formatted sessions.

Source: live probe at opencode serve + /tmp/wf-schema, and .opencode/plugins/helpers/workflow-subtask.ts.
Cross-refs: mem:claims/opencode/sdk_subagent_spawn, mem:cases/opencode/sdk_skills_injection.