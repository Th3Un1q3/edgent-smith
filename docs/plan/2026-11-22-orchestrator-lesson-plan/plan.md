# Orchestrator Lesson Plan — 2026-11-22

## Root causes

- **R1 — the ask boundary had no residency gate (obs 1).** Artifact placement was settled when the table was produced, not when the question consumed it, so the question went out against a table living in `.tmp/` plus the chat reply. `mem:cases/orchestration/tmp-path-named-as-deliverable` already records this incident: the knowledge existed, the boundary rule did not.
- **R2 — the choice question carried no disambiguation branch (obs 2).** The rework answer admitted two readings and nothing in the ask forced one to be named, so the ambiguity surfaced a round later instead of in the ask.
- **R3 — the design reviewed capability presence, not control flow (obs 3).** The doc asserted a complete placeholder lifecycle while naming neither the emit call site nor the awaiting owner; the raise was blocked on the emit path, and a wiring child found it by breaking five host tests.
- **R4 — dispatch had no blocked-exit term (children).** Prompts named the work but not what ends it, so a child that identified a blocker retried it once, reverted its own edit once, and one child spent its whole budget with no edit landed.
- **R5 — design records carried no lifecycle stamp (obs 5).** Removed ids stayed in prose as live tokens, so two id checks read them as surviving references and failed late.
- **R6 — validator verdicts merged two defect classes (children).** A documentation-drift row and a code defect produced the same FAIL, and two FAIL rounds bought no code progress.
- **R7 — the change order followed the dependency (obs 4, positive).** Compound state, then dedupe, then wiring; no child reverted another's work. The order is worth codifying before a run finds it by accident.

## Lessons, ordered by expected impact

Ordering key: recurrence × cost per occurrence. A second obs 1 costs a user round-trip; obs 3 cost five host tests plus a child budget.

| # | Source | Label | Lesson | Disposition |
|---|---|---|---|---|
| 1 | obs 1 | METHOD | The knowledge exists as a case; the missing piece is the ask boundary — promote first, ask second. | `.opencode/agents/rug.md` `## Operating loop`, +1 bullet: "Before a `question` asks the user to choose between options, every artifact the choice depends on sits at a repository path and the question names that path; send the ask only after `test -f` passes on each path it names." |
| 2 | obs 3 | METHOD | A design that adds an asynchronous capability must name who emits, who awaits, and what happens to the raise when nobody does. | New `.opencode/instructions/design-records.instructions.md`, `applyTo: "{docs/plan/**/*.md}"`: "A design section that introduces an event names three things in that section — the emitting call site, the component that awaits it, and what happens to the raise when no handler is live; a design with fewer than three named lines is not ready for wiring." |
| 3 | children (wiring ×2, template) | METHOD | Children burned budget on a known blocker because no prompt line told them a blocker ends the work. | `.opencode/agents/rug.md` `## Writing a subtask prompt`, +1 bullet: "Every subtask prompt states the blocker condition that ends the work and the output required when it fires — the blocker and no edit; a prompt without that line is not sent." |
| 4 | children (two validators) | METHOD | FAIL meant two different things, so a doc-drift row and a code defect produced the same verdict. Incident already covered by `mem:cases/validator-evidence-bar-ambiguous`; only the rule is missing. | `.opencode/agents/rug.md` `### Fresh judge`, +1 bullet: "A validator returns FAIL only with a reproduced failing command on the code path; documentation drift is reported as a separate `drift:` row and never sets FAIL." |
| 5 | obs 5 | METHOD | Removed ids read as live for as long as the record that kills them stays unmarked. | Same new `.opencode/instructions/design-records.instructions.md`, second rule: "A design record carries `status: historical` in its frontmatter from the moment it describes a removed identifier; a record without that status is treated as live by every id check." |
| 6 | obs 2 | CASE | One ambiguous answer, one lost round: the rework request was answered two ways and the follow-up ask arrived after the round was spent. | `cases/orchestration/rework-answer-two-readings-one-round-late` — five fields: symptom (rework answer "remove contract, it's confusing" admitted drop-the-section and drop-the-concept; follow-up needed), false hypothesis (the answer was unambiguous enough to act on), root cause (the ask offered one reading and no branch for a second), how confirmed (orchestrator asked again rather than guessing; both readings survived the first pass), prevention (the ask lists each reading as a labelled option). Append one row to `cases/about`; `cases/orchestration/` has no sub-scope `about`, so the index row lands in `cases/about` as today. |
| 7 | obs 4 | METHOD | The order that held is the order to keep: reshape the state, then dedupe, then wire. | `.opencode/agents/rug.md` `## Dependency tree`, +1 bullet: "A change that reshapes shared state dispatches as three steps in order — shape, dedupe, wire — one child each, and a step starts only after the prior report names its changed files." |

## Apply now (cap 3)

1. Lesson 1 — one bullet, highest recurrence and user-visible cost.
2. Lessons 2 and 5 — one new instruction file carrying two rules, one edit.
3. Lesson 3 — one bullet on the prompt-writing section, the failure that cost two child budgets.

## Deferred

- Lesson 4 — needs a judgement of what "reproduced" means for doc-drift rows, and `### Fresh judge` is read by every dispatch; one review round of its own.
- Lesson 7 — preventive only, no incident yet; lands with the next `## Dependency tree` edit rather than as a solo diff.

END plan
last rule: promote every artifact a choice depends on to a repository path, cite that path in the question, and ask only after `test -f` passes on each cited path.
