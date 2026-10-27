---
id: lessons/orchestration/skill-scouting-triggers
L0: "Skill scouting: run a find-skills pass at every new stage, every 8 dispatches, and on domain change; ad hoc skill loading is not a substitute."
freshness: 2026-10-25
provenance: lessons/orchestration/find-skills-per-stage
---
# Skill scouting triggers

Observed: one find-skills pass across many stage changes. It returned context-gathering and building-modular-skills (used), and grilling/unslop (not directly used).

Later stages — evaluation design, conductor workflows, ADRs, harness and agent definitions, grading — were handled by ad hoc discovery by known name, which missed systematic alternatives.

Fix: trigger a find-skills pass at every stage boundary, every 8 dispatches, and on a domain change; log the skills chosen and rejected in the report. Ad hoc loading by known name is not a substitute.

Precursor memory (narrower, still active): lessons/orchestration/find-skills-per-stage.
