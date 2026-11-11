---
L0: "Trial brief prescribed rm -rf and git add/commit as finish line: two hard permission denials, the git variant lost; the prescribed file list also hid the singular/plural .opencode detail under test."
name: cases/trial-mechanism-prescribed-gated-actions
description: A trial brief prescribed a step script whose two finishing actions were policy-gated, so both hard-denied, and the prescribed tree model deleted the variable under test.
type: cases
scope: cases
status: active
confidence: 0.8
timestamp: 2026-11-10
tags: [task-delegation, prompt-design, permission-denial, method-ownership]
sources: [undefined]
---

# Trial brief: mechanism prescribed instead of outcome

## Failure Modes

- **Symptom.** Two hard shell permission denials in one child — rm -rf, then git add and git commit — and the git-initialised variant of the trial was lost. Both runs still exited 0, so the deliverable itself survived.
- **False hypothesis.** The brief could script the trial: a fixed trial-repo file list, a literal candidate flag list, and a git commit as the finish line; and the delivered tree matched that list.
- **Root cause.** Mechanism prescribed over outcome. Two prescribed steps are gated by policy, so those calls could never succeed; the prescribed file list deleted the variable under test, because the real tree differed in plugin count and in singular versus plural .opencode directories, which turned out to be the load-bearing detail; and the flag answer (--harness) was undocumented and reachable only by experiment, so a candidate list could not contain it.
- **How confirmed.** Both denials recorded with exit 0 (reported). --harness is absent from opencode --help and was present on the run (CLI help checked this session, opencode v2.2.7).
- **Prevention.** State the prohibition and the permitted surface, never the forbidden step: confine writes to the scratch directory and never invoke a gated version-control write. Ask for a behavioural spec instead of a step script — exit code, no prompt, hash-stable rerun. task-delegation/SKILL.md Method Ownership already bans a command sequence and step order; the brief ignored an owned rule.

## Evidence

Source: session observations from the aidlc-workflows integration run (2026-11-10); opencode --help checked this session for the --harness claim.

## References

mem:cases/delegation-goal-gate-and-prompt-width — candidate path lists cost every child's budget there too.