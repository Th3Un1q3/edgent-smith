---
id: cases/docs/prose_capability_claims_rot
type: cases
L0: "A prose claim that a capability is absent rots silently: no gate compares docs to code, so only a fresh judge reading the file against the implementation catches it"
hotness: 0.6
ttl: 90d
version: 1
freshness: 2026-10-22
directory: cases/docs
confidence: 0.9
status: active
provenance: OpenCode plugin work, 2026-10-22 — fork_from implementation and the stale prose found around it
---
# prose_capability_claims_rot

fact: Prose that asserts a capability is absent goes stale without any signal. The falsehood that session.fork was unsupported survived in `rug.md`, the tool documentation, and a claim memory after the code supported fork_from, and no gate compares prose claims to code.
evidence: A fresh judge reading each file against the implementation found the mismatch; recall would have re-propagated the claim to later agents.
rule: Treat "X is unsupported" statements as dated until re-read against the implementation. Re-verify such prose when the code path changes, and prefer citing the code site over restating the conclusion.
Source: observed, 2026-10-22 — verified fork_from behavior in helpers/workflow-subtask.ts against the corrected rug.md, docs/workflow-tool.md, and claims/opencode/session_fork_unsupported.