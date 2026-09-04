# Reference: Rules — the 24 Shaping Rules

This reference carries the canonical rules behind the index-and-router skill structure. Each rule names a directive, states why it matters, and points to the file where it applies. [workflows/shaping-checklist.md](../workflows/shaping-checklist.md) turns these 24 rules into the completion gate — one check per rule.

**When to load:** whenever you author, rework, or review a modular skill and need the reasoning behind the structure rules; before you run the [Shaping Checklist](../workflows/shaping-checklist.md) to declare a skill complete; whenever a review flags a rule violation.

## How to use this reference

Read the rule behind a failing checklist check. Run the [Shaping Checklist](../workflows/shaping-checklist.md) first — it runs the fix→re-run loop; this file holds the reasoning.

## Vocabulary

These terms carry load-bearing meaning. Define each once in a Vocabulary line; reuse the term verbatim everywhere else. Decode non-load-bearing jargon inline.

- **rule** — a directive the Shaping Checklist verifies; the 24 rules map one-to-one to the 24 checks.
- **root** — the always-loaded SKILL.md; the skill's index and router.
- **file type** — a file under `workflows/`, `references/`, `recipes/`, or `scripts/`; loads only when the task matches.
- **routing table** — the completeness contract; every file gets one row.
- **applicability** — the When to Use / Not Use sections that decide when a skill triggers.
- **overmatching** — triggering when the skill should not, from a too-broad description.
- **clarification triggers** — questions to ask before authoring when the request is ambiguous.
- **guardrails** — numeric limits (line budgets, token caps) that prevent bloat.
- **completion gate** — the mandatory [Shaping Checklist](../workflows/shaping-checklist.md); one unchecked box means the skill is NOT complete.
- **"Implements:"** — optional label wiring a rule to its worked example; allowed only in prose outside code fences, never inside one.
- **failure mode** — a named way an agent run goes wrong; a skill exists to fix one.
- **progressive disclosure** — keeping always-loaded content minimal and pushing detail to files that load on match.
- **positive reframe** — the actionable instruction that replaces a prohibition; say what to do, not what to avoid.
- **no-op instruction** — guidance the model already obeys by default; it pays load to say nothing.
- **trigger-rich description** — a frontmatter description packed with user-phrase triggers so auto-invocation fires.

## Rule 1: Keep the root lean

Root is the always-loaded surface. Every line costs tokens on every trigger. Keep root = metadata + triggers + minimal workflow skeleton + one-line cross-cutting principles + routing + related skills. Keep the root at or under ~90 lines; evict sub-domain rule prose to the owning reference; keep one pointer line. The workflow skeleton holds pointers, not workflow steps. Each cross-cutting principle fits on one line.

Root loads on every trigger; workflows and references load only on match. A long root raises token cost on every trigger and buries the routing table.

**Audit method:** grep the root for sub-domain vocabulary — budget numbers, key schemes, phase labels. Literal rule prose is the smell. Routing-table triggers are fine.

**Applied in:** [SKILL.md](../SKILL.md) root layout; [authoring-workflow.md](../workflows/authoring-workflow.md) step 4.

## Rule 2: Write principles in active voice

Principles are directives with active-verb kickers. "Verify every write" is a directive; "Cache discipline" is a topic label. State one idea per sentence. Ban "step 0", "(general)", and bare phase labels from principle text.

Noun labels name a topic; they tell the model nothing to do. Active verbs give the model an action to take.

**Applied in:** [SKILL.md](../SKILL.md) Principles section; [authoring-workflow.md](../workflows/authoring-workflow.md) principles step.

## Rule 3: Define jargon once

Define load-bearing terms once in a Vocabulary line in the relevant reference; decode non-load-bearing jargon inline at first use. Keep factual tool names as-is; define or replace conceptual jargon. Define-don't-delete: terms that recipes use must survive renames.

Undefined jargon forces readers to guess; guessed meanings drift. Recipes and workflows break when the term they use disappears.

**Applied in:** Vocabulary lines in reference files.

## Rule 4: Comply with the writing style

Skill prose must comply with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md) — kicker-first, active voice, one idea per sentence, concrete numbers. Point readers to the style file for the rules; this skill holds no copy of them (Rule 24).

Skill prose is instruction a model executes. Nominalizations and passives blur who does what; a restated copy drifts from the original.

**Applied in:** every file this skill owns. [shaping-checklist.md](../workflows/shaping-checklist.md) check 4 spot-checks compliance.

## Rule 5: Generalize beyond the originating task

Do not overfit to the originating task. Let the general workflow lead. Put specific applications in clearly-labeled "Example application:" sections at the end of the file.

A skill overfit to one task fails every other task. The general workflow keeps the skill reusable.

**Applied in:** [guidance.md](./guidance.md) "Example application: shaping a skill" below; [authoring-workflow.md](../workflows/authoring-workflow.md) examples step.

## Rule 6: Wire every rule to a worked example

Every numeric or behavioral rule needs a copy-pasteable worked example placed adjacent to it — same section, immediately below or beside the rule. Positional wiring lets the reader see the connection without a label. "Implements:" labels are optional; when used, they sit in prose outside the fence, never inside it.

A rule without an example leaves the model to invent code; invented code drifts from intent. An example that fails to parse teaches broken output — see Rule 15.

**Applied in:** [templates.md](./templates.md) example pattern; [guidance.md](./guidance.md) "Example application: shaping a skill" below.

## Rule 7: State principles before instances

State general invariants in the root; apply them per instance in recipes. Never scope a general invariant to one instance — one store, one tool, one task. Verify-after-write is general, not scoped to one instance.

A rule scoped to one instance reads as a special case. Readers miss the general invariant when prose names one instance.

**Applied in:** [SKILL.md](../SKILL.md) Principles; [authoring-workflow.md](../workflows/authoring-workflow.md) decomposition step.

## Rule 8: Keep routing complete

Every file gets a routing row in the root — templates included. The routing table is the completeness contract. Adding a file without a row is a defect.

Exception: shared tooling under `agent_utils/scripts/` (`audit_fences.py`, `validate_md_links.py`) is single source per Rule 24; do not copy into per-skill `scripts/` and do not add routing rows for these shared scripts. Per-skill `scripts/` holds domain-specific helpers only.

An unlinked file never loads; the model cannot reach it. The routing table makes file coverage checkable at a glance.

**Applied in:** [SKILL.md](../SKILL.md) Task Routing Table. [shaping-checklist.md](../workflows/shaping-checklist.md) check 8 verifies it.

## Rule 9: Orient the first-time reader

Every recipe and workflow opens with tools (or a pointer to them), prerequisites, and order of operations. Decode jargon or define it inline.

A reader without tools or order wastes tokens discovering both. Orientation lets the reader start the first step immediately.

**Applied in:** workflow and recipe file headers; [templates.md](./templates.md) workflow template.

## Rule 10: Write acceptance criteria

Write measurable pass/fail acceptance criteria per recipe and workflow.

Unmeasurable criteria block grading.

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) acceptance criteria; [templates.md](./templates.md) workflow template.

## Rule 11: Guard parallel edits

Declare canonical tokens (tool names, section anchors, principle names) centrally. Verify cross-file references resolve. Validation greps the full tree for stale naming.

Parallel editors diverge when each renames a different occurrence. Full-tree greps catch what partial sweeps miss.

**Applied in:** central token declarations in [SKILL.md](../SKILL.md); full-tree validation at [shaping-checklist.md](../workflows/shaping-checklist.md) check 11.

## Rule 12: Version every change

Bump the version on every content change. Record deltas so future sessions verify against disk, not stale text.

Unversioned content leaves future sessions comparing against stale text. A delta note records what moved and why.

**Applied in:** `metadata.version` in [SKILL.md](../SKILL.md) frontmatter; [templates.md](./templates.md) frontmatter template.

## Rule 13: Practice what you preach

Audit your own skill against this checklist. A skill about skills must pass its own gate.

A gate that fails its owner proves nothing. Passing your own gate makes the checklist credible.

**Applied in:** [shaping-checklist.md](../workflows/shaping-checklist.md) check 13 — the checklist applies to this skill too.

## Rule 14: Write for the reader, not the author

Every sentence, heading, and code fence must teach the skill's subject. Author-process machinery is prohibited in body prose: meta-commentary labels ("Implements:", "Example fragment:", "Notes on the example", "Steps:"), provenance markers ("(verify against …)", "verified against …"), "## Source anchors" sections, self-referential prose about a file's own construction ("This file parses as JSON…", "Recipes point here…", "the table is the completeness contract"), and "## Completion Gate" headings that tell the author to run a checklist. Concept usage that names a gate or label to teach it — "run the completion gate", "completion gate" as a term — is allowed; the audit targets the machinery, not the concept. Navigation is allowed and required: When to load lines, routing tables, cross-file pointers, and subject-naming headings ("## Examples", "## Steps"). Author-process history — version, delta notes, origin records — lives in frontmatter metadata, never in body prose.

The reader pays tokens for every line. Content that describes how the skill was built teaches nothing about the task; content that describes the task teaches the task.

**Audit method:** grep the skill tree for author-process machinery:
Run: `grep -rEn '^## Completion Gate|^## Source [Aa]nchors|Implements:|Example fragment:|Notes on the example|\(verify against|verified against|the table is the completeness contract' . --include='*.md'` — expect no matches outside the documented exception categories: frontmatter `metadata.delta`; the audit command text itself; this rule's own enumeration of prohibited phrases; Vocabulary entries and guidance that name a prohibited label to teach where it may sit (Rule 6 and its example application, check 6, workflow step 8); and gate text in [shaping-checklist.md](../workflows/shaping-checklist.md) — checks' pass and run statements may name the markers they audit (checks 6, 14, 23).

**Applied in:** every skill file body; [shaping-checklist.md](../workflows/shaping-checklist.md) check 14.

## Rule 15: Make every code fence valid

Every code fence must be valid for its declared language. A ```json fence must parse with `json.loads`; JSON has no comments, so no `//` or `#` lines inside JSON fences. A fence holding several documents fails to parse — wrap multi-document fragments in a JSON array or split them into one fence per document. A partial fragment is still a valid JSON value (object, array, or scalar) that parses on its own. Fences that declare no language carry plain text only. The audit matches both `` ``` `` and `~~~~` fence runs so template files using `~~~~md` get the same coverage.

A skill whose examples do not parse teaches broken output; a skill whose job is emitting JSON proves itself with fences that parse.

**Audit method:** run the shared fence audit (single source per Rule 24):
Run: `python3 agent_utils/scripts/audit_fences.py .agents/skills/<name>` — or `python3 agent_utils/scripts/audit_fences.py .` from the skill root — expect zero violations printed.
Run: `python3 agent_utils/scripts/validate_md_links.py .agents/skills/<name>` — expect zero broken links.
The scripts live in `agent_utils/scripts/` as single source; do not copy into per-skill `scripts/` (Rule 8 shared-tooling exception). The fence audit matches both ``` and `~~~~` fences and parses every ```json fence with `json.loads`.

**Applied in:** every skill file's examples; [shaping-checklist.md](../workflows/shaping-checklist.md) check 15.

## Rule 16: Make examples match the skill's own facts

Every example must use the shapes, schema, labels, and option keys the skill's own references define. A node example follows the node format the schema reference defines; a label exists in the skill's catalog; an option key is one the references document. No legacy, invented, or placeholder format contradicts a reference the same skill ships. When a reference changes, every example in the tree changes with it.

A self-contradicting skill teaches the wrong format; the reader copies the example, not the reference.

**Audit method:** cross-check every label and key in each example against the skill's own references; run the skill's validation commands on its worked examples.

**Applied in:** every skill file's examples; [shaping-checklist.md](../workflows/shaping-checklist.md) check 16.

## Rule 17: Fix a named failure mode

A skill exists to fix a named agent failure mode, not to cover a topic. Name the failure the skill fixes in the frontmatter description and the When to Use section. Mandate nothing structural: a workflow needs no AI, no checkpoint, and no schedule unless the failure shows it does. One adapter means a hypothetical seam; two adapters means a real one.

A topic-shaped skill triggers on anything and fixes nothing; a failure-shaped skill has a measurable job.

**Example:** `Fix model misalignment in interviews: grill the interviewee until claims resolve to specifics.` Rejected framing: `Conduct professional interviews with good judgement.`

**Applied in:** [templates.md](./templates.md) root template description; [authoring-workflow.md](../workflows/authoring-workflow.md) step 2; [anti-patterns.md](./anti-patterns.md) entries 3, 4, 6.

## Rule 18: Match the description to the invocation path

User-invoked skills get a human-facing one-line description and no trigger lists. Model-invoked skills get trigger-rich descriptions — user-phrase triggers so auto-invocation fires: "Use when the user wants to build features or fix bugs test-first, mentions 'red-green-refactor'…".

A trigger list in a human-facing line reads as noise; a model-facing one-liner never fires.

**Example:** user-invoked — `Summarize a codebase into a 10-line architecture note.` Model-invoked — `Use when the user wants to build features or fix bugs test-first, mentions 'red-green-refactor' or 'TDD'.`

**Applied in:** [templates.md](./templates.md) root template description; [authoring-workflow.md](../workflows/authoring-workflow.md) step 2.

## Rule 19: Disclose progressively; sprawl is the failure mode

Keep always-loaded content minimal; push detail into companion files that load on match. Push too little down and the top bloats; push too much and you hide material the agent actually needs. Budgets: root ≤ ~90 lines (Rule 1); each reference section = one idea; a reference that passes ~250 lines splits its detail into a sibling file — the rules reference keeps every rule in one file so the rule→check mapping stays checkable. Reusable audit tooling lives in `agent_utils/scripts/` as single source per Rule 24 (exception to Rule 8); domain-specific helpers live under per-skill `scripts/`; one-line greps stay with the rule that teaches them.

Sprawl is the failure mode: a document simply too long buries the actionable step.

**Example:** a ~90-line root carries one pointer line per file; the 30-line option detail sits in `references/options.md`, loaded on match.

**Applied in:** [SKILL.md](../SKILL.md) root; [templates.md](./templates.md) root template; [authoring-workflow.md](../workflows/authoring-workflow.md) step 3; `agent_utils/scripts/audit_fences.py`.

## Rule 20: Make every instruction executable or gated

Every instruction is executable or gated. Each step states its "Done when:" completion signal; hard gates stop the run ("No red-capable command, no Phase 2"); observable signals say "It's working if…"; honest limits list out-of-scope work and skip conditions ("Skip phases only when explicitly justified").

Vague advice tells the model nothing to do; a gated step tells it when it may move.

**Example:** `2. Write the failing test. Done when: the test fails for the expected reason. No red-capable command, no Phase 3.`

**Applied in:** [templates.md](./templates.md) workflow template; [authoring-workflow.md](../workflows/authoring-workflow.md) step 5.

## Rule 21: Prompt the positive; prune no-ops

Every negative directive carries a positive reframe beside it. Steering by prohibition drags the forbidden behaviour into context and makes it more available — prompt the positive instead. Prune no-op instructions the model already obeys by default; an instruction that pays load to say nothing is cut. Lead with the action word (Verify, Name, Run) so the model can start.

Prohibition names the failure; a reframe names the behaviour.

**Example:** `Never trust parametric memory` → `Verify every fact against a trusted source.`

**Applied in:** every skill file body; [shaping-checklist.md](../workflows/shaping-checklist.md) check 21.

## Rule 22: Compose via explicit tool calls

Cross-skill invocation names the Skill tool explicitly — naming the tool is what gets it fired. Skills delegate to primitives: one interview primitive powers five workflows. Reference a primitive by path and call it by name; never re-describe its steps.

Prose mentions never fire; a named tool call does.

**Example:** `Call the interview primitive with the Skill tool on interview.md.` Not: `Follow the interview process described in the other file.`

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) step 8.

## Rule 23: Never invent behavior or trust parametric memory

Verify every fact and example against a trusted source — docs, repo files, this skill's own references — never parametric memory. Never invent new behaviour: resolve, never `--abort`. Finding facts is the agent's job, never the user's; do not ask the user for anything you could look up yourself.

An invented flag ships a lie; an unverified example teaches broken output.

**Example:** before shipping an example flag, run the reference's validation command on it; verify a claimed CLI flag against the tool's docs.

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) step 10; [anti-patterns.md](./anti-patterns.md) entries 7, 8.

## Rule 24: Keep one source of truth

Do not duplicate content captured in other artifacts; reference it by path or URL instead. A restated rule is a second source of truth that drifts. Style rules live in the style file; this skill points to it (Rule 4) and restates none of it.

Two copies diverge; one reference stays true.

**Example:** `Comply with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md).`

**Applied in:** [guidance.md](./guidance.md) Rule 4; [authoring-workflow.md](../workflows/authoring-workflow.md) prerequisites; [anti-patterns.md](./anti-patterns.md) entry 9.

## Anti-patterns to avoid

[anti-patterns.md](./anti-patterns.md) maps the 9 failure patterns this skill guards against to the preventing rules 17-24. Consult it when you review a skill; fix every pattern it names.

## Example application: shaping a skill

This section is a labeled example at the end of the file, per Rule 5. It demonstrates Rules 1, 3, 6, and 8 on a fictional tree; `skill-name` is a placeholder, not a real skill.

- **Tree:** `skill-name/` holds SKILL.md, `workflows/`, `references/`, `recipes/`, and `scripts/`. The root routes to every file.
- **Lean root (Rule 1):** SKILL.md runs ~90 lines at most: metadata, When to Use, When Not to Use, Principles, routing table, Related Skills. It carries one pointer line per file and no sub-domain rule prose.
- **Root sketch (Rule 1):** one routing row reads `| references/templates.md | template patterns | load on authoring |`. The row points; the rules live in the file.
- **Vocabulary line (Rule 3):** `references/templates.md` opens with `- **snippet** — a reusable code block with a named rule citation.`
- **Routing row (Rule 8):** the routing table lists every file, templates included; adding a file without a row is a defect.
- **Worked example (Rule 6):** `recipes/example.md` opens with the snippet example placed directly below the rule it implements — adjacency carries the connection, no "Implements:" label.

The general guidance leads; this section stays labeled and last. It is the reference's own worked example for Rule 6.
