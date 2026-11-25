---
id: projects/opencode-workflows/workflow-tool/troubleshooting
type: entities
L0: "Troubleshooting subtask results by symptom: empty, timeout, error, huge outputText, empty subtask_ls when the child is a fork, empty subtask_outputs for an absent or unknown id."
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md § Troubleshooting (ll. 227-236)
---
# Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `status: 'empty'` | Child returned no text. | Make the prompt more specific or use a different agent. |
| `status: 'timeout'` | Child exceeded `timeout_minutes`. | Raise `timeout_minutes` or send a smaller prompt. |
| `status: 'error'` | Child reported an error, the call failed, the input was invalid, or a schema reply stayed unusable after the follow-up. | Read `error`, then retry or fall back. |
| Huge `outputText` | Child returned a long reply; `outputText` carries it in full. | Ask children for short answers. |
| `subtask_ls` returns `[]` | No child is parented to this session, or the child is a fork. | Use the `task_id` the fork returned, then `subtask_outputs`. |
| `subtask_outputs` returns `[]` | The id is absent, unknown, or empty. | Re-run the subtask or read the child session directly. |
