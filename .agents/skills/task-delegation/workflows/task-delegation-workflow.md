---
name: task-delegation-workflow
description: >
  Step-by-step guide for decomposing user requests into discrete subagent tasks and routing them to the correct agent type based on scope, expertise, and limitations. Triggers when you need to plan multi-agent workflows, break down complex requests across multiple files or concerns, or determine which specialized agent handles a given task decomposition step.
license: MIT
compatibility: Requires OpenCode
metadata:
  version: "1.9.4"
  author: "edgent-smith team"
  delta: "1.9.4 — the timeout passage states the omit, extend, then tail-and-resume rule with no recorded-run evidence; the per-turn budget fact moves behind a SKILL.md pointer; the tool-limit citation names the code that computes the threshold. 1.9.3 — the budgets table no longer implies an uncapped per-child timeout: the row and the prose both say omit by default and set a value only for an expected overrun. 1.9.2 — one statement per topic: resume (task_id) is the default and a fresh child is reserved for wrong context, a different specialist or fresh judgement; gate commands are named while implementation commands and step order stay with the child; provenance has two homes — this version delta for skill-file edits, the report or commit for work artifacts."
---

# Task Delegation Workflow

This workflow teaches how to decompose any user request into a sequence of discrete, independently-completable subagent tasks and route each to the correct agent type based on scope, expertise, and limitations.

## The RUG Principle

> Decompose first. Delegate everything. Validate independently. Iterate until good.

You are an orchestrator, not an implementer. Every action that touches code, files, or terminal output must be routed through a subagent with explicit scope, constraints, and acceptance criteria. Your role is planning, routing, validation, and iteration — never direct implementation.

## Step 1: Decompose the Request

Break the user's request into discrete tasks. Each task should satisfy all of these conditions:

- **One concern per task** — a single file to create/modify, one research question, or one atomic operation
- **Independently completable** — no task depends on another producing intermediate results that it then reads; if they do, the dependent task must receive its input as explicit parameters in the subagent prompt
- **Bounded scope** — can be completed by a single agent invocation without requiring follow-up clarification about what to work on next
- **Verifiable outcome** — has clear acceptance criteria that a validation subagent can check
- **Fits the subagent budget** — completable within the target agent's tool-call threshold `floor(steps * 0.8)` (`.opencode/plugins/helpers/tool-limit.ts:37`; `rug-swe` declares `steps: 30`, so 24 calls), with calls left over for verification and the report

### Decomposition Checklist

Before launching any subagent, verify each task:

| Criterion | Question to Ask |
|-----------|-----------------|
| One concern? | Does this task address exactly one file, one research question, or one operation? |
| Bounded scope? | Can an agent complete this without needing to ask clarifying questions about what to work on next? |
| Verifiable outcome? | Is there a concrete acceptance criterion I can check when the subagent reports back? |
| Independent? | Does this task require reading output from another task before it starts? If yes, pass that information as explicit context in the prompt. |
| Fits budget? | Can an agent complete this within the target agent's threshold `floor(steps * 0.8)` (24 calls for `rug-swe`), leaving calls for verification and the report? |

### Budget-Aware Task Sizing

Every delegated task must fit the target agent's tool-call threshold `floor(steps * 0.8)` (`.opencode/plugins/helpers/tool-limit.ts:37`), leaving headroom for discovery and verification. Decompose further when a task has:

- **More than 3 requirement areas** — split by area into separate tasks
- **More than 2 phases** — investigate, write, and verify must be separate tasks

Example: "Implement a CLI command with tests and docs" mixes 3 phases — split it into investigate, write, and verify tasks.

When a task cannot be decomposed further, the prompt must include a **resume plan**: expected remaining calls and what the resumer should do first.

### Output and Timeout Budgets

- **Leave `timeout_minutes` unset unless this task is expected to outrun the default.** The default is 15 minutes per subtask and 90 for the workflow (`.opencode/plugins/workflow.ts:228`, `.opencode/plugins/helpers/workflow-types.ts:160`). Set `timeout_minutes` only to extend a task you expect to run longer than that, such as a full test suite, a gate or CI run, or a large enumeration, and raise the enclosing workflow's `timeout_minutes` above the child's when you do. Never set it to shorten a task, and never size it per dispatch. When a child does expire, `subtask_tail({ task_id })` shows its progress and a `task_id` resume continues the same child with a fresh budget; re-dispatching with a larger guessed value spends a fresh child on work the resume already holds. The retired `timeout_seconds` key is rejected: divide a legacy seconds value by 60 and rename it to `timeout_minutes`. Budget arithmetic, per-turn and not a hard block: [Child Budget Accounting](../SKILL.md#child-budget-accounting).
- Keep the reducer under about 2KB. Return only counts, statuses and key data. Never return full transcripts, long evidence strings, or whole file contents; oversized reducers are truncated at about 8KB (logs dropped first, then result, then steps), which loses data and forces re-runs.
- Capture `steps[].task_id` and, on a truncated or empty result, resume that session for a compact status instead of re-running the work.

### Mandatory Split Gate

Run this gate before launching ANY subagent — task sizing is mandatory, not advisory:

- A task estimated to need BOTH investigation AND execution MUST be split into:
  (a) a research/decide subagent that returns a concrete plan, and
  (b) a write+verify subagent that executes that plan
- A task estimated at more than ~20 tool calls MUST be split the same way
- Resume (`task_id`) is the default for any follow-up to a child that produced work; split a task when it is too large, then resume each part. Launch a fresh child only when a resume cannot work: the prior context is wrong, the work needs a different specialist, or the result needs fresh judgement.
- If a task burned its budget on investigation, resuming to finish is acceptable — the split
  rule is what prevents the burn

Example: "Implement a CLI command with tests and docs" is 3 phases — launch a research/decide
subagent for the plan, then a write+verify subagent to execute it. Never one rug-swe task.

### Ground-Truth Smoke Tests for Config Tasks

Config and install tasks MUST include a bounded ground-truth smoke test — run the configured system once and verify it behaves — with at most 2 fix iterations, then report. Declarative introspection (`--dump-config`, schema reads) cannot prove runtime behavior: a config that parses can still fail at startup.

Example: a settings.yaml schema bug is invisible to `--dump-config` but crashes the runtime; the task's acceptance criteria must include "start the service and confirm it responds."

## Step 2: Route to the Correct Agent

Choose the agent based on the task's scope and required expertise. Use this decision matrix:

| Task Type | Agent | Rationale |
|-----------|-------|------------|
| External documentation lookup, version info, API reference | **rug-mcp** | Only agent with live external data access |
| Complex planning, architecture design, validation strategy | **rug-expert** | Requires judgment across multiple dimensions |
| Single-shot file read, search, command execution, config edit | **rug-puppet** | Atomic operation with clear input-output boundary |
| Feature implementation, debugging, refactoring, multi-file changes | **rug-swe** | Requires deep code understanding and cross-file coordination |

### Agent Selection Heuristics

1. **Does the task require live external data?** → rug-mcp (first). Pass retrieved information as context to other agents if needed.
2. **Is this a single atomic operation?** → rug-puppet. Do not combine multiple operations into one call.
3. **Does this involve writing or modifying code across files?** → rug-swe for implementation, rug-expert for planning before implementation.
4. **Does this require judgment, critique, validation, or architecture decisions?** → rug-expert.

## Step 3: Construct the Subagent Prompt

Every subagent prompt must include six elements:

### Required Prompt Structure

| Element | Purpose | Example |
|---------|---------|---------|
| **Context** | What the user asked; why this task exists in the larger flow | "The user asked to draft a skill. This is one step in that workflow." |
| **Scope** | Exactly which files/directories are involved, what to create vs modify | "Create /workspace/.agents/skills/my-skill/SKILL.md with this exact content..." |
| **Acceptance Criteria** | Concrete conditions for "done" — verifiable by a separate agent | "[ ] File exists at specified path. [ ] Contains required frontmatter fields." |
| **Constraints** | What NOT to do — anti-patterns specific to this task | "Do not modify files outside /workspace/.agents/skills/." |
| **Output Expectations** | How the subagent should report results back | "Report: list all created/modified files, confirm each acceptance criterion." |
| **Method Ownership** | The prompt states the outcome; the subagent decides the method | "Achieve X; derive the approach from the `test-design` skill." |

### Method Ownership

Every prompt states WHAT the subagent must achieve; the subagent owns HOW, deriving its method from the skills passed via `skills` and from its own tooling. Name the gate command the result must pass — `just lint`, `just ci-fast` — because a named gate is a checkable acceptance criterion. Never prescribe implementation commands, a command sequence, or step order: an exact `gh` invocation, a git subcommand, or a REST endpoint goes stale, assumes permissions the auth layer may deny, and burns the subagent's budget reinventing an unsanctioned workaround instead of doing the task.

When the user explicitly specifies a technology, library, framework, or approach, echo it as a non-negotiable requirement — a specified technology is a constraint on the outcome, not a command recipe.

### Permission Gate (Never Offer an Unsanctioned Fallback)

A delegation prompt must not ask a subagent to bypass a permission gate or to reproduce a denied effect through any other mechanism. Gated writes (`git add`, `git commit`, `git push`) require explicit user authorization in the current session — an inferred goal is not authorization. When a delegated action is denied, the subagent reports the exact command, the denial, and the intended outcome, then continues with permitted work; the denial is final for that action. Delete any prompt wording that suggests an alternate way to run a gated command.

### Prompt Template

```markdown
CONTEXT: [Original user request quoted verbatim. Why this task exists in the larger flow.]

YOUR TASK: [Specific decomposed action — the outcome to achieve, never the implementation commands or step order]

SCOPE:
- Files to create: [list with full paths]
- Files to modify: [list with full paths, describe expected changes]
- Files to NOT touch: [list or "none"]

ACCEPTANCE CRITERIA:
- [ ] [Criterion 1 — must be verifiable]
- [ ] [Criterion 2]
- ...

CONSTRAINTS:
- Do NOT [constraint 1]
- Do NOT [constraint 2]
- Do NOT bypass or route around a permission gate, and do NOT reproduce a denied effect by another mechanism. Gated writes (`git add`, `git commit`, `git push`) require explicit user authorization in the current session. If an action is denied, report the exact command, the denial, and the intended outcome, then continue with permitted work — the denial is final for that action.

WHEN DONE: Report back with:
1. List of all files created/modified with paths
2. Confirmation that each acceptance criterion is met (PASS/FAIL)
3. Any issues or concerns encountered
```

## Step 4: Validate the Work

After a subagent reports completion, launch a **separate validation subagent** to verify against the original acceptance criteria. Never trust self-assessment. Where the environment cannot spawn a separate reviewer, a human performs the pass.

Validation must be asymmetric: the validator challenges the work AND the criteria, not merely certifying that instructions were followed. Give it the task's intent and the target medium/consumer, and never hand it the expected verdict. An element that served only the source medium's consumers, with no equivalent consumer in the target medium, fails validation regardless of fidelity.

### Scope Attribution Needs a Baseline

A diff alone cannot say who changed what, because the tree may already carry edits made before the producer started. Snapshot at dispatch and give the snapshot to the validator.

- Record the files already modified or untracked before the first subtask launches (`git status --porcelain`, `git diff --numstat`).
- Hand that list to the validator as "pre-existing at t0". Only files and hunks absent from the baseline are producer edits; a pre-existing dirty file is not a scope violation, whatever its subject.
- A scope FAIL names its baseline delta. When no baseline was taken, the validator reads the hunks and their subject before calling them out of scope, and the orchestrator reports the ambiguity instead of accepting the FAIL or fixing files it did not change.

### Validation Checklist

| Check | Method |
|-------|--------|
| File existence and paths | Read the files directly or request file listing |
| Content correctness | Compare output against acceptance criteria line by line |
| Specification compliance | Verify implementation matches specified technologies, patterns, constraints |
| Regression check | Confirm no unintended modifications outside declared scope |

### Validation Prompt Template

```markdown
A previous agent was asked to: [original task description]

The acceptance criteria were:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- ...

VALIDATE by:
1. Reading the files that were supposedly modified/created
2. Checking that each criterion is actually met (not just claimed)
3. Looking for bugs, missing edge cases, or incomplete implementations
4. Confirming no unintended modifications outside declared scope

REPORT per criterion: PASS or FAIL with evidence
```

## Step 5: Iterate Until Good

If validation fails, resume the same `task_id` with the validation failure report and the fix instructions — resume is the default, so send the full report rather than assuming the child remembers the failed attempt. Launch a fresh work child only when a resume cannot work: the prior context is wrong, the work needs a different specialist, or the result needs fresh judgement. If the same agent keeps failing, decompose the task further into smaller pieces.

### Iteration Decision Tree

```
Validation result?
├── All PASS → Proceed to next independent task
├── Partial FAIL → Launch fix subagent for failed criteria only
│   └── Same criteria fails again twice → Decompose further or escalate to rug-expert
└── All FAIL → context was wrong: launch a fresh child for the whole task with fresh instructions; do not patch partial failures
```

## Agents Team Reference

When working through this workflow, these are the four agents available and their routing rules:

| Agent | Role | Trigger | Limitation |
|-------|------|---------|------------|
| **rug-mcp** | External knowledge retrieval | "Look up docs for X" | Cannot read workspace files |
| **rug-expert** | Planning, analysis, validation, architecture | "Analyze/plan/design/critique" | No live external data access |
| **rug-puppet** | Single-shot operations | "Read/search/run/edit one thing" | Not for multi-step workflows |
| **rug-swe** | Feature dev, debugging, implementation | "Implement/debug/refactor across files" | Not for doc lookup or single ops |

## Sample Delegation Flow

Here is an example of how to decompose and route a complex request:

### User Request
> "Create a new CLI command that runs the edge agent with a custom prompt, add it to the justfile shortcut, and write integration tests."

### Decomposition & Routing

| Step | Task | Agent | Why |
|------|------|-------|-----|
| 1 | Read existing `/workspace/cli/main.py` for Click command patterns | rug-puppet | Single file read, structural analysis |
| 2 | Look up Click `@click.command()` decorator docs and parameter conventions | rug-mcp | External API documentation lookup |
| 3 | Design the new command's structure: parameters, output format, error handling | rug-expert | Requires architecture judgment across multiple dimensions |
| 4 | Implement the CLI command in `/workspace/cli/commands/edge_agent.py` | rug-swe | Multi-file implementation requiring deep code understanding |
| 5 | Add justfile shortcut entry to `/workspace/justfile` | rug-puppet | Single file edit, atomic operation |
| 6 | Write integration tests for the new command | rug-swe | Implementation requiring test patterns and edge case design |
| 7 | Validate all changes against acceptance criteria | rug-expert (validation) | Independent verification requires judgment to assess correctness |

## Anti-Patterns to Avoid

### Bundling Unrelated Tasks
> ❌ "Read the CLI module AND look up Click docs AND implement a new command."
> ✅ Three separate subagent calls with one concern each.

### Skipping Validation
> ❌ Trusting the implementation agent's self-assessment that everything works.
> ✅ Always launch a separate validation subagent before considering a task complete.

### Over-delegating Simple Work
> ❌ Sending a single file read to rug-swe.
> ✅ Use rug-puppet for atomic operations; reserve rug-swe for multi-file implementation work.

## Summary

The RUG workflow is simple but strict: **decompose → route → prompt → validate → iterate**. Every step has specific requirements:

1. Decompose into discrete, independently completable tasks with verifiable acceptance criteria
2. Route each task to the agent whose specialization matches the task type
3. Construct prompts with context, scope, acceptance criteria, constraints, output expectations, and method ownership
4. Validate every result with a separate subagent — never trust self-assessment
5. Iterate failures by resuming the same `task_id`; launch a fresh child only for the three cases in Step 5.
