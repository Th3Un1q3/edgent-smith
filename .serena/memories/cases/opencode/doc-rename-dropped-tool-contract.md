---
id: cases/opencode/doc-rename-dropped-tool-contract
type: cases
L0: "A rename swept every doc but dropped the tool's clamp and empty-result contract while `just ci` stayed green; the validator caught it by reading each naming doc section against the implementation."
hotness: 1.0
ttl: 365d
version: 1
freshness: 2026-11-24
directory: cases/opencode
status: active
provenance: delegation run 2026-11-24 replacing the in-memory tail tool with the session-backed `subtask_outputs` tool
related: mem:cases/orchestration/rename-sweep-unenumerated-legacy-names
---
# A doc rename that dropped the tool's contract

## Symptom
The rename of the legacy in-memory tail tool to session-backed `subtask_outputs` reached `docs/workflow-tool.md`, `.opencode/agents/rug.md`, the task-delegation skill and its workflow document, and `just ci` passed. The independent validator still returned FAIL: one downstream doc named `subtask_outputs` without stating that `count` clamps to 5 with a default of 3, and that an unknown or empty `task_id` returns an empty array.

## False hypothesis
A green `just ci` plus a zero-hit grep for the old tool name meant the rename had propagated.

## Root cause
The child treating the rename as a string substitution. The behaviour contract lives in code no doc test reads: `subtask-outputs.ts` sets `MAX_OUTPUTS_COUNT = 5`, `DEFAULT_OUTPUTS_COUNT = 3`, and `emptyResult()`. The child rewrote the identifier and left the surface contract unstated, and the mechanical gate compares code against code, so no gate read the doc.

## How confirmed
The validator opened each doc section that names the tool and compared its stated clamp and empty-result behaviour with `subtask-outputs.ts`; one doc carried the name and neither behaviour. After the child added both statements, the same validator passed.

## Prevention
The dispatch author writes the propagation unit as name plus contract: every doc that names a tool states the clamp and the empty-result meaning the implementation enforces, and the validator reads each such doc section against the implementation instead of grepping for the name.