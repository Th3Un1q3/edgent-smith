# Edit-Heavy Tasks: Split Into Surgical Per-Concern Tasks

Oversized implementation tasks fail silently; surgical ones succeed. A batch-recipe rewrite bundled as one task — full script rewrite plus 8 prose fixes — failed or returned empty three times; splitting it into smaller mechanical edits (one-line budget fix, single-file prose edits) succeeded immediately.

When a task is more than one file rewrite with many coupled changes, split it into per-file or per-concern surgical tasks. Orchestrators should rightsize aggressively for edit-heavy work: each subtask touches one file (or one concern) and verifies independently.

Related: mem:skills/general/same-file-extract-rewrite-sequential.