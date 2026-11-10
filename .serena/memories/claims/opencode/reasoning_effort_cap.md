---
id: claims/opencode/reasoning_effort_cap
type: claims
L0: "Per-model thinking cap: provider.<id>.models.<id>.options.reasoningEffort maps to body reasoning_effort; Anthropic uses options.thinking budget; repo caps proposed, not applied; openai-compatible path and port-1289 endpoint unverified."
hotness: 0.6
ttl: 60d
version: 1
freshness: 2026-10-28
directory: claims/opencode
confidence: 0.75
status: active
provenance: opencode v2.2.0 bundle + /workspace/opencode.jsonc + opencode.ai/docs/models; independently re-verified by a fresh reviewer (PASS), 2026-10-28
---
# Per-model reasoning ("thinking") cap

The cap is a config option on the model; opencode forwards it as a request-body field. Nothing in this repo has been edited or tested for it.

## Mechanism and config path

- Cap path: `provider.<providerID>.models.<modelID>.options.reasoningEffort` (camelCase on the config side).
- opencode v2.2.0 maps that option to a top-level `reasoning_effort` field in the chat body (`reasoning_effort: v.reasoningEffort`, and `reasoningEffort` is in its option whitelist).
- Agent-level `agent.<name>.reasoningEffort` overrides the per-model options (docs/models).
- No global "max thinking" key exists.

## Repo application (proposed, NOT applied)

In `/workspace/opencode.jsonc`, provider `local` (`npm: @ai-sdk/openai-compatible`), models `qwen3.6-28b-reap20-a3b`, `spark-x2.5-4b`, `google/gemma-4-12b-qat`: add `"options": { "reasoningEffort": "low" }`, keeping any existing `modalities`/`limit` on those entries.
`small_model local/google/gemma-4-e2b` has no `models` entry, so it cannot be capped until one is added.
This is a proposal: no config was changed, and the cap is not applied or tested.

## Variants and provider shapes

- Variants: `provider.<id>.models.<id>.variants.<name>` accepts `reasoningEffort`, `textVerbosity`, `reasoningSummary`; cycle with keybind `variant_cycle`; `{"disabled": true}` disables a variant.
- Built-in effort values: Anthropic `high`/`max`; OpenAI `none`/`minimal`/`low`/`medium`/`high`/`xhigh`; Google `low`/`high`.
- Anthropic thinking budget: `options.thinking = {type: "enabled", budgetTokens: 16000}`; valid bounds are undocumented.

## UNVERIFIED

- The repo's openai-compatible call path is not proven to reach the builder that emits `reasoning_effort`.
- Endpoint `host.docker.internal:1289` is unidentified (probes unreachable, curl denied), so whether it honours `reasoning_effort` is unknown. If it is LM Studio, `/api/v1/chat` uses a different `reasoning` field; if llama.cpp, its own flags apply (flag unconfirmed from its README).
- Anthropic `budgetTokens` bounds.

Source: https://opencode.ai/docs/models/ ; /home/vscode/.opencode/bin/opencode v2.2.0 ; /workspace/opencode.jsonc L4,L24,L28,L30-57 ; https://lmstudio.ai/docs/developer/rest/chat ; anomalyco/opencode#27361 (filed v1.14.48, status unread).