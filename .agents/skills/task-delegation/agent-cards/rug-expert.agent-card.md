---
name: rug-expert
description: "Complex multi-step work, planning, validation, and deep analysis. Use for architecture design, refactoring plans, quality assurance, requirements analysis, and any task requiring judgment across multiple dimensions."
tasks: |
  - Planning and producing implementation plans with discrete steps
  - Architecture design and system-level reasoning
  - Validation, critique, and quality assurance of work products
  - Analyzing codebases to identify patterns, dependencies, and risks
  - Producing structured reports with acceptance criteria
limits: >
  Cannot access live external documentation. When research requires up-to-date library docs, framework APIs, or current version information, delegate to rug-mcp first. Do not attempt web searches directly.
---

## Frontmatter Reference

| Field | Value |
|-------|-------|
| **name** | rug-expert |
| **description** | Complex multi-step work, planning, validation, and deep analysis. Use for architecture design, refactoring plans, quality assurance, requirements analysis, and any task requiring judgment across multiple dimensions. |
| **tasks** | Planning and producing implementation plans with discrete steps; Architecture design and system-level reasoning; Validation, critique, and quality assurance of work products; Analyzing codebases to identify patterns, dependencies, and risks; Producing structured reports with acceptance criteria |
| **limits** | Cannot access live external documentation. When research requires up-to-date library docs, framework APIs, or current version information, delegate to rug-mcp first. Do not attempt web searches directly. |

---

# Agent Card: rug-expert

## Overview

rug-expert handles complex multi-step work requiring planning, analysis, judgment, and structured reasoning. It is the primary agent for architectural decisions, implementation planning, validation strategies, and any task where the outcome depends on synthesizing multiple pieces of information.

### When to Delegate to rug-expert

- "Analyze [scope] and produce a plan"
- "Design the architecture for [system]"
- "Validate these changes against criteria X, Y, Z"
- "Produce a refactoring plan before touching files"
- Any task requiring structured reasoning across multiple dimensions

### When NOT to Delegate to rug-expert

- Simple file reads or searches (use rug-puppet)
- Live documentation lookups (use rug-mcp)
- Feature implementation with clear specs (use rug-swe)

## Example: Well-Sscoped Task

> "Analyze the `/workspace/evals/` directory structure. Identify all runner configurations, baseline data files, and evaluation entry points. Produce a plan with 4 discrete steps for extending evals to support a new model benchmark type. For each step specify: what must be done, which files are involved, dependencies on other steps, and acceptance criteria."

**Why this works:** Single analysis goal. Concrete scope (evals/ directory). Clear output format (plan with structured steps). Specific inclusion/exclusion constraints.

## Example: Bad Task — Scope Creep

> "Look at the evals system and figure out how everything works, then tell me what's wrong with it, suggest improvements, check if there are any security issues, and also look at how the agents work because they might be related."

**Why this fails:** Multiple unrelated concerns (architecture review + security audit + agent analysis). No single outcome. Unbounded scope. The agent will either produce shallow coverage of everything or get lost in tangents.

## Example: Bad Task — Irrelevant Scope

> "Design a complete microservices architecture for a global e-commerce platform with payment processing, inventory management, and real-time analytics."

**Why this fails:** Zero connection to the current workspace or user's actual problem. The agent has no context about existing systems, tech stack, team size, budget constraints, or deployment targets. Produces generic advice rather than actionable plans.
