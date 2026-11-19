---
L0: "A 4000-char validator verdict sliced in the orchestrator's return expression to fit the display destroyed criteria 6-8; the tail entry was never written, so subtask_tail held no copy and recovery cost a resume."
name: cases/verdict-sliced-at-display
description: The orchestrator sliced a fresh validator's 4000-char verdict inside its own return expression to fit the display and destroyed criteria 6-8; subtask_tail held no copy because the entry was never written, so the tail was recovered by resuming the child for a re-emit.
type: cases
scope: cases
status: active
confidence: 0.9
timestamp: 2026-11-17
tags: [orchestration, validator, truncation, report-integrity, subtask-tail]
sources: ["RUG orchestration run 2026-11-17: validator verdict sliced in the orchestrator's return expression"]
---

# The verdict was cut where it was read, not where it was shown

## Failure Modes

- **Symptom.** A fresh validator returned a 4000-character verdict; the orchestrator sliced it inside its own return expression to fit the display, and criteria 6-8 were destroyed. `subtask_tail` held no copy — the entry's `outputText` was empty — so the tail was recovered only by resuming the child for a re-emit.
- **False hypothesis.** That the tail was retrievable. The skill's empty-`outputText` rule sends the reader to `subtask_tail`, which reads as a durable store, so the missing text looked like an unread result rather than a deleted one. The slice had already removed it before anything was written down.
- **Root cause.** A display budget was applied to the value instead of to its rendering. SKILL.md:45 forbids slicing a report that is *passed on*; nothing said that a slice written into the return expression destroys the only copy, because the store was the orchestrator's own context. The tool-side clamp and its `truncated` flag were removed (1.5.32, 1.5.36), so truncation is now entirely orchestrator-side and no rule says where the cutting may happen.
- **How confirmed.** `subtask_tail` for the producing task returned no entry body, and the resumed child re-emitted the verdict with criteria 6-8 intact. The text existed; only the copy was lost — which is why the verbatim comparison, not the tail, settled it.
- **Prevention.** Cut at render: keep the parsed `outputText` whole in a variable and slice only the printed string. For a verdict over 3+ criteria, have the child write it to `.tmp/` and return the path plus the `END` sentinel, so transport never depends on the orchestrator's context surviving. When value and display differ, the value is what gets passed on.

## Evidence

RUG orchestration observations, 2026-11-17. Rule lines cited from `.agents/skills/task-delegation/SKILL.md`: :45 (never slice a report), :51 (empty `outputText` is unread), :142 (a set every consumer needs ships as a file).

## References

mem:cases/orchestration/delegated-report-completeness-contract — a report keeps its tail and sentinel.
mem:cases/uncapped-discovery-report — the cap governs the reader, not the tool.