---
name: task-delegation
description: >
  Teaches the RUG (Repeat Until Good) orchestrator pattern for decomposing user requests into discrete, independently-completable agent subagent tasks and routing them to specialized agents based on scope, expertise, and limitations.
license: MIT
compatibility: Requires OpenCode
metadata:
  version: "1.5.10"
  author: "Th3Un1qu3"
  delta: >
    1.5.10 — corrected "Child Budget Accounting" against the plugin source: the
    ~24-call budget is per turn and an idled child's counter is cleared, so a
    task_id resume opens a fresh window and is the cheapest path after idle;
    24 triggers a stop-reminder rather than a hard block; recovery reads tail,
    then resume, and relaunches only when the context itself is wrong.
    1.5.9 — added "Child Budget Accounting": the ~24-call budget is per turn, so an
    idled child's counter clears and a task_id resume opens a fresh window, while a
    mid-turn child carries its count; subtask_tail costs no child budget, setup
    ~4-6 calls so prompts pre-state discovered values or name one owning skill,
    validators <=3 claims, output ~4000 chars; prompted by a ten-child run where
    children spent ~5 calls on setup, a resume looked costly though the budget
    does not carry across turns, a nine-claim validator died, and reports truncated.
    1.5.8 — added "Delegation Granularity and Independent Validation":
    one subtask_run is one unit of work while several runs share one execute
    call, validators run in that same call without task_id or fork_from,
    independence is the absence of producer identity rather than the absence of
    write access, the closing PASS comes from a non-author, and a JSON-string
    result is parsed rather than discarded; prompted by an orchestration that
    serialized independent subtasks, made verifiers report-only across three
    fix-verify rounds, dropped three completed reviews on a shape assumption,
    and accepted budget-truncated producer reports as validation.
    1.5.7 — the ground-truth section gained a write allowlist (user-owned
    `.opencode/agents/rug.md` and `rug-swe.md` excluded from every write scope),
    pre-checked verbatim edit anchors, and one winning criterion for conflicting or
    unmeasurable acceptance criteria; prompted by a ponytail-review run where three of
    six subtasks burned their budget on unverified anchors, one child damaged an
    out-of-scope agent definition, and a docs dedup needed three rounds for an
    undefined pointer bar.
    1.5.6 — the exact-identifier example uses a feature-flag value
    (`INSTRUCTION_INJECTION=synthetic`) instead of a retired live-probe env gate.
    1.5.5 — step 8 points model-level live verification at the canonical
    instruction set.
    1.5.4 — added "Prompts Carry Ground Truth, Not Line Numbers" (API/type seams,
    injection points, repo lint and file-size ceilings, exact identifiers) and a
    gate-reserving call split in the budget-sizing rule; prompted by a 12-producer
    run where six producers exhausted the 24-call budget mid-phase and two
    refactored to satisfy lint caps discovered only at the gate.
    1.5.3 — replaced the outbound permission-policy pointer with a self-contained
    permission block for delegation: prompts must not instruct bypassing gates or
    reproducing denied effects, gated writes need explicit authorization, and a
    denial is final — the subagent reports it and continues with permitted work.
    1.5.2 — permission policy prose in the delegation workflow reduced to a compact
    standing rule; kept the prompt-design rule against unsanctioned fallback offers.
    1.5.1 — compatibility value narrowed from Universal to Requires OpenCode; the label
    itself was already documented under 1.5.
    1.5 — added the documented compatibility label; stated the generic fallback for
    delegation: where the environment cannot spawn subagents, a human performs the pass.
    1.4 — routed method ownership (prompts state outcomes and acceptance criteria, not command recipes) into the delegation workflow, with a root pointer; prompted by auth-denied `gh`/git recipes.
    1.3 — added the Size Bulk Edits to Fit Subagent Budgets rule; prompted by a
    retrospective where one implementation subagent asked to edit 19 slide blocks plus
    verify exhausted its budget, leaving verification undone.
    1.2 — added the Parity and Porting Tasks Require a Surface Inventory mandate
    (surface-mapping discovery before decomposition, no-silent-skips, enumerated
    scope questions, mapping-checked validation); prompted by a session review where
    an "as close as possible to opencode" port silently skipped plugins and MCP servers.
    1.1 — routed task-delegation-workflow.md in the Well-Known Workflows table and added
    budget-aware task sizing plus ground-truth smoke-test rules to that workflow; prompted
    by recurring delegation failures (subagent budget exhaustion, config tasks passing
    declarative introspection while failing at runtime).
---

# Task Delegation Skill

Teaches the RUG (Repeat Until Good) orchestrator pattern for decomposing user requests into discrete, independently-completable agent subagent tasks and routing them to specialized agents based on scope, expertise, and limitations.

## Mandatory Steps for Delegating Tasks

1. Identify the user request and desired outcome.
2. Look through the list of workflows to see if there is a ready-made recipe for the task in [Well-Known Workflows](#well-known-workflows). If so, follow the workflow steps.
3. If no workflow exists, decompose the user request into discrete tasks.
4. For each task identify skills that are relevant to the task that are best suited to complete it.
5. Use the `task` tool to delegate each task to the appropriate subagent, providing clear instructions, acceptance criteria, and any necessary context.
6. Track progress against the task list and confirm that each subagent completes its task successfully.
7. Use the `question` tool to ask for clarification or additional information from the user as needed.
8. Validate the results of each subagent's work independently, and iterate until the overall task is completed successfully. Model-level live verification follows `.opencode/instructions/live-verification.instructions.md`.

## Parity and Porting Tasks Require a Surface Inventory

When the request is a parity or porting task — "as close as possible to X", "mirror", "port", "replicate", "match" — decomposition MUST begin with a source→target surface-mapping discovery, never with task breakdown:

- **Inventory first.** Launch a discovery subagent that inventories EVERY element of the source system (plugins, MCP servers, config files, commands, agents, instructions, env vars, tooling) and maps each to a target disposition: IMPLEMENTED / MIGRATE / DROP-WITH-REASON / DEFER.
- **No silent skips.** Every non-implemented element carries a reason; every DEFER/DROP is documented in the target's user-facing docs (README) before the task counts as done. A skip without a documented reason is a failure.
- **Scope questions enumerate.** When a scope-locking question uses a domain word with repo-specific meaning ("plugins", "MCPs", "harness"), the options must list what it concretely includes in THIS repo — inventory first, then ask.
- **Validation checks the mapping.** Give the validation subagent the mapping table; it must verify each row's disposition (implemented actually implemented; migrate actually wired; defer/drop documented), not just the acceptance criteria. This extends asymmetric validation: the validator judges parity-surface completeness, not merely instruction-following.

## What Not to Do

- Delegate tasks without reading the agent cards and rightsizing the task to the subagent's capabilities.
- Attempt to complete tasks yourself or bypass the RUG orchestrator pattern. All work must be delegated to subagents with explicit scope and acceptance criteria. Where the environment cannot spawn subagents, a human performs the pass.
- Write subagent prompts that instruct bypassing a permission gate or reproducing a denied effect by another mechanism. Gated writes (`git add`, `git commit`, `git push`) require explicit user authorization in the current session; when a delegated action is denied, the subagent reports the exact command, the denial, and the intended outcome, then continues with permitted work — the denial is final for that action.
- Sticking to the initial plan despite evidence that it is not working. Be flexible and willing to adjust the plan as needed based on feedback and results.

## Size Bulk Edits to Fit Subagent Budgets

- A single-file edit touching more than ~10 independent blocks (one edit per slide/row across many similar elements) PLUS verification exceeds one subagent's tool-call budget — all edits land, verification is left undone.
- Split pattern: (a) an implementation subagent does ONLY the edits, given exact old→new strings so it performs no judgment work; (b) a fresh verification subagent that did not produce the edits checks the result, invoked without `task_id` and without `fork_from` and permitted to share the implementer's `execute` call.
- For more than ~20 blocks, split the edits into halves and give each half to its own implementation subagent.
- Judgment work belongs in a design subagent beforehand — the implementer receives only mechanical edits and no decisions.
- If verification stays with the implementer, plan for a resume: at the budget limit the implementer reports "edits done, verification pending" — resume the same session (`task_id`) to finish verification instead of re-doing edits.
- A resume consumes less budget than a relaunch: context reuse beats re-discovery (see Subagent Failure Recovery).
- **Reserve the gate calls in the prompt.** State the split: ~70% implementation and tests, ~20% gates, ~10% reporting. Pair each behavior's test with its implementation in the same pass so RED→GREEN completes inside the budget; an implementer that writes RED tests and stops spends its last calls on gates it never reaches. When test growth would push a test file toward the repo's max-lines cap, give test authoring its own subtask.

## Delegation Granularity and Independent Validation

- **One `subtask_run` is one unit of work, not one call.** A single subtask sets one deliverable ("implement file A", never "implement file A and B" or "implement and research"). Several subtask runs belong in the SAME `execute` call; serializing independent subtasks across separate calls buys no isolation and spends wall-clock and budget.
- **Producers and validators share one call.** A validator may run in the same `execute` call as its producer; invoke it without `task_id` and without `fork_from` so it judges the tree rather than the producer's transcript.
- **Independence is no producer identity, not no write access.** A verifier may be authorized to fix inside a declared whitelist; "report only" is a choice for checks where a fix would compound the error (a contested design call, a file outside the whitelist), never a requirement of independent validation. A report-only verifier that finds a defect costs another author-verify round.
- **The final PASS comes from a non-author.** However the earlier rounds divide authoring and checking, the session that made the last edit does not issue the closing PASS; a fresh session does.
- **Parse the result before judging it.** A subtask result may arrive as a JSON string; parse it, then read its fields. Never discard a completed result, or redo its work, on a shape assumption. A producer report truncated by budget exhaustion is not validation and not a PASS; it requires a validator or a resume.

## Prompts Carry Ground Truth, Not Line Numbers

A prompt that names a seam only as "file X line N" spends the subagent's budget re-deriving the real contract, and the surprise lands mid-implementation. Convert discovery into exact facts before writing the prompt:

- **API and type seams.** Name the installed package and version (`@opencode/client 2.0.24`, not a remembered `@opencode-ai/sdk`), the method that actually exists (`catchCause`; Effect v4 has no `catchAll`), and the accepted input shape (`SessionGenerateInput` has no `tools` option). A field that does not exist is a defect the prompt prevents, not one the subagent discovers after writing code against it.
- **Injection points.** Say where a dependency must be threaded (`context.storage` into `publishInstructionSet`) and which production path always sets a value, so the missing-value case is handled with a stub instead of an invented fallback.
- **Repo ceilings for the files in scope.** State the lint and size caps verbatim: max-lines 650 per test file, complexity 8, `unicorn/prefer-includes`, no-await-expression-member, no-top-level-assignment-in-function. A subagent that learns a cap from a failing gate refactors or splits files after the work is done, and often runs out of budget first.
- **Exact identifiers.** Feature-flag values (`INSTRUCTION_INJECTION=synthetic`), log-line text including any allowed prefix, which suite a case belongs to, and the gate command with its flags (`just opencode::test --coverage`). Never leave a subagent to invent a name that already exists in the repo.
- **Write allowlist.** Name the files the subagent may modify and the files it must not. User-owned files (`.opencode/agents/rug.md`, `.opencode/agents/rug-swe.md`) stay outside every write scope, however narrow the task. A subagent blocked by a gate inside a narrow task edits a neighbouring file until the gate passes, and the validator finds the damage only after the pass.
- **Pre-checked edit anchors.** Quote the exact text each replacement targets and confirm that text exists in the tree before dispatch. An anchor that is paraphrased, or labelled "verbatim" without the check, costs one failed edit per retry until the budget runs out.
- **One winning criterion.** When acceptance criteria conflict — delete a function against forbid touching its file, keep one copy against delete the duplicate — the prompt states which one wins. Turn an unmeasurable bar into a concrete test ("a reader reaching the pointer needs no second lookup"), never an adjective. A subagent left to choose asks and stalls, or satisfies the criterion that damages the tree.

State each fact as a constraint on the outcome; the subagent still owns the method. Facts the orchestrator does not have yet belong in a research subagent that returns them, not in a guess inside the implementation prompt.

## Child Budget Accounting
- **The ~24-call budget is per turn.** A child that idles (every completed subtask does) gets its counter cleared, so a `task_id` resume starts a fresh 24-call window; resume is therefore the cheapest path after idle, not a last resort. Only a child still mid-turn carries its count. 24 is the advertised `<task-budget>` and triggers a stop-reminder, not a hard block; a child told to stop may overrun, so treat >24 calls as overrun evidence, not a hard limit. `subtask_tail({ task_id })` reads completed output for one orchestrator call and no child budget: tail, then resume — the resume resets the budget; relaunch only when the context itself is wrong.
- **Setup is charged before research.** Skill load, gateway discovery, code-mode activation, and page discovery consume ~4-6 calls. State the values setup would discover (page id, tab id, tool name, URL pattern, filter syntax) in the prompt, or name the one skill that owns them; never paste one recipe into several prompts, because each child re-derives it and invents its own workaround. Say the split too: ~6 setup, ~12 work, ~4 report, fields capped at 3-5.
- **State the evidence bar and the verdict rule.** Define what counts as proof per criterion and what a missing value means (fails the criterion, or passes as "not found"); for a term with two readings, say which wins. Cap each validator at <=3 claims with pages pre-opened: a nine-claim validator dies mid-verification.
- **Cap output length.** `outputText` holds ~4000 chars, so ask for one section and a word cap ("<=150 words, no tables"); an over-long report truncates silently.

## Subagent Failure Recovery

When a subagent returns no usable output or exhausts its budget without producing code:

1. **Tail, then resume; relaunch only when the context itself is wrong.** Re-invoke the subagent with the same `task_id` and a prompt like "report what you did and what remains." Context reuse is cheaper than re-discovery, and the resume resets the budget: an idled child gets a fresh 24-call window. Call `subtask_tail({ task_id })` first (one orchestrator call, no child budget) to collect output even if the resume fails. If the resumed subagent still produces nothing, proceed to step 2.
2. **Relaunch with narrow scope.** If resume fails, launch a fresh subagent with a single deliverable, the task's steps (not command recipes), and an explicit directive to produce output immediately. Broad prompts ("implement X, Y, and Z") cause budget exhaustion on discovery — scope each subagent to one deliverable.

## Pilot-first rule for research campaigns

- Any research campaign spanning >5 entities MUST start with a single-entity pilot: capture one entity end-to-end (search → open → extract → store in memory → report), confirm the pipeline, then proceed.
- Then run batches of ≤5 entities, with per-item recovery: on batch failure, save what succeeded (memory store first), retry ONLY the failed items — once — with a changed approach (smaller batch, different extractor, different navigation, longer waits). NEVER retry the same failing batch repeatedly.
- Prefer RESUME (task_id) over fresh relaunch for resumable research scopes: resumption preserves calibrated technique and saves re-deriving context.
- Store results per-entity in memory as the primary cache; a checkpoint file is a secondary crash-safety copy.

## Delegating Browser-Evidence Tasks

Ask the user early (question tool) for artifacts only they can produce — address-bar URLs, run logs, screenshots, DOM snapshots — before spending subagent budget researching or deriving them.

## Well-Known Workflows

Step-by-step task specific guides, explaining what agent team to use, how to route tasks, and how to validate results.

| Workflow | File | Purpose |
|----------|------|---------|
| Task Delegation | [task-delegation-workflow.md](./workflows/task-delegation-workflow.md) | Decompose, route, prompt, validate, and iterate RUG delegation; includes budget-aware task sizing, config-task smoke tests, and method ownership — prompts state outcomes, not command recipes (see [Step 3](./workflows/task-delegation-workflow.md#step-3-construct-the-subagent-prompt)) |
| Sample | [sample-workflow.md](./workflows/sample-workflow.md) | Example of using the RUG orchestrator pattern |
| Installing new software | not implemented | The right approach to install software (eg. using package managers like apt, yum, or brew) |
| Installing python libraries | not implemented | Not implemented |
