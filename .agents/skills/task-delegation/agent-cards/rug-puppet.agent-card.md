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
  Not designed for multi-step workflows or complex reasoning. Each delegation must be a single atomic operation — if the task requires reading then analyzing, searching then comparing, or any sequence of dependent operations, decompose into separate rug-puppet calls or escalate to rug-expert/rug-swe. Never pass full file contents to rug-puppet; it can read files itself when given context and a reference with scope.
---

## Frontmatter Reference

| Field | Value |
|-------|-------|
| **name** | rug-puppet |
| **description** | Simple single-shot tasks — one operation, not multiple. Use for file reads, codebase searches, terminal commands, config edits, and other atomic operations that produce a clear, bounded output. |
| **tasks** | Reading files and reporting structure (not full contents); Searching codebases for patterns, definitions, or usages; Running terminal commands and capturing output; Creating or modifying simple configuration files; File management tasks (copy, move, rename, list directories) |
| **limits** | Not designed for multi-step workflows or complex reasoning. Each delegation must be a single atomic operation — if the task requires reading then analyzing, searching then comparing, or any sequence of dependent operations, decompose into separate rug-puppet calls or escalate to rug-expert/rug-swe. Never pass full file contents to rug-puppet; it can read files itself when given context and a reference with scope. |

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

## Example: Well-Sscoped Task

> "Read /workspace/cli/main.py and report its structure, key methods, imports, and exports. Focus on the Click command registration pattern — list all decorated functions and their parameter configurations."

**Why this works:** Single file read with structured output expectations. Specific focus area (Click patterns). Bounded scope (one file, one structural aspect).

## Example: Bad Task — Scope Creep

> "Look at the CLI module, tell me how the commands are registered, check if there are any circular imports across all files in the cli/ directory, compare the Click decorator patterns to the pydantic-ai agent definitions in agents/, and suggest a refactoring plan to reduce coupling."

**Why this fails:** Combines file reading, import analysis, cross-module comparison, and architectural planning into one prompt. The scope spans three separate directories with four distinct analytical goals. Should be decomposed into: (1) rug-puppet read of cli/ structure, (2) rug-expert analysis of import relationships, (3) rug-expert refactoring plan.

## Example: Bad Task — Irrelevant Scope

> "What is the best way to organize a research lab's paper reading group with weekly meetings and shared notes?"

**Why this fails:** Zero connection to any workspace file, codebase state, or implementation task. This is an organizational advice question, not an operational task requiring agent execution.
