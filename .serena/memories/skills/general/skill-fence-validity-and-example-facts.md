# Skill Fences: Valid for Declared Language, Examples Match Facts

Every code fence must be valid for its declared language, and every example must use the shapes, schema, labels, and option keys the skill's own references define. A skill whose examples do not parse teaches broken output; a self-contradicting skill teaches the wrong format — the reader copies the example, not the reference.

- **Rule/Check 15 (fences valid):** ```json fences must parse with `json.loads`; JSON has no comments, so no `//` or `#` lines inside JSON fences; multi-document fragments parse as a JSON array or split one fence per document; a partial fragment is still a valid JSON value; fences declaring no language carry plain text only.
- **Rule/Check 16 (examples match facts):** example shapes, schema, labels, and option keys come from the skill's own references; no legacy, invented, or placeholder format contradicts a reference the same skill ships; when a reference changes, every example in the tree changes with it.

Failure mode (2026-08-12 session, automa design-patterns regression): examples used a legacy `blockId`/`options` node format that contradicted the skill's own workflow-json-schema (nodes are `label`/`type`/`data` under `drawflow.nodes`); JSON fences carried comment lines and multi-document fragments that failed `json.loads`.

Fix: building-modular-skills v3.2.0 added Rule/Check 15 and Rule/Check 16; the audit parses every ```json fence with `json.loads` and cross-checks example labels/keys against the skill's references.

Next time: run the fence-parsing audit on every `.md` file after edits; when validating a skill, cross-check each worked example's labels and option keys against the references the skill ships, and run the skill's own validation commands on its examples.

Source: operator session 2026-08-12 (building-modular-skills v3.2.0 hardening); verified against guidance.md Rules 15-16, shaping-checklist.md checks 15-16. Related: mem:skills/general/skill-review-generality-actionability; mem:skills/general/skill-reader-benefit-no-meta-commentary.