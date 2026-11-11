---
L0: "Child spent its 24-call budget on five numbered questions plus a gitignore question and left the last two unverified; the cap is three per child and the dispatch procedure file never pointed at it."
name: cases/loadpath-question-count-overrun
description: A loader-research child carried five numbered questions plus a sixth scope question into a 24-call window and died with the last two unverified, against the owned cap of three.
type: cases
scope: cases
status: active
confidence: 0.8
timestamp: 2026-11-10
tags: [task-delegation, prompt-sizing, budget, skill-ownership]
sources: [undefined]
---

# Loader research: six questions against a three-question cap

## Failure Modes

- **Symptom.** The 24-call window was gone with the fifth question (does an opencode.jsonc plugin array accept a relative .ts path) and the .opencode/.gitignore question unverified.
- **False hypothesis.** Six answers each cost roughly one lookup, so six fit one 24-call window.
- **Root cause.** Six answerable questions against the owned cap of three (task-delegation/SKILL.md:119). The cap lived in SKILL.md while the dispatch-time procedure, workflows/task-delegation-workflow.md Step 3, carries no pointer to Prompts Carry Ground Truth, Not Line Numbers; verified this session that the workflow file's only SKILL.md cross-reference is line 58, on timeouts. Rules that are not reachable at write time do not fire.
- **How confirmed.** The transcript shows questions one through five plus the gitignore question with exactly the last two open — the signature of an unsplit six-question brief, not of bad luck.
- **Prevention.** One pre-dispatch line at Step 3 that names the four owning rules (three questions, closing observable, one authoritative path, outcome only) and splits a brief that fails a check. This is the second run in the family: mem:cases/delegation-goal-gate-and-prompt-width recorded seven questions at 26/24.

## Evidence

Source: session observations from the aidlc-workflows integration run (2026-11-10); task-delegation/SKILL.md:119 and the Step 3 cross-reference count verified by grep this session.

## References

mem:cases/delegation-goal-gate-and-prompt-width — the earlier overrun in the same rule family.