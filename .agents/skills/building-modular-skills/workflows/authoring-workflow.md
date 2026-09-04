# Workflow: Authoring a Modular Skill

Follow this workflow to create or rework a Copilot custom skill as a shaped, multi-file unit: a lean root `SKILL.md`, routed workflow and reference files, and a passing completion gate.

When to load: before you write or restructure any skill; skip this file for lookup questions — the routing table and templates answer those faster.

## Prerequisites

- Read [SKILL.md](../SKILL.md) first — the Principles and the Task Routing Table define what the finished skill must contain.
- Read [context-gathering](../../context-gathering/SKILL.md) — the canonical exemplar of a shaped skill; match its structure and header style.
- Comply with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md) in every file you write — kicker-first, active voice, one idea per sentence, concrete numbers; point to the file instead of restating its rules (Rule 24).
- Read the [anti-pattern map](../references/anti-patterns.md) — the finished skill must carry none of the 9 patterns.

## Steps

1. **Clarify scope and intent** — resolve ambiguity before you write. Ask the user when the request is vague; use the Clarification Triggers below to pin down the outcome.
2. **Name the skill and its failure mode** — pick a descriptive name with a single concern; name the agent failure mode the skill fixes in the description and When to Use (Rule 17). Match the description dialect to the invocation path: a human-facing one-liner for user-invoked skills, a trigger-rich model-facing description for model-invoked skills (Rule 18). Done when: the description names a failure, not a topic.
3. **Decompose into files** — decide what belongs in the root versus workflows versus references. Put invariants and cross-cutting principles in the root; put instances, options, and comparisons in references. Move any section that would push the root past ~90 lines to its own file — see the root template and the split workflow/reference structure in [references/templates.md](../references/templates.md). Keep each reference section to one idea; split a reference past ~250 lines into a sibling file (Rule 19).    Layout:
   ```
   skill-name/
   ├── SKILL.md
   ├── workflows/<name>.md
   ├── references/<name>.md
   ├── recipes/<name>.md
   └── scripts/<name>   # domain helpers only; shared audits in agent_utils/scripts/
   ```
4. **Write the root** — keep the index-and-router lean, ≤ ~90 lines. Include the required frontmatter fields — `name`, `description`, `license`, `compatibility`, `metadata.version`, `metadata.author` — plus When to Use, When Not to Use, Principles, and the Task Routing Table. Copy the skeleton from [references/templates.md](../references/templates.md) and fill it in.
5. **Write workflows** — one per distinct user task or process; each opens with its tools, prerequisites, and order of operations. Match the exemplar header style: title, purpose line, and a "When to load" line. Prefer short paragraphs, bullet lists, and code blocks over long prose. State a "Done when:" signal per step and hard gates between phases (Rule 20). Include clarification triggers — when to ask the user and when to stop.
6. **Write references** — one per API surface, option set, or comparison topic. Define the Vocabulary line here, or point to the Vocabulary line in [references/guidance.md](../references/guidance.md). Keep reference files purely factual — no decision logic or workflow steps.
7. **Write recipes and scripts** — write recipes as reusable step-by-step procedures under `recipes/`; write domain-specific executable helpers under per-skill `scripts/`; do not copy shared audit tooling (`audit_fences.py`, `validate_md_links.py`) — reference `agent_utils/scripts/` per Rule 24.
8. **Place examples next to their rules** — put a copy-pasteable worked example adjacent to each numeric or behavioral rule (positional wiring); "Implements:" labels are optional and never sit inside a code fence. Link every file in the routing table with relative links such as `./workflows/create.md`. Reuse: a workflow or reference file can be linked from multiple root skills. Compose across skills by naming the Skill tool explicitly — naming the tool is what gets it fired (Rule 22).
9. **Write for the reader** — strip meta-commentary and author-process markers before finishing; author-process records live in frontmatter `metadata.delta` (Rule 14). Keep navigation: When to load lines, routing rows, cross-file pointers. Run the Rule 14 audit command from [guidance.md](../references/guidance.md) and `python3 agent_utils/scripts/audit_fences.py .agents/skills/<name>` (or `python3 agent_utils/scripts/audit_fences.py .` from skill root) plus `python3 agent_utils/scripts/validate_md_links.py .agents/skills/<name>`; fix every hit. Verify every fact and example against a trusted source; never trust parametric memory (Rule 23).
10. **Validate** — run the [Shaping Checklist](./shaping-checklist.md) as the completion gate; fix every failing check before you continue. Confirm every linked file loads independently without the root. Confirm the skill stays narrow, names its failure mode, and carries no anti-pattern from [anti-patterns.md](../references/anti-patterns.md). Done when: all 24 checks pass.

## Clarification Triggers

Ask the user before you generate the skill when the request is vague:
- What exact outcome should this skill produce?
- Is the skill meant for a specific repo, language, or toolchain?
- Should the skill target a narrow workflow or a general category?

## Acceptance Criteria

Verify all of these before you declare the skill complete:
- Zero broken links — resolve every cross-reference and grep the tree for stale naming.
- Add a Related Skills section linking to sibling skills so the skill composes with its neighbors.
- [Shaping Checklist](./shaping-checklist.md) passes 24/24 — the checklist covers root leanness, routing, active-verb kickers, examples, fence validity, failure-mode naming, positive prompting, and single-source-of-truth.
- No anti-pattern from the [anti-pattern map](../references/anti-patterns.md) survives in the skill.
