---
L0: "Two prompt forks — calling open before machine.interrupted on a session with no state, and logging versus silently dropping an unrecognised reason — were decided by the child and disclosed only after the fact."
name: cases/prompt-fork-decided-unasked
description: Two forks the prompts left open were decided by the child (no open call, silent drop of an unrecognised reason) and reported only after the fact, so neither choice had a criterion to pass or fail.
type: cases
scope: cases
status: active
confidence: 0.85
timestamp: 2026-11-17
tags: [orchestration, prompt-design, ambiguity, delegation]
sources: ["child ses_e19d9dd00ffeQnTA9cTAl0YOQo, RUG orchestration run 2026-11-17"]
---

# Both forks were the prompt's silence

## Failure Modes

- **Symptom.** One child met two forks its prompt left open — whether to call `open` before `machine.interrupted` for a session with no machine state, and whether an unrecognised reason should be logged or silently dropped — decided both itself (`no open`, silent drop), and disclosed the choice only in its closing note.
- **False hypothesis.** That a silent gap is an ambiguity the child may settle, and that settling it quietly is cheaper than reporting it. The child's own report calls the choice "unasked", so nothing about its capability was at fault; the visibility was.
- **Root cause.** The prompt named the mechanism and stopped: a state machine over a session that may have no state, and a closed reason vocabulary with no rule for the unrecognised value. SKILL.md:126 covers a handed-down decision that contradicts the tree, not a gap the prompt never filled, so the child had neither a default nor an instruction to return the fork.
- **How confirmed.** The child named both forks and its two choices in derived work that then had to be read against unstated intent; the verification that followed could test neither choice, because no acceptance criterion covered it.
- **Prevention.** Close every fork in the prompt or require it in the report: name the default for an absent state and for an out-of-vocabulary value, or add "a choice the prompt leaves open is returned as one line naming the option taken and the option rejected". A universal ("an interruption must never re-prompt") names the existing behaviour it measures and says whether the nearest one is an instance or an exception.

## Evidence

Child ses_e19d9dd00ffeQnTA9cTAl0YOQo's report, RUG orchestration run 2026-11-17, paired with ses_e19e399ceffeLfe9NCCIQ0EfgC, which met the same class of gap on "the existing machine test file" and on the existing `park_summary` entry prompt.

## References

mem:cases/orchestration/delegation-prompt-assumptions — the same failure class, earlier run.