---
L0: "Delegation run lost two dispatches to the goal gate, one scouting pass to a blocked re-dispatch, and a child to a 7-question prompt overrun at 26/24 calls; fixes: goal set in the dispatch body, at most 3 questions, name the closing observable."
name: cases/delegation-goal-gate-and-prompt-width
description: A config-change run lost two dispatches to the goal-first gate mid-run, lost one scouting pass to a blocked re-dispatch, and lost a child to a 7-question prompt that overran at 26/24 calls; a curl-denied reachability question and a candidate path list burned every child's budget.
type: cases
scope: cases
status: active
confidence: 0.8
tags: [task-delegation, dispatch, goal-gate, prompt-sizing, permission-denial]
---

# Idea

Delegation failures in that run were not child failures. The orchestrator built dispatches whose preconditions the harness rejected and whose prompt scope exceeded one child's budget, so children complied and still returned unusable answers.

Root causes, one per symptom:

- **Dispatch lost to the goal gate.** The turn goal must be set in the same `execute` body as the `subtask_run` it covers; a goal set in an earlier body does not carry. Two dispatches were rejected mid-run, and the second scouting pass's dispatch was rejected, so its skills reached no child.
- **Budget overrun at 26/24 calls.** The research prompt asked 7 numbered answers plus verbatim quotes under a 3500-char cap. Seven requirement areas exceed the >3 split gate, and the closing-out work outlived the budget.
- **Unbounded evidence hunt.** No question named the observable that closes it, so the child expanded into fetch then re-fetch with slice offsets.
- **Unanswerable questions as written.** Reachability of the local server was asked while the repo's opencode config denies `curl` and the gateway container cannot route to the host port; every child spent calls discovering that. A second question's candidate list implied configs that do not exist, and a third left "required" ambiguous between schema-level and runtime.
- **Decision handed down.** The implementer's prompt carried "no limit, no modalities", so the child could comply but not flag the contradiction.

# Scope

Applies to the delegation method in `.agents/skills/task-delegation/SKILL.md` (1.5.37) and its workflow file: dispatch construction, prompt sizing, and question design. Not a runtime defect, not an environment fix. The `curl` denial is environment policy and stays as-is.

# Rationale

Each rule is checkable at dispatch time, before a child spends a call:

1. Set the goal in the dispatch body; re-issue a gate-rejected dispatch unchanged instead of re-planning it.
2. Count answerable questions and split above 3 per child.
3. Name the observable that closes each question and state that a denial is an acceptable answer.
4. Name one authoritative path; omit candidate lists.
5. Say whether a key must be declared or may stay absent, and at which level (installed types or loader).
6. A scouting pass counts as delivered only when its skills appear in the next dispatch.
7. Carry a constraint, not a decision, and ask the child to report a contradiction in one line.

Kept over alternatives: no child-side "be careful" instruction (unmeasurable); no wider per-child budget (the overrun was scope, not capacity).

# Evidence

Child `ses_e7d7226a3ffeE23CPvR58msgVG` (research, over budget) reported the two-step doc hunt, the wholesale `git ls-files` rejection under the `git *` deny, the `curl` denial at `opencode.jsonc:84`, and the Q1/Q3/Q5 wording defects. Orchestrator observations supplied the goal-gate losses and the handed-down decision.

# Proposals (user-owned, not applied)

- `.opencode/agents/rug.md`: require the goal call in the same body as every dispatch, and treat a blocked dispatch as pending, not handled.
- `.opencode/agents/rug-swe.md`: a child that hits a denial reports it as the answer to that question rather than continuing to probe.
- `opencode.jsonc`: no change requested; the `curl` deny is correct and should be stated in prompts instead.
