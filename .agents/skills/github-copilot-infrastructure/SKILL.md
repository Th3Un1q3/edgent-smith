---
name: github-copilot-infrastructure
description: >
  Set up, maintain, audit, and troubleshoot GitHub Copilot customization
  infrastructure. Use when defining or reviewing the boundary between
  instructions, agents, skills, and prompts; deciding whether guidance should
  auto-apply by scope or stay on demand; organizing workspace-level
  customization files; or fixing cases where customizations are ignored,
  over-applied, or hard to maintain.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1q3
---

# GitHub Copilot Infrastructure

Use this skill when the problem is the GitHub Copilot customization stack
itself: you need to tell what each file is for, where it should live, what
already exists, or why the current setup feels confusing, overlapping, or hard
to maintain.

This skill helps you answer practical questions such as "Should this be an
instruction, prompt, agent, skill, or hook?", "What is already in the repo
before I add anything?", and "How do I keep the stack understandable over
time?"

Keep this entry page short. Start with one route below, then load only the linked
workflow or reference you need.

### Route Hints

- New here: start with the first row in the routing table.
- Scan: inventory the current instructions, prompts, agents, skills, and hooks before deciding what to change.
- Audit: evaluate that inventory for overlap, discovery problems, wrong ownership, and missing links.
- Maintenance: keep a working stack small, current, and well-owned as the repo changes.

## When to Use This Skill

Invoke this skill when:
- The user wants to set up workspace-level Copilot customization files.
- The task is to decide whether behavior belongs in an instruction, agent,
  skill, or prompt.
- The task is to decide whether scoped guidance should live in a targeted
  instruction or in a skill.
- The user wants a maintenance or governance playbook for Copilot
  customizations.
- The request is to audit an existing customization stack for overlap, drift,
  or missing coverage.
- Instructions, skills, agents, or prompts seem to be ignored, misapplied, or
  hard to discover.

## When Not to Use This Skill

Do not use this skill for:
- General application code changes unrelated to Copilot customization.
- Writing a single prompt, instruction, agent, or skill when the structure is
  already known and no infrastructure decision is needed.
- Runtime debugging of project code where Copilot customization loading is not
  part of the problem.

## Task Routing Table

Load only the file relevant to the current task. If you are unsure where to
start, use this order: learn the file roles first, scan what already exists,
audit the current split if needed, then move to file placement, setup,
maintenance, troubleshooting, or validation.

| Question or outcome | File |
|---|---|
| I am new to this. What should be an instruction, prompt, agent, skill, or hook? | [references/responsibility-split.md](./references/responsibility-split.md) |
| What already exists in this repo before I change anything? | [workflows/scan-and-compose-existing-customizations.md](./workflows/scan-and-compose-existing-customizations.md) |
| I already have the inventory. Is the current stack clear, discoverable, and correctly split? | [workflows/audit-existing-stack.md](./workflows/audit-existing-stack.md) |
| Where should this file live, what should it be called, and what frontmatter does it need? | [references/file-locations-and-frontmatter.md](./references/file-locations-and-frontmatter.md) |
| Set up a clean GitHub Copilot customization stack from scratch | [workflows/initial-setup.md](./workflows/initial-setup.md) |
| How do I keep an existing stack small, current, and easy to understand over time? | [workflows/maintenance-and-governance.md](./workflows/maintenance-and-governance.md) |
| Customizations are being ignored, over-applied, or loaded in the wrong place | [workflows/troubleshoot-loading-and-application.md](./workflows/troubleshoot-loading-and-application.md) |
| What practical rules help me keep boundaries clean while I design or review the stack? | [references/patterns-and-heuristics.md](./references/patterns-and-heuristics.md) |
| What should I check before I call an infrastructure change done? | [references/validation-checklist.md](./references/validation-checklist.md) |
| What common design mistakes should I avoid? | [references/anti-patterns.md](./references/anti-patterns.md) |

## Related Skills

- [building-modular-skills](../building-modular-skills/SKILL.md): leave this skill when you already know the content belongs in a skill and want help shaping that skill's structure, files, and internal routing.
- `agent-customization`: switch to this when you already know which single customization file you want to create, update, or fix and need task-focused help on that edit rather than stack-level design.