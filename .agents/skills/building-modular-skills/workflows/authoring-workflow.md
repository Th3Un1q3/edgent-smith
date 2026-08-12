# Workflow: Authoring a Modular Skill

Follow this workflow to create or rework a Copilot custom skill as a shaped, multi-file unit: a lean root `SKILL.md`, routed workflow and reference files, and a passing completion gate.

When to load: before you write or restructure any skill; skip this file for lookup questions — the routing table and templates answer those faster.

## Prerequisites

- Read [SKILL.md](../SKILL.md) first — the 9 Principles and the Task Routing Table define what the finished skill must contain.
- Read [context-gathering](../../context-gathering/SKILL.md) — the canonical exemplar of a shaped skill; match its structure and header style.
- Comply with [writing-style.instructions.md](../../../../.github/instructions/writing-style.instructions.md) in every file you write: kicker-first, active voice, one idea per sentence, concrete numbers.

## Steps

1. **Clarify scope and intent** — resolve ambiguity before you write. Ask the user when the request is vague; use the Clarification Triggers below to pin down the outcome.
2. **Name the skill** — pick a descriptive name with a single concern. Use a concise phrase such as `building-modular-skills` or `skill-authoring-guidelines`. Keep it unique and aligned with repo naming conventions.
3. **Decompose into files** — decide what belongs in the root versus workflows versus references. Put invariants and cross-cutting principles in the root; put instances, options, and comparisons in references. Move any section that would push the root past ~90 lines to its own file — see the root template and the split workflow/reference structure in [references/templates.md](../references/templates.md). Layout:
   ```
   skill-name/
   ├── SKILL.md
   ├── workflows/<name>.md
   ├── references/<name>.md
   ├── recipes/<name>.md
   └── scripts/<name>
   ```
4. **Write the root** — keep the index-and-router lean, ≤ ~90 lines. Include the required frontmatter fields — `name`, `description`, `license`, `compatibility`, `metadata.version`, `metadata.author` — plus When to Use, When Not to Use, Principles, and the Task Routing Table. Copy the skeleton from [references/templates.md](../references/templates.md) and fill it in.
5. **Write workflows** — one per distinct user task or process; each opens with its tools, prerequisites, and order of operations. Match the exemplar header style: title, purpose line, and a "When to load" line. Prefer short paragraphs, bullet lists, and code blocks over long prose. Include clarification triggers — when to ask the user and when to stop.
6. **Write references** — one per API surface, option set, or comparison topic. Define the Vocabulary line here, or point to the Vocabulary line in [references/guidance.md](../references/guidance.md). Keep reference files purely factual — no decision logic or workflow steps.
7. **Write recipes and scripts** — write recipes as reusable step-by-step procedures under `recipes/`; write scripts as executable helpers under `scripts/`.
8. **Place examples next to their rules** — put a copy-pasteable worked example adjacent to each numeric or behavioral rule (positional wiring); "Implements:" labels are optional and never sit inside a code fence. Link every file in the routing table with relative links such as `./workflows/create.md`. Reuse: a workflow or reference file can be linked from multiple root skills.

### Step 9 — Write for the reader

Strip meta-commentary and provenance markers before finishing — author-process records live in frontmatter `metadata.delta` (Rule 14). Keep navigation: When to load lines, routing rows, cross-file pointers. Run the Rule 14 grep and the Rule 15 fence-audit script from [guidance.md](../references/guidance.md); fix every hit.

10. **Validate** — run the [Shaping Checklist](./shaping-checklist.md) as the completion gate; fix every failing check before you continue. Confirm every linked file loads independently without the root. Confirm the skill stays narrow and does not solve unrelated tasks.

## Clarification Triggers

Ask the user before you generate the skill when the request is vague:
- What exact outcome should this skill produce?
- Is the skill meant for a specific repo, language, or toolchain?
- Should the skill target a narrow workflow or a general category?

## Acceptance Criteria

Verify all of these before you declare the skill complete:
- Zero broken links — resolve every cross-reference and grep the tree for stale naming.
- Add a Related Skills section linking to sibling skills so the skill composes with its neighbors.
- [Shaping Checklist](./shaping-checklist.md) passes 16/16 — the checklist covers root leanness, routing, active-verb kickers, examples, and fence validity.
