---
name: building-modular-skills
description: >
  Build reusable, focused Copilot custom skills for VS Code using a multi-file layout:
  a root `SKILL.md` index with applicability and routing, individual workflow files for
  step-by-step guidance, and standalone reference files for API or spec details.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
---

# Building Modular Skills

Prefer a **multi-file layout** when authoring Copilot custom skills. Split a skill into three kinds of files:

| File kind | Purpose |
|---|---|
| `SKILL.md` (root) | Front matter, applicability (`When to Use / Not Use`), and a routing table to workflow/reference files |
| `workflows/<name>.md` | A single, focused step-by-step workflow with examples — loaded only when relevant |
| `references/<name>.md` | An API spec, option catalogue, comparison table, or lookup document |

This layout keeps the root file short and scannable, prevents the assistant from loading details it does not need, and makes individual files easy to update or reuse across skills.

## When to Use This Skill

Invoke this skill when:
- The user is creating or refining a Copilot custom skill for a workspace.
- The request is about how to write an effective `SKILL.md`, metadata, applicability, or skill structure.
- You need to turn a multi-step workflow into a reusable skill definition.
- The user asks for a pattern to make skills easier to maintain and compose.

## When Not to Use This Skill

Do not use this skill for:
- General code design or application architecture that is not about Copilot skills.
- Writing non-skill documentation such as README content, tests, or source code comments.
- Fixing a single implementation bug unless the bug is specifically inside a `SKILL.md` authoring workflow.

## Authoring Workflow

1. Clarify the outcome.
   - Identify the exact value the skill should deliver.
   - Ask: Is this a workspace-scoped skill or a personal prompt-style skill?
   - Ask: What concrete user intents should trigger it?

2. Choose a focused skill name.
   - Use a concise phrase such as `building-modular-skills` or `skill-authoring-guidelines`.
   - Keep it unique and aligned with repo naming conventions.

3. Decompose into files.
   - Root `SKILL.md`: front matter, applicability, and a task-routing table only.
   - One file per distinct workflow under `workflows/`.
   - One file per reference topic (API options, comparison tables, spec details) under `references/`.
   - A rule of thumb: if a section would exceed ~40 lines or covers a separable sub-topic, move it to its own file.

4. Write the root `SKILL.md`.
   - Required fields: `name`, `description`, `license`, `compatibility`, `metadata.version`, `metadata.author`.
   - Include `When to Use This Skill` with explicit triggers.
   - Include `When Not to Use This Skill` to avoid overmatching.
   - Add a **Task Routing Table** linking intents to workflow and reference files.

5. Write each workflow file.
   - Explain the step-by-step process clearly with examples.
   - Prefer short paragraphs, bullet lists, and code blocks over long prose.
   - Include clarification triggers: when to ask the user and when to stop.

6. Write each reference file.
   - Catalogue options, parameters, API shapes, or comparison tables.
   - Keep reference files purely factual — no decision logic or workflow steps.

7. Link from the root.
   - Every workflow and reference file must appear in the routing table of the root `SKILL.md`.
   - Use relative links such as `./workflows/create.md` and `./references/options.md`.

8. Validate.
   - Root file must be loadable quickly — no workflow detail, no large code blocks.
   - Each linked file must be independently loadable without needing the root.
   - Confirm the skill is narrow and does not solve unrelated tasks.

## Modular Skill Principles

- **Prefer multi-file layout.** Root file = index and router. Workflows and references = detail files.
- Keep the root `SKILL.md` short: applicability, a routing table, and nothing else.
- One workflow file per distinct user task or process step.
- One reference file per API surface, option set, or comparison topic.
- Prefer explicit applicability over broad heuristics.
- Use clear guardrails: say what the skill is for and what it is not for.
- Make future reuse easier — a workflow or reference file can be linked from multiple root skills.

## Multi-File Skill Layout

Preferred directory structure for any non-trivial skill:

```
.agents/skills/my-skill-name/
├── SKILL.md                    # root — index and router only
├── workflows/
│   ├── create.md               # step-by-step workflow: creating X
│   └── update.md               # step-by-step workflow: updating X
└── references/
    ├── options.md              # API options, parameters, or configuration reference
    └── comparison.md           # comparison tables, decision trees
```

### Root `SKILL.md` Template

```md
---
name: my-skill-name
description: >
  One-sentence summary of what this skill does and when to use it.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: GitHub Copilot
---

# My Skill Name

One-paragraph overview — what the skill is for and what it produces.

## When to Use This Skill

Invoke this skill when:
- Specific user intent 1
- Specific user intent 2

## When Not to Use This Skill

Do not use this skill for:
- Related but out-of-scope task 1
- Broad unrelated task 2

## Task Routing Table

Load only the file relevant to the current task.

| I want to... | File |
|---|---|
| Create a new X | [workflows/create.md](./workflows/create.md) |
| Update an existing X | [workflows/update.md](./workflows/update.md) |
| Look up available options | [references/options.md](./references/options.md) |
| Compare approaches A vs B | [references/comparison.md](./references/comparison.md) |

## Related Skills

- `building-modular-skills`
- `agent-customization`
```

### Workflow File Template (`workflows/<name>.md`)

```md
# Workflow: Create X

Step-by-step guide for [specific task].

## Steps

1. Step one — brief action and why.
2. Step two — brief action and why.
3. Step three — brief action and why.

## Examples

\`\`\`language
// concrete example
\`\`\`

## Clarification Triggers

Ask the user before proceeding if:
- [Ambiguous condition 1]
- [Ambiguous condition 2]
```

### Reference File Template (`references/<name>.md`)

```md
# Reference: Options for X

Complete catalogue of available options, parameters, or API surface.

| Option | Type | Default | Description |
|---|---|---|---|
| `option_a` | `string` | `"default"` | What it controls |
| `option_b` | `boolean` | `false` | What it enables |
```

## Clarification Triggers

If the user request is vague, ask follow-up questions before generating the skill:
- What exact outcome should this skill produce?
- Is the skill meant for a specific repo, language, or toolchain?
- Should the skill target a narrow workflow or a general category?

## Suggested next step

After authoring a modular skill, review the related `agent-customization` guidance and add a reference section linking to sibling skills.
