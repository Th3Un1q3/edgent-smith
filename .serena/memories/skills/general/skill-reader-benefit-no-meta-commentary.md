# Skill Content: Reader Benefit, No Meta-Commentary

Every line of a skill's body must benefit the user reading it while completing the task. Body content teaches the subject; anything that describes the skill's own construction or the authoring process is prohibited in the reader path.

- **Prohibited (Rule 14 list):** "Implements:" labels (especially inside JSON fences), provenance/verification markers ("(verify against …)", "## Source anchors" sections), self-referential construction prose ("Recipes point here…", "This file parses as JSON…", "the table is the completeness contract"), and author-process directives (a "## Completion Gate" section in a domain skill's root).
- **Allowed:** navigation — When-to-load lines, routing rows, cross-file pointers — and subject-naming headings ("## Examples", "## Steps").
- **Where author-process history lives:** frontmatter `metadata.delta` (version, delta notes, provenance) — never body prose.
- **Exception:** in a meta-skill (building-modular-skills) the reader IS the author, so its own root Completion Gate is reader-relevant — documented in its SKILL.md.

Failure mode (2026-08-12 session, automa skill): the reader-facing root and references carried "Implements:" labels inside JSON fences, "(verify against …)" markers, "## Source anchors" sections, self-referential prose, and a "## Completion Gate" section — none of it teaching the subject.

Fix: building-modular-skills v3.2.0 Rule/Check 14 "Write for the reader, not the author"; Completion Gate removed from the root template; the audit greps the tree for the prohibited patterns and expects zero matches in body prose.

Next time: after authoring or editing a skill, grep the tree for `Implements:|Example fragment:|verify against|Source anchor|completion gate` and clear every body hit outside frontmatter `metadata.delta` and the meta-skill's own gate.

Source: operator session 2026-08-12 (building-modular-skills v3.2.0 hardening); verified against SKILL.md L16/L53, guidance.md Rule 14, shaping-checklist.md check 14, templates.md L61. Related: mem:skills/general/building-modular-skills-contradiction-resolution; mem:skills/general/skill-root-leanness.