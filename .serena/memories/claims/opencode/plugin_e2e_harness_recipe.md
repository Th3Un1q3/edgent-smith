---
id: claims/opencode/plugin_e2e_harness_recipe
type: claims
L0: "Real-harness E2E for OpenCode plugins: opencode run --format json, parse part.tool/part.state, restrict tools via permission"
hotness: 0.9
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.9
status: active
provenance: opencode run live probe
---
claim/recipe: Unit-green OpenCode plugins must be validated on the live harness; unit tests passing does not mean live working (mem:cases/opencode/sdk_detached_method_this).
commands:
- opencode run --agent <agent> --model <model> --format json --title <title> --dir /workspace <prompt>
- parse the JSON event stream for part.tool == 'workflow' and inspect part.state.input / part.state.output.
- or inspect persisted payloads with opencode export <sessionID> / opencode db.
- restrict an agent to one tool with permission { '*': 'deny', <tool>: 'allow' } for safe probing.
evidence: live probe used to confirm spawn/model/skills behavior in .opencode/plugins/helpers/workflow-subtask.ts; it reproduced the detached-this bug that unit tests missed.