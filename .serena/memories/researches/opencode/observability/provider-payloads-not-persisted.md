# Provider Payloads Not Persisted

opencode does not persist provider request/response payloads (verified on 1.18.13 and latest schema). There is no `provider` part type. Part types: text/step-start/reasoning/step-finish/tool/patch/agent/file/subtask/compaction; the v1.18.18 schema adds agent-switched/model-switched/user/synthetic/system/shell/assistant/compaction.

Consequence: no viewer can show “what was sent to the provider / the response” historically. Live capture requires external instrumentation (DIY).