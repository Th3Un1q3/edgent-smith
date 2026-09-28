# Reference: Process Rules — the Shaping Rules

This reference carries the process rules: how a skill is planned, versioned, validated, and composed, plus the cross-cutting reference-direction rule. Each rule names a directive, states why it matters, and points to the file where it applies. [workflows/shaping-checklist.md](../workflows/shaping-checklist.md) turns the shaping rules into the completion gate — one check per rule. Rules 10, 11, 12, 13, 17, 18, 20, 22, 23, 24, and 25 live here; [guidance-structure.md](./guidance-structure.md) holds the structure rules (1, 2, 7, 8, 9, 19); [guidance-content.md](./guidance-content.md) holds the content rules (3, 4, 5, 6, 14, 15, 16, 21). Rule numbering stays stable across the split.

**When to load:** when a [Shaping Checklist](../workflows/shaping-checklist.md) check points at a process rule; when you decide whether a skill may reference a repository instruction file; or when you need the anti-patterns pointer or the worked example application.

## Rule 10: Write acceptance criteria

Write measurable pass/fail acceptance criteria per recipe and workflow. Unmeasurable criteria block grading.

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) acceptance criteria; [templates-workflow-reference.md](./templates-workflow-reference.md) workflow template.

## Rule 11: Guard parallel edits

Declare canonical tokens (tool names, section anchors, principle names) centrally. Verify cross-file references resolve. Validation greps the full tree for stale naming. Parallel editors diverge when each renames a different occurrence; full-tree greps catch what partial sweeps miss.

**Applied in:** central token declarations in [SKILL.md](../SKILL.md); full-tree validation at [shaping-checklist.md](../workflows/shaping-checklist.md) check 11.

## Rule 12: Version every change

Bump the version on every content change. Record deltas so future sessions verify against disk, not stale text. Unversioned content leaves future sessions comparing against stale text; a delta note records what moved and why.

**Applied in:** `metadata.version` in [SKILL.md](../SKILL.md) frontmatter; [templates-root.md](./templates-root.md) frontmatter template.

## Rule 13: Practice what you preach

Audit your own skill against this checklist. A skill about skills must pass its own gate. A gate that fails its owner proves nothing; passing your own gate makes the checklist credible.

**Applied in:** [shaping-checklist.md](../workflows/shaping-checklist.md) check 13 — the checklist applies to this skill too.

## Rule 17: Fix a named failure mode

A skill exists to fix a named agent failure mode, not to cover a topic. Name the failure the skill fixes in the frontmatter description and the When to Use section. Mandate nothing structural: a workflow needs no AI, no checkpoint, and no schedule unless the failure shows it does. One adapter means a hypothetical seam; two adapters means a real one. A topic-shaped skill triggers on anything and fixes nothing; a failure-shaped skill has a measurable job.

**Example:** `Fix model misalignment in interviews: grill the interviewee until claims resolve to specifics.` Rejected framing: `Conduct professional interviews with good judgement.`

**Applied in:** [templates-root.md](./templates-root.md) root template description; [authoring-workflow.md](../workflows/authoring-workflow.md) step 2; [anti-patterns.md](./anti-patterns.md) entries 3, 4, 6.

## Rule 18: Match the description to the invocation path

User-invoked skills get a human-facing one-line description and no trigger lists. Model-invoked skills get trigger-rich descriptions — user-phrase triggers so auto-invocation fires: "Use when the user wants to build features or fix bugs test-first, mentions 'red-green-refactor'…". A trigger list in a human-facing line reads as noise; a model-facing one-liner never fires.

**Example:** user-invoked — `Summarize a codebase into a 10-line architecture note.` Model-invoked — `Use when the user wants to build features or fix bugs test-first, mentions 'red-green-refactor' or 'TDD'.`

**Applied in:** [templates-root.md](./templates-root.md) root template description; [authoring-workflow.md](../workflows/authoring-workflow.md) step 2.

## Rule 20: Make every instruction executable or gated

Every instruction is executable or gated. Each step states its "Done when:" completion signal; hard gates stop the run ("No red-capable command, no Phase 2"); observable signals say "It's working if…"; honest limits list out-of-scope work and skip conditions ("Skip phases only when explicitly justified"). Vague advice tells the model nothing to do; a gated step tells it when it may move.

**Example:** `2. Write the failing test. Done when: the test fails for the expected reason. No red-capable command, no Phase 3.`

**Applied in:** [templates-workflow-reference.md](./templates-workflow-reference.md) workflow template; [authoring-workflow.md](../workflows/authoring-workflow.md) step 5.

## Rule 22: Compose via explicit tool calls

Cross-skill invocation names the Skill tool explicitly — naming the tool is what gets it fired. Skills delegate to primitives: one interview primitive powers five workflows. Reference a primitive by path and call it by name; never re-describe its steps. Prose mentions never fire; a named tool call does.

**Example:** `Call the interview primitive with the Skill tool on interview.md.` Not: `Follow the interview process described in the other file.`

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) step 8.

## Rule 23: Never invent behavior or trust parametric memory

Verify every fact and example against a trusted source — docs, repo files, this skill's own references — never parametric memory. Never invent new behaviour: resolve, never `--abort`. Finding facts is the agent's job, never the user's; do not ask the user for anything you could look up yourself. An invented flag ships a lie; an unverified example teaches broken output.

**Example:** before shipping an example flag, run the reference's validation command on it; verify a claimed CLI flag against the tool's docs.

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) step 10; [anti-patterns.md](./anti-patterns.md) entries 7, 8.

## Rule 24: Keep one source of truth

Do not duplicate content captured in other artifacts; reference it by path or URL instead. A restated rule is a second source of truth that drifts. Style rules live in the style file; this skill points to it (Rule 4) and restates none of it. Two copies diverge; one reference stays true.

**Example:** `Comply with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md).`

**Applied in:** [guidance-content.md](./guidance-content.md) Rule 4; [authoring-workflow.md](../workflows/authoring-workflow.md) prerequisites; [anti-patterns.md](./anti-patterns.md) entry 9.

## Rule 25: Keep skills self-contained (reference direction)

Instructions load on a file-edit trigger and MAY point into a skill. A skill MUST NOT require reading an instruction file — a skill loads on a task trigger, so the edit that would auto-load that instruction may never happen; the skill inlines the content it needs. Preferred direction is instruction → skill. Exception: a skill whose subject is authoring instructions, the harness, or skills (`harness-management`, `building-modular-skills`, `skill-creator`) may name and point into instruction files. When a rule must both auto-apply on edits and guide a skill, keep the instruction copy for auto-application and a self-contained copy in the skill, and put the cross-reference in the instruction, never routed from the skill. An outbound skill → instruction path is unreachable at execution time; an inlined copy stays reachable.

**Example:** `context-gathering` inlines the gateway guard instead of pointing at `serena-gateway.instructions.md`; the instruction MAY point back into the skill.

**Applied in:** every authored skill's references and routing; [SKILL.md](../SKILL.md) root principle.

## Anti-patterns to avoid

[anti-patterns.md](./anti-patterns.md) maps the 9 failure patterns this skill guards against to the preventing rules 17-24. Consult it when you review a skill; fix every pattern it names.

## Example application: shaping a skill

This section is a labeled example at the end of the file, per Rule 5. It demonstrates Rules 1, 3, 6, and 8 on a fictional tree; `skill-name` is a placeholder, not a real skill.

- **Tree:** `skill-name/` holds SKILL.md, `workflows/`, `references/`, `recipes/`, and `scripts/`. The root routes to every file.
- **Lean root (Rule 1):** SKILL.md runs ~90 lines at most: metadata, When to Use, When Not to Use, Principles, routing table, Related Skills. It carries one pointer line per file and no sub-domain rule prose.
- **Root sketch (Rule 1):** one routing row reads `| references/templates-root.md | template patterns | load on authoring |`. The row points; the rules live in the file.
- **Vocabulary line (Rule 3):** `references/templates-root.md` opens with `- **snippet** — a reusable code block with a named rule citation.`
- **Routing row (Rule 8):** the routing table lists every file, templates included; adding a file without a row is a defect.
- **Worked example (Rule 6):** `recipes/example.md` opens with the snippet example placed directly below the rule it implements — adjacency carries the connection, no "Implements:" label.

The general guidance leads; this section stays labeled and last. It is the reference's own worked example for Rule 6.
