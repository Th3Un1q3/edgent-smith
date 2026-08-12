# Skill Criteria: Separate Author Obligations from Reader Content

When deriving "criteria of a good skill" from the house standard, split the list in two: AUTHOR obligations (completion gate, Implements wiring, versioning, delta records) and READER content (what teaches the task). Conflating the two ships author-process machinery into the reader-facing root SKILL.md.

Failure mode (2026-08-12 session, automa skill): a criteria derivation treated the completion gate, Implements wiring, and version/delta bookkeeping as reader content, so the root SKILL.md carried author-process sections instead of subject teaching.

Fix: building-modular-skills v3.2.0 — author obligations live outside the reader path (frontmatter `metadata.delta` holds version/provenance; Completion Gate removed from the root template); amended check 6 makes worked-example wiring positional (example adjacent to the rule, labels optional and, when used, in prose outside the fence); validation gained a "no self-referential commentary" grep (Rule/Check 14 audit) that scans the tree for author-process markers.

Next time: derive the criteria twice — once for author obligations, once for reader content — and validate with the self-referential-commentary grep; wire worked examples positionally next to the rule they illustrate, without requiring "Implements:" labels.

Source: operator session 2026-08-12 (building-modular-skills v3.2.0 hardening); verified against SKILL.md L16 (delta), guidance.md Rule 14, shaping-checklist.md checks 6 and 14. Related: mem:skills/general/skill-reader-benefit-no-meta-commentary; mem:skills/general/skill-fence-validity-and-example-facts; mem:skills/general/skill-root-leanness.