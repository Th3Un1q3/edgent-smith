---
name: mandatory-fields-in-spec-tables
id: lessons/delegation/mandatory-fields-in-spec-tables
description: A delegated unit defines its mandatory fields, and a row that drops one is a failed row, not a paraphrase.
scope: experiences
type: experiences
status: active
confidence: high
timestamp: 2026-10-25
freshness: 2026-10-25
ttl: 180d
L0: "Delegation units name mandatory fields; a row dropping a risk tag is failed, not paraphrased."
tags: [delegation, output-shape, validation]
sources:
  - .agents/skills/task-delegation/SKILL.md
provenance: 2026-10-25 review run; a validator caught a dropped LOW risk tag after a writer paraphrased a table row.
---

# Mandatory fields in spec tables

- **Idea.** A delegated unit defines the mandatory fields on each row, not only the row count.
- **Scope.** Amendment, audit, and findings tables a writer copies or fills.
- **Rationale.** An amendment table that left the risk tag implicit let the writer drop a required `LOW`; a validator caught it and cost a repair round.
