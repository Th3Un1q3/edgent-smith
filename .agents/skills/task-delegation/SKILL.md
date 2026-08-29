---
name: task-delegation
description: >
  Teaches the RUG (Repeat Until Good) orchestrator pattern for decomposing user requests into discrete, independently-completable agent subagent tasks and routing them to specialized agents based on scope, expertise, and limitations.
license: MIT
metadata:
  version: "1.3"
  author: "Th3Un1qu3"
  delta: >
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
6. Use the `todowrite` tool to track progress and ensure that each subagent completes their task successfully.
7. Use the `question` tool to ask for clarification or additional information from the user as needed.
8. Validate the results of each subagent's work independently, and iterate until the overall task is completed successfully.

## Parity and Porting Tasks Require a Surface Inventory

When the request is a parity or porting task — "as close as possible to X", "mirror", "port", "replicate", "match" — decomposition MUST begin with a source→target surface-mapping discovery, never with task breakdown:

- **Inventory first.** Launch a discovery subagent that inventories EVERY element of the source system (plugins, MCP servers, config files, commands, agents, instructions, env vars, tooling) and maps each to a target disposition: IMPLEMENTED / MIGRATE / DROP-WITH-REASON / DEFER.
- **No silent skips.** Every non-implemented element carries a reason; every DEFER/DROP is documented in the target's user-facing docs (README) before the task counts as done. A skip without a documented reason is a failure.
- **Scope questions enumerate.** When a scope-locking question uses a domain word with repo-specific meaning ("plugins", "MCPs", "harness"), the options must list what it concretely includes in THIS repo — inventory first, then ask.
- **Validation checks the mapping.** Give the validation subagent the mapping table; it must verify each row's disposition (implemented actually implemented; migrate actually wired; defer/drop documented), not just the acceptance criteria. This extends asymmetric validation: the validator judges parity-surface completeness, not merely instruction-following.

## What Not to Do

- Delegate tasks without reading the agent cards and rightsizing the task to the subagent's capabilities.
- Attempt to complete tasks yourself or bypass the RUG orchestrator pattern. All work must be delegated to subagents with explicit scope and acceptance criteria.
- Sticking to the initial plan despite evidence that it is not working. Be flexible and willing to adjust the plan as needed based on feedback and results.

## Size Bulk Edits to Fit Subagent Budgets

- A single-file edit touching more than ~10 independent blocks (one edit per slide/row across many similar elements) PLUS verification exceeds one subagent's tool-call budget — all edits land, verification is left undone.
- Split pattern: (a) an implementation subagent does ONLY the edits, given exact old→new strings so it performs no judgment work; (b) a separate fresh verification subagent checks the result.
- For more than ~20 blocks, split the edits into halves and give each half to its own implementation subagent.
- Judgment work belongs in a design subagent beforehand — the implementer receives only mechanical edits and no decisions.
- If verification stays with the implementer, plan for a resume: at the budget limit the implementer reports "edits done, verification pending" — resume the same session (`task_id`) to finish verification instead of re-doing edits.
- A resume consumes less budget than a relaunch: context reuse beats re-discovery (see Subagent Failure Recovery).

## Subagent Failure Recovery

When a subagent returns no usable output or exhausts its budget without producing code:

1. **Resume before relaunching.** Re-invoke the subagent with the same `task_id` and a prompt like "report what you did and what remains." Context reuse is cheaper than re-discovery. If the resumed subagent still produces nothing, proceed to step 2.
2. **Relaunch with narrow scope.** If resume fails, launch a fresh subagent with a single deliverable, step-by-step instructions, and an explicit directive to produce output immediately. Broad prompts ("implement X, Y, and Z") cause budget exhaustion on discovery — scope each subagent to one deliverable.

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
| Task Delegation | [task-delegation-workflow.md](./workflows/task-delegation-workflow.md) | Decompose, route, prompt, validate, and iterate RUG delegation; includes budget-aware task sizing and config-task smoke tests |
| Sample | [sample-workflow.md](./workflows/sample-workflow.md) | Example of using the RUG orchestrator pattern |
| Installing new software | not implemented | The right approach to install software (eg. using package managers like apt, yum, or brew) |
| Installing python libraries | not implemented | Not implemented |
