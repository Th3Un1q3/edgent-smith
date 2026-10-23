---
type: experiences
status: active
confidence: high
provenance: completed RUG run retrospective; harness fix in .agents/skills/task-delegation/SKILL.md v1.5.4
---

# Subagent Budget Calibration

Delegating a four-phase migration plan to subtasks failed six times on a 24-call producer budget. Three failure classes recurred:

1. Undiscovered API/type seams: client package identity, Effect v4 has no catchAll, no per-turn tools option, and storage injection was never surfaced.
2. Repo lint ceilings: max-lines 650, complexity 8, and unicorn rules rejected generated code.
3. Ambiguous identifiers: log-line prefix, probe env var, test-file ownership, and whether the gate needs --coverage were left to guesswork.

Asymmetric fresh-session validation found a real defect in every round: outcome semantics, ledger storage, collision sets, oversize reference, and coverage below threshold. A producing agent cannot validate its own work, so validation must stay fresh and independent.

The harness fix landed in .agents/skills/task-delegation/SKILL.md v1.5.4: delegation prompts must carry ground truth (API/type seams, lint ceilings, exact identifiers) and must reserve calls for the gate instead of spending the budget on production.

Rule: before delegating multi-phase work, budget producer calls explicitly, state seam facts and ceilings up front, and keep the validating session separate from the producing one.