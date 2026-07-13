---
name: rug-swe
description: "Senior software engineer — feature development, debugging, refactoring, testing, and implementation tasks requiring deep code understanding and multi-file changes. Use when the task involves writing or modifying application logic across one or more files."
tasks: |
  - Implementing features from specification with multi-file coordination
  - Debugging issues by tracing root causes through call stacks and data flow
  - Refactoring components to meet new criteria while preserving behavior
  - Writing comprehensive tests covering edge cases and integration scenarios
  - Analyzing error logs, stack traces, or failing test output to identify defects
limits: >
  Not for external documentation lookup (use rug-mcp first). Avoid for simple single-shot operations — if the task is reading one file, running a command, or searching for a pattern, use rug-puppet instead.rug-swe handles complex implementation work that spans multiple files and requires architectural understanding of how changes interact.
---

# Agent Card: rug-swe

## Overview

rug-swe acts as a senior software engineer for implementation tasks requiring deep code understanding across multiple files. Use it when the user's request involves writing, modifying, or debugging application logic that cannot be resolved through simple file inspection alone.

### When to Delegate to rug-swe

- "Implement [feature] in [files], following [constraints]"
- "Debug [issue] in [module]. Trace root cause"
- "Refactor [component] to meet [criteria]"
- "Write tests for [functionality] covering edge cases and integration scenarios"
- Any implementation task requiring multi-file coordination or architectural understanding

### When NOT to Delegate to rug-swe

- Simple file reads, searches, or command execution (use rug-puppet)
- External documentation lookups (use rug-mcp first, then pass findings as context)
- Planning and analysis without implementation (use rug-expert for the plan, then rug-swe for execution)

## Task Scoping Guidelines

### Rightsizing Tasks

Good:
- Scaffold test file: pending tests, imports, and basic structure for `my_module.py` in `/workspace/my_module/`.
- Implement one test case for `my_function` in `my_module.py`, following test-driven-development skill. Proceed for test case to pass.
- Run tests for X: identify failing, pick one test, find root cause, fix, and verify passing. Repeat for each failing test.

Bad:
- Implement all tests for `my_module.py` in `/workspace/my_module/`, covering every edge case and integration scenario. (Too broad, unbounded scope)
- Refactor all tests in `/workspace/my_module/` to use a new testing framework. (Too broad, unbounded scope)
- Implement a new feature.
- Complete more than one task.

### GOOD: Well-Scoped Task


> "Create a draft for a new cli command in `cli/init.py`. Add a placeholder test in `tests/test_cli.py` to verify the command is registered.Only interface, arguments processing and help text. No implementation logic. Update `cli/__init__.py` to register the new command."

**Why this works:** 

### BAD: Telling how and not what

#### Example 1

```markdown
- Read the file using `cat`, by running bash with `cat /workspace/.opencode/plugins/tests/helpers/mock-utils.ts` to read what was already created((the read tool is blocked, use terminal commands).
```

**Why this fails:** As orchestrator you don't know the tools available to the agent. The prompt should not dictate how to read the file.

Instead, the prompt should focus on what needs to be done, not how to do it. The agent can figure out the implementation details. Also no need for absolute paths.

```markdown
- Read the file .opencode/plugins/tests/helpers/mock-utils.ts to understand what was already created.
```

#### Example 2

```markdown
## Step 1: Read all 3 test files completely


cat /workspace/.opencode/plugins/tests/helpers/instruction-context-helper.test.ts
echo "---SEPARATOR---"
cat /workspace/.opencode/plugins/tests/helpers/instruction-indexer.test.ts  
echo "---SEPARATOR---"
cat /workspace/.opencode/plugins/tests/instructions-loader.test.ts
```

```markdown
Read the following test files:
- /workspace/.opencode/plugins/tests/helpers/instruction-context-helper.test.ts
- /workspace/.opencode/plugins/tests/helpers/instruction-indexer.test.ts
- /workspace/.opencode/plugins/tests/instructions-loader.test.ts
```

#### Example 3

```markdown
Use `cat /workspace/.opencode/plugins/tests/helpers/mock-utils.ts` to read what was already created. Also read all 4 test files using `cat`.


### BAD: Scope Creep

> "Fix the CLI, make it faster, add support for more agents, improve the eval system, and also refactor the whole thing to use a different framework."

**Why this fails:** Five unrelated improvement goals in one prompt. No specific files or functions targeted. "Make it faster" has no measurable success criterion. "Refactor the whole thing" is unbounded scope. Each of these should be separate tasks with individual acceptance criteria.

### BAD: Irrelevant Scope

> "Design a mobile app architecture for tracking daily meditation habits with streaks, reminders, and social sharing features."

**Why this fails:** Zero connection to the Python/Click/pydantic-ai workspace. The user's codebase is a CLI-based agentic system; requesting a mobile app architecture demonstrates complete misalignment between the request and available implementation context.
