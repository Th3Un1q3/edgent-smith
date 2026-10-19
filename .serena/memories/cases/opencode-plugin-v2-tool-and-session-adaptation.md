---
id: cases/opencode-plugin-v2-tool-and-session-adaptation
type: cases
L0: "OpenCode v2 plugin tools+session: register tools via ctx.tool.transform (JSON-Schema input, return content); prompt is admit-and-wake - adapt with switchAgent+switchModel+prompt+wait+context; read text from content[] and model from message.model"
hotness: 0.8
ttl: 180d
freshness: 2026-10-06
directory: cases
provenance: session opencode-plugin-migration (quality-gate-enforcer + workflow)
version: 2
---
# OpenCode v2 plugins - custom tools and session-client adaptation

Environment: OpenCode v2.0.23; @opencode/plugin@2.0.24. Source: live runtime logs, child-session export, and the published package types.

## M9 Custom tools: transform + JSON Schema + content (not output)
Mistake: ported the V1 tool map (zod args) directly. V2 registers tools via ctx.tool.transform(editor => editor.add({ name, description, input: <JSON Schema>, execute })); execute returns Result = { output?, content?, metadata? }. Returning output without a declared output schema fails live: 'Tool result declared output without an output schema'.
Fix/avoid: give the tool a JSON-Schema input; return the plain string result as content (summary in metadata), or declare an output schema.

## M10 Session API gap: prompt is admit-and-wake; no fork/messages/abort
Mistake: assumed V2 ctx.session.prompt blocks and returns the assistant reply (V1 behaviour). V2 prompt admits durably and wakes the runner, returning SessionInbox.User (no reply). SessionDomain = Pick<SessionApi, create/get/remove/switchAgent/switchModel/prompt/generate/command/compact/synthetic/interrupt/update/move/wait/context> - NO fork, messages, or abort.
Fix/avoid: adapt at the boundary. prompt -> switchAgent({sessionID, agent}) -> (switchModel if a model was resolved) -> prompt({sessionID, text}) -> wait -> context; read the last assistant text from context. messages -> context; abort -> interrupt; update -> update. fork is unavailable: guard it and return an unsupported error. Do not promise blocking replies.

## M13 V2 message + model shapes (the model-selection bug)
Mistake: the adapter read message.role/message.parts and passed raw session.context output through as messages. V2 SessionMessage.Info is flat: assistant { type:'assistant', model: Model.Ref{id,providerID}, content:[{type:'text',text}] }; user { type:'user', text }. So text extraction returned [] and resolveParentModel found no info -> 'parent model not found' -> children fell back to the default model (OpenRouter auth error -> empty). session.prompt has no model field, so a resolved model was also silently dropped.
Fix/avoid: extract text from content items where type==='text'; find the assistant by type==='assistant'; map messages to { info: { role: type, providerID: model?.providerID, modelID: model?.id } }; apply the model with session.switchModel({sessionID, model:{id:modelID, providerID}}) before prompt; surface info.error from the assistant message.

## M11 No shell-exec API; import Bun $
Mistake: looked for a ctx shell runner. V2 exposes no shell execution (ctx.shell only has hook('create.before')).
Fix/avoid: import Bun $ directly (per the migration guide) to run gate commands; add $ to the ambient bun shim for types.

## M12 Live run is mandatory
Mistake: mocked unit tests passed while the live runtime rejected the result shape (output) and silently ignored the subtask agent and its model; an earlier migration also missed an absolute-vs-relative path. Only live runs surfaced these.
Fix/avoid: after unit tests, run the plugin live and read runtime logs + session exports. Unit-green is necessary, not sufficient.