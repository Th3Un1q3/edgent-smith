---
id: experiences/orchestration/envelope-example-must-parse-result
type: experiences
L0: "An executable example beside a prose rule wins: an orchestrator copies the code, so a helper that reads raw .status off subtask_run's JSON string crashed the run"
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-10-23
directory: experiences/orchestration
confidence: 0.9
status: verified
provenance: RUG orchestration retrospective 2026-10-23; crash observed in a live execute body; fix applied to .opencode/agents/rug.md Execution envelope
---
# envelope-example-must-parse-result

CAUSE: `.opencode/agents/rug.md` documented the parse rule in Tooling ("the result is a JSON string ... parse it before any field read") while its own Execution-envelope helper read `first.status`, `first.task_id`, and `first.outputText.trim()` off the raw return. An orchestrator copied the helper verbatim, hit `TypeError: Cannot read properties of undefined (reading 'slice')`, and lost a completed pair of children. Prose does not govern behaviour when a runnable example sits next to it: the example is what gets copied.

RULE: In agent guidance, every executable example must be the working instance of the rule it illustrates, on every branch. A serialized-tool result is parsed before any field read on the first call and again on the resume path (`parse = (r) => JSON.parse(typeof r === 'string' ? r : JSON.stringify(r))`); success is tested by one predicate (`status === 'ok' && !truncated && outputText?.trim()`), never by a bare field read. When a rule and its example disagree, the run fails even though the document reads correctly.

EVIDENCE: TypeError raised by the copied helper; after guarding both paths, the js block parses under `node --check` wrapped in an async function and the helper still resumes at most once and never resumes a call that carried a task_id.

VERIFY: grep the fenced example for field reads on an unparsed value before changing a documented behaviour; a rule repeated in prose and contradicted in code is a defect in the code.

mem: claims/opencode/subtask_result_envelope (the tool-shape fact this experience builds on).