---
id: claims/opencode/output_text_cap
type: claims
L0: "subtask outputText caps at 4000 chars plus a truncation marker and reports truncated:true, so prompts need a word cap and one report section"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# output_text_cap
fact: subtask outputText is capped at 4000 characters, appends a truncation marker, and sets truncated:true instead of failing silently.
scope: Prompt design for any subtask whose report matters.
evidence: Eight of ten children in the orchestration run lost their final report sections to this cap.
rule: Instruct each child to stay under a stated word count and emit exactly one report section at the end.
Source: observed subtask_run output, 2026-10-22; harness outputText cap (4000c).