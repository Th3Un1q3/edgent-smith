---
id: claims/memory/validator_baseline_scope
type: claims
L0: "the memory validator walks the whole tree with no path filter, so scope it to the changed subtree, treat pre-existing cache defects as baseline, and return INCOMPLETE rather than FAIL for anything uninspected"
hotness: 0.8
ttl: 60d
version: 1
freshness: 2026-10-23
directory: claims/memory
confidence: 0.9
status: active
provenance: 2026-10-23 harness analysis of two memory-verification children
---

# validator_baseline_scope

fact: `agent_utils/scripts/validate_memory_frontmatter.py` iterates `root.rglob("*.md")` with no path argument, so every run reports the whole tree. On this repo that is roughly 340 pre-existing defects in `cache/**`. A validating child that treats that output as its signal cannot separate its own change from the baseline.

scope: Any agent running memory validation or verifying memory writes.

evidence: 2026-10-23, one child ran the validator, hit the 340-defect baseline, and had to filter the output down to its own target (ADR-013) to make any judgement. A second child reported FAIL for a fourth artifact its budget never reached.

rule: Run the validator only against the memories you changed (or filter its output to them) and state the pre-existing defect count as baseline, not as your result. Never emit FAIL for an artifact you did not inspect: use INCOMPLETE. Verify memory content and git tree state as two separate checks.

Source: 2026-10-23 harness analysis; validator source and observed runs.