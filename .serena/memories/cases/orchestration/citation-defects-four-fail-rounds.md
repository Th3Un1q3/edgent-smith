---
id: cases/orchestration/citation-defects-four-fail-rounds
type: cases
L0: "Four judge rounds on a read-only archaeology answer: every structural finding correct, every FAIL a citation defect — two wrong ranges, one missing spawn site, three anchors drifted into help text."
hotness: 0.6
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases/orchestration
confidence: 0.9
status: active
provenance: "Orchestrator observation of a read-only code-archaeology run on injected command arguments, 2026-11-11; each of the four judge FAILs named the exact line it wanted."
---
# Citation defects, not analysis defects, cost four judge rounds

## Symptom

A read-only archaeology answer about injected command arguments needed four judge rounds. The producer's structural findings were right in every round; each FAIL was a citation defect — two wrong line ranges, then a missing spawn site in a file the report had already cited, then three drifted secondary anchors (a CLI flag cited as its help-text range).

## False hypothesis

That the defects were analysis defects, so the correction was another pass over the code. The judge never disputed a structural finding: each verdict named a line, and the line was wrong. Re-dispatching for re-analysis would have reproduced the same anchors.

## Root cause

The dispatch prompt asked for `path:line` on 18 sites and required neither a re-read of the line before citing nor a mechanical sweep for exhaustiveness, so both the ranges and the completeness came from recall.

## How confirmed

The four FAIL verdicts, read side by side with the cited lines: each cited range ended in a different construct than the one named. The same session's child run (ses_e3542f7d6ffedqPACeqhgKNORW) received productive rounds, and every FAIL it got named the exact line to re-read — same class, no separate lesson.

## Prevention

Two method rules, landed in `.agents/skills/task-delegation/SKILL.md`, "Prompts Carry Ground Truth, Not Line Numbers":

- Open each `path:line` and `path:start-end` in the round it is written; re-anchor a range whose end falls in a different construct (help text, flag definition, neighbouring function); an unre-read citation is reported as `unverified`.
- Treat "every site" as a count: name the sweep (`grep -c` of the call name in that file) in the prompt and require the count beside the enumerated rows.

Related: mem:cases/orchestration/delegated-report-completeness-contract, mem:cases/loadpath-unsatisfiable-citation-form, mem:cases/orchestration/child-evidence-before-verdict.
