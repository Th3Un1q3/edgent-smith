# Parallel-Edits Cross-File References

When multiple agents edit a multi-file skill in parallel, declare cross-file references — section anchors, canonical token names — centrally, and have each agent verify its references resolve before finishing. Source: observed validation failures in the 2026-08-07 context-gathering skill review.

- X1 anchor mismatch: a cross-file link pointed to a non-existent SKILL.md heading ("Verbatim-cache verification"). Resolve anchors against the actual target heading before editing.
- M3 incomplete sweep: partial checks missed 5 stale `code_mode({...})` / `mcp_find` tokens. Validation MUST include a full-tree grep for stale naming tokens — sampling is not enough.

Canonical gateway tool names (this project): `gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec` — never underscore (`code_mode`) or unprefixed (`mcp_find`) variants.

Related: mem:subagent-workflows/verification-retries; mem:skills/general/context-gathering-version-deltas.