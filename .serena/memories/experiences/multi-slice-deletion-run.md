---
name: multi-slice-deletion-run
id: experiences/multi-slice-deletion-run
description: Multi-slice deletion runs gate inside each slice, sweep code-level strings as documentation, and hand validators the per-slice sanctioned file list.
scope: lessons/orchestration/deletion-runs
type: experiences
status: active
confidence: high
timestamp: 2026-10-28
freshness: 2026-10-28
ttl: 180d
L0: "Deletion run: lint and typecheck inside each slice; sweep tool descriptions and error strings as docs; give validators the per-slice sanctioned file list."
tags: [orchestration, deletion, lint, complexity, docs-sweep, validation, scope]
sources:
  - .agents/skills/task-delegation/SKILL.md
  - mem:lessons/orchestration/exact-file-set-counting
provenance: 13-slice deletion run, 2026-10-28; 816 tests and typecheck green across slices, two regressions (complexity 11 > 8, one stale tool description) caught before completion.
---

# Multi-slice deletion run

## Rules

- **Gate inside each slice.** Removing a wrapper can dedent a callback into the enclosing arrow and push cyclomatic complexity past the cap (observed 11 > 8); run lint after every code-moving slice, and typecheck at the slice boundary, so the extract that fixes it lands in the slice that caused it. A per-increment gate caught it within the same slice; extracting `runAttempt` fixed it.
- **Code-level strings are documentation.** A docs sweep covers tool descriptions, JSON schemas, and error strings, not only markdown: a `subtask_ls` description still read "child subtasks and their forks" after 12 increments because the sweep stopped at .md files and only the final validator caught it. Grep the descriptions and error strings; name them in the sweep list.
- **Hand each validator the sanctioned file list for that slice.** A validator given a generic scope warning reports a sanctioned docs/guidance sweep as out-of-scope and counts pre-existing staged files against the run. The prompt carries the expected files and markers per slice; anything outside them is external, not a failed criterion.

## Evidence

13 slices; all 816 tests and typecheck stayed green; the only regressions were the complexity breach and the stale description. Two producers stopped at partial and finished on resume with the exact target name plus explicit cascade authorization; artifact probes (file body, identifier count) were more reliable than child reports.
