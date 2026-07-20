---
name: rug-puppet
description: "Simple single-shot tasks — one operation, not multiple. Use for file reads, codebase searches, terminal commands, config edits, and other atomic operations that produce a clear, bounded output."
tasks: |
  - Reading files and reporting structure (not full contents)
  - Searching codebases for patterns, definitions, or usages
  - Running terminal commands and capturing output
  - Creating or modifying simple configuration files
  - File management tasks (copy, move, rename, list directories)
limits: >
  Not designed for multi-step workflows or complex reasoning. Each delegation must be a single atomic operation — if the task requires reading then analyzing, searching then comparing, or any sequence of dependent operations, decompose into separate rug-puppet calls or escalate to rug-expert/rug-swe. Never pass full file contents to rug-puppet; it can read files itself when given context and a reference with scope. It can't load skills.
---

# Agent Card: rug-puppet

## Overview

rug-puppet handles atomic, single-shot operations that produce clear bounded output. Each delegation must be one operation — if you need multiple steps, launch separate delegations rather than combining them into one prompt.

### When to Delegate to rug-puppet

- "Read [file] and report its structure, key methods, imports, and exports"
- "Search for [pattern] in the codebase"
- "Run [command] and summarize the output"
- "List all files matching [criteria] in [directory]"
- Any single atomic operation with a clear input-output boundary

### When NOT to Delegate to rug-puppet

- Multi-step analysis requiring reasoning across results (use rug-expert)
- Live documentation lookups (use rug-mcp)
- Feature implementation or debugging (use rug-swe)
- Complex planning or architecture decisions (use rug-expert)
- Reading and outputting a complete file's contents verbatim. None of the subagents are designed to output full file contents. Ask specific questions about the file's structure, methods, or patterns instead.

## Examples

## GOOD: Well-Scoped Task

> "Read /workspace/cli/main.py and report its structure, key methods, imports, and exports. Focus on the Click command registration pattern — list all decorated functions and their parameter configurations."

**Why this works:** Single file read with structured output expectations. Specific focus area (Click patterns). Bounded scope (one file, one structural aspect).

## BAD: Scope Creep

> "Look at the CLI module, tell me how the commands are registered, check if there are any circular imports across all files in the cli/ directory, compare the Click decorator patterns to the pydantic-ai agent definitions in agents/, and suggest a refactoring plan to reduce coupling."

**Why this fails:** Combines file reading, import analysis, cross-module comparison, and architectural planning into one prompt. The scope spans three separate directories with four distinct analytical goals. Should be decomposed into: (1) rug-puppet read of cli/ structure, (2) rug-expert analysis of import relationships, (3) rug-expert refactoring plan.

## BAD: Reading Full File Contents


```markdown
CONTEXT: ESLint violations have been fixed. Now I need the CURRENT contents of the TypeScript-erroring files to produce precise type fix instructions. The line numbers may have shifted due to previous edits.

TASK: Read and report the FULL contents of these 4 files (the ones with typecheck errors):

1. `/workspace/.opencode/plugins/rug-team.ts`
2. `/workspace/.opencode/plugins/tests/__utils__/kv-store.mock.ts`
3. `/workspace/.opencode/plugins/tests/instructions-loader.test.ts`
4. `/workspace/.opencode/plugins/tests/tool-limit-reminder.test.ts`

For each file, report the COMPLETE contents line by line. I need this to produce exact type fix instructions.
```

**Why this fails:** every agent has limits on how much they can read and output. rug-puppet is not designed to read and output full file contents. Instead, ask specific questions about the file's structure, methods, or patterns.

Better framed task:

```markdown
CONTEXT: ESLint violations have been fixed. Now I to check if the files contain the fixes I expect.

TASK: Read and report the table with the line numbers and answers for these 2 files (the ones with typecheck errors):

1. `/workspace/.opencode/plugins/rug-team.ts` - quote the lines that implement session status tracking.
2. `/workspace/.opencode/plugins/tests/__utils__/kv-store.mock.ts` - What lines are annotated with eslint ignore comment, show them in context of 2 lines before and after
```

