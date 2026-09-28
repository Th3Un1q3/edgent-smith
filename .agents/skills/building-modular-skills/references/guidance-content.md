# Reference: Content Rules — the Shaping Rules

This reference carries the content rules: what a skill says and how it says it — jargon, writing style, examples, and framing. Each rule names a directive, states why it matters, and points to the file where it applies. [workflows/shaping-checklist.md](../workflows/shaping-checklist.md) turns the shaping rules into the completion gate — one check per rule. Rules 3, 4, 5, 6, 14, 15, 16, and 21 live here; [guidance-structure.md](./guidance-structure.md) holds the structure rules (1, 2, 7, 8, 9, 19); [guidance-process.md](./guidance-process.md) holds the process rules (10, 11, 12, 13, 17, 18, 20, 22, 23, 24, 25), the anti-patterns pointer, and the worked example. Rule numbering stays stable across the split.

**When to load:** when a [Shaping Checklist](../workflows/shaping-checklist.md) check points at a content rule, or a review flags one.

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

**Applied in:** [guidance-process.md](./guidance-process.md) "Example application: shaping a skill"; [authoring-workflow.md](../workflows/authoring-workflow.md) examples step.

## Rule 6: Wire every rule to a worked example

Every numeric or behavioral rule needs a copy-pasteable worked example placed adjacent to it — same section, immediately below or beside the rule. Positional wiring lets the reader see the connection without a label. "Implements:" labels are optional; when used, they sit in prose outside the fence, never inside it.

A rule without an example leaves the model to invent code; invented code drifts from intent. An example that fails to parse teaches broken output — see Rule 15.

**Applied in:** [templates-workflow-reference.md](./templates-workflow-reference.md) example pattern; [guidance-process.md](./guidance-process.md) "Example application: shaping a skill".

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

## Rule 21: Prompt the positive; prune no-ops

Every negative directive carries a positive reframe beside it. Steering by prohibition drags the forbidden behaviour into context and makes it more available — prompt the positive instead. Prune no-op instructions the model already obeys by default; an instruction that pays load to say nothing is cut. Lead with the action word (Verify, Name, Run) so the model can start.

Prohibition names the failure; a reframe names the behaviour.

**Example:** `Never trust parametric memory` → `Verify every fact against a trusted source.`

**Applied in:** every skill file body; [shaping-checklist.md](../workflows/shaping-checklist.md) check 21.
