---
name: task-delegation-workflow
description: >
  Step-by-step guide for decomposing user requests into discrete subagent tasks and routing them to the correct agent type based on scope, expertise, and limitations. Triggers when you need to plan multi-agent workflows, break down complex requests across multiple files or concerns, or determine which specialized agent handles a given task decomposition step.
license: MIT
compatibility: github-copilot
metadata:
  version: "1.0"
  author: "edgent-smith team"
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

### Decomposition Checklist

Before launching any subagent, verify each task:

| Criterion | Question to Ask |
|-----------|-----------------|
| One concern? | Does this task address exactly one file, one research question, or one operation? |
| Bounded scope? | Can an agent complete this without needing to ask clarifying questions about what to work on next? |
| Verifiable outcome? | Is there a concrete acceptance criterion I can check when the subagent reports back? |
| Independent? | Does this task require reading output from another task before it starts? If yes, pass that information as explicit context in the prompt. |

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

Every subagent prompt must include five elements:

### Required Prompt Structure

| Element | Purpose | Example |
|---------|---------|---------|
| **Context** | What the user asked; why this task exists in the larger flow | "The user asked to draft a skill. This is one step in that workflow." |
| **Scope** | Exactly which files/directories are involved, what to create vs modify | "Create /workspace/.agents/skills/my-skill/SKILL.md with this exact content..." |
| **Acceptance Criteria** | Concrete conditions for "done" — verifiable by a separate agent | "[ ] File exists at specified path. [ ] Contains required frontmatter fields." |
| **Constraints** | What NOT to do — anti-patterns specific to this task | "Do not modify files outside /workspace/.agents/skills/." |
| **Output Expectations** | How the subagent should report results back | "Report: list all created/modified files, confirm each acceptance criterion." |

### Prompt Template

```markdown
CONTEXT: [Original user request quoted verbatim. Why this task exists in the larger flow.]

YOUR TASK: [Specific decomposed action — what exactly to do]

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

WHEN DONE: Report back with:
1. List of all files created/modified with paths
2. Confirmation that each acceptance criterion is met (PASS/FAIL)
3. Any issues or concerns encountered
```

## Step 4: Validate the Work

After a subagent reports completion, launch a **separate validation subagent** to verify against the original acceptance criteria. Never trust self-assessment.

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

If validation fails, launch a NEW work subagent that includes the validation failure report and specific fix instructions. Do not reuse mental context from the failed attempt — give fresh complete instructions. If the same agent keeps failing, decompose the task further into smaller pieces.

### Iteration Decision Tree

```
Validation result?
├── All PASS → Proceed to next independent task
├── Partial FAIL → Launch fix subagent for failed criteria only
│   └── Same criteria fails again twice → Decompose further or escalate to rug-expert
└── All FAIL → Relaunch entire task with fresh instructions; do not patch partial failures
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
3. Construct prompts with context, scope, acceptance criteria, constraints, and output expectations
4. Validate every result with a separate subagent — never trust self-assessment
5. Iterate failures by relaunching focused tasks with fresh instructions

Apply these principles consistently. The quality of delegation determines the quality of outcomes.
