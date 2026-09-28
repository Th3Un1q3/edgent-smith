---
id: ADR-004
title: Workflow and subtask timeouts in minutes
status: accepted
date: 2026-09-23
scope: .opencode/plugins workflow tool - caller-facing workflow and subtask timeout units, defaults, workflow cap, and the internal minutes-to-milliseconds boundary
---

# ADR-004: Workflow and subtask timeouts in minutes

## Decision

Workflow-tool timeouts are expressed in minutes at every level. The caller-facing field is `timeout_minutes` (replacing `timeout_seconds`) on the workflow input and on every subtask input. Defaults: overall workflow 90 minutes; each subtask 15 minutes. The overall workflow timeout caps at 600 minutes (the former 36,000-second cap); the per-subtask timeout keeps no cap and validates only that the value is a finite number greater than 0. Exactly one conversion boundary exists per path, minutes to milliseconds: `.opencode/plugins/workflow.ts` converts the workflow value once with `* 60_000`, and `.opencode/plugins/helpers/workflow-subtask.ts` converts each subtask value once when it derives the Node timer value `timeoutMs`. Every timeout mention in the tool schema, parameter descriptions, documentation, examples, and agent prompts names its unit (minutes). The tool description, documentation, agent prompts, and examples tell callers to omit timeouts unless the default is insufficient: raise the workflow value only when a run genuinely exceeds 90 minutes, and set a subtask value only to bound a child that genuinely exceeds 15 minutes. The renamed input is breaking. The retired `timeout_seconds` key is rejected at both levels with a clear error naming its replacement and the conversion (divide seconds by 60); the implementation never accepts or converts the legacy key. Existing callers must rename `timeout_seconds` to `timeout_minutes` and divide their numeric values by 60.

Status: accepted 2026-09-23.

### Design (planned)

- Unit: minutes at both levels. Field name: `timeout_minutes`.
- Defaults: workflow `DEFAULT_TIMEOUT_MINUTES = 90`; per subtask `DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES = 15`.
- Caps: workflow schema range `1..600` minutes; per-subtask validation `> 0` with no upper cap.
- Conversion: minutes to milliseconds at exactly one boundary per path; the boundary stays documented in code.
- Legacy key: a present `timeout_seconds` rejects the call with a message naming `timeout_minutes` and the divide-by-60 rule, at both the workflow input and the subtask input.
- Guidance: omit timeouts unless necessary, in the tool description, docs, agent prompts, and examples.

## Considerations

### Decision drivers (hard constraints)

- D1 - operator requires minutes as the timeout unit at both levels.
- D2 - one canonical unit per field; no mixed-unit input.
- D3 - no silent behavior change for existing callers.
- D4 - timeouts stay optional; callers are steered away from setting them without need.

### Context

The workflow tool (`.opencode/plugins/workflow.ts`) runs a JS script that orchestrates child subagents through `subtask()`. It exposes an overall workflow timeout and a per-subtask timeout. Today both use seconds: `timeout_seconds` with defaults 600 (workflow) and 300 (per subtask), a workflow schema cap of 36,000, and one seconds-to-milliseconds boundary per path (`.opencode/plugins/workflow.ts` for the workflow value, `.opencode/plugins/helpers/workflow-subtask.ts` for each subtask value). The unit is error-prone: authors reason about runs in minutes, error messages name seconds, and docs mix seconds and minutes. The operator asked to standardize on minutes, set defaults to 90 minutes (workflow) and 15 minutes (subtask), require explicit units everywhere, and discourage setting a timeout unless necessary.

The Conductor YAML engine under `.agents/skills/conductor/**` reuses the field name `timeout_seconds` for its own schema. It is a separate tool, out of scope, and unchanged.

### Options considered

#### Option A: Rename to timeout_minutes and reject the legacy key - CHOSEN

Pros:
- One canonical unit per field; no ambiguity between seconds and minutes.
- Fail-fast for callers that still send `timeout_seconds`.
- Matches the operator requirement directly.

Cons:
- Breaking change; every caller must rename and rescale.
- Touches source, tests, docs, and agent prompts in one pass.

Disposition: chosen - satisfies D1 (minutes), D2 (one unit), D3 (rejection is explicit, never silent).

#### Option B: Add timeout_minutes and accept legacy timeout_seconds, converting to minutes

Pros:
- No break for existing callers; gradual migration.

Cons:
- Two units coexist, so a bare number is ambiguous; `timeout_seconds: 90` means 1.5 minutes while `timeout_minutes: 90` means 90 minutes.
- Conversion silently changes the effective limit for callers that also pass the new field.
- Permanent dual path to maintain and test.

Disposition: rejected - violates D2 (mixed units) and D3 (silent behavior change).

#### Option C: Keep timeout_seconds; change only defaults and guidance

Pros:
- Smallest diff; no rename across files.
- No caller migration.

Cons:
- Keeps seconds, contrary to the operator requirement.
- Leaves the unit mismatch between author intent (minutes) and schema (seconds).
- Requires a lot of mental conversion and is not feasible in the scale of AI powered workflows. There is no need for second precision in a workflow timeout.

Disposition: rejected - violates D1 (operator requires minutes).

#### Option D: Accept flexible duration strings such as 90m or PT90M

Pros:
- Unit is explicit in the value itself; expressive.

Cons:
- Needs a parser and a grammar, plus error handling for malformed input.
- Overkill for two numeric fields with a single fixed unit.
- Diverges from the numeric schema style of every sibling workflow parameter.

Disposition: rejected - extra parsing for no benefit once the unit is fixed to minutes (D1).

### Scoring

Criteria (each -2..+2), per mem:architecture/about - maintainability, flexibility, implementation ease, initial implementation cost (higher = cheaper).

| Criteria | A: rename + reject | B: dual unit | C: keep seconds | D: duration strings |
| --- | --- | --- | --- | --- |
| Maintainability | +2 | -1 | 0 | 0 |
| Flexibility | +1 | +2 | -1 | +2 |
| Implementation ease | +1 | 0 | +2 | -1 |
| Initial implementation cost | -1 | 0 | +2 | -2 |
| Total | +3 | +1 | +4 | -1 |

Constraint override (documented, per ADR rules): raw totals put C above A. D1 requires minutes, which eliminates C; D2 requires one canonical unit, which eliminates B and D. Among the remaining options only A satisfies every driver, so A is selected.

### Consequences

Positive: one unit (minutes) across schema, defaults, errors, docs, examples, and agent prompts; a single documented conversion boundary per path; callers that omit the field get the 90-minute workflow default and the 15-minute child default; the legacy key fails loudly instead of silently changing behavior.

Negative: a breaking rename; every caller that set `timeout_seconds` must divide its value by 60 and rename the key; the schema cap drops from 36,000 to 600 as a unit change only (same wall-clock ceiling).

### Migration

The legacy `timeout_seconds` input is rejected at both the workflow and subtask levels, not converted. Detecting the key and throwing a TypeError that names `timeout_minutes` and the divide-by-60 rule keeps behavior explicit and avoids a silent limit change. Existing callers change: rename `timeout_seconds` to `timeout_minutes` at the workflow level and inside every subtask input, and divide the numeric value by 60 (600 becomes 10, 900 becomes 15, 1800 becomes 30). Callers that relied on the old defaults of 600 seconds and 300 seconds either omit the field (90 and 15 minutes now) or set the previous values explicitly (10 and 5 minutes).

### Implementation plan (follow-ups)

- `.opencode/plugins/workflow.ts` - rename the schema field `timeout_seconds` to `timeout_minutes`; set schema `.min(1).max(600)` and default `DEFAULT_TIMEOUT_MINUTES`; rewrite the field description to name minutes and to say omit unless the 90-minute default is insufficient; update the input-signature line and the example in `WORKFLOW_TOOL_DESCRIPTION`; change the conversion to `(arguments_.timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES) * 60_000`; update the import; add the legacy-key rejection before schema parse.
- `.opencode/plugins/helpers/workflow-types.ts` - rename `SubtaskParameters.timeout_seconds` to `timeout_minutes`; rename `DEFAULT_TIMEOUT_SECONDS = 600` to `DEFAULT_TIMEOUT_MINUTES = 90`; rename `DEFAULT_PER_SUBTASK_TIMEOUT_SECONDS = 300` to `DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES = 15`.
- `.opencode/plugins/helpers/workflow-subtask.ts` - rename `normalizeTimeoutSeconds` to `normalizeTimeoutMinutes` and its TypeError text to name `timeout_minutes`; rename the `timeout_seconds` parameter; reject a present subtask-level `timeout_seconds` with a TypeError naming `timeout_minutes` and the divide-by-60 rule before normalization; update the conversion boundary comment to minutes-to-milliseconds and the expression to `(parameters.timeout_minutes ?? DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES) * 60_000`; update the import.
- `.opencode/plugins/helpers/workflow-runner.ts` - rename the `DEFAULT_TIMEOUT_SECONDS` re-export; keep the internal `timeoutMs` option and its millisecond semantics.
- `.opencode/plugins/tests/workflow.test.ts` - update the `timeout_seconds` validation cases, the schema bound cases (0 and the cap), and the asserted defaults (workflow 90).
- `.opencode/plugins/tests/helpers/workflow-subtask-parameters.test.ts` - rename the field and the TypeError-message assertions to `timeout_minutes`; add a case asserting a present `timeout_seconds` is rejected.
- `.opencode/plugins/tests/helpers/workflow-runner.test.ts`, `.opencode/plugins/tests/helpers/workflow-subtask.test.ts`, `.opencode/plugins/tests/helpers/workflow-subtask-progress.test.ts`, `.opencode/plugins/tests/helpers/workflow-subtask-structured.test.ts` - rename caller-facing `timeout_seconds` to `timeout_minutes` and express values in minutes; internal `timeoutMs` assertions stay.
- `.opencode/agents/rug-workflow.md` - rename the field in the phase-sizing line, the limits table (workflow `timeout_minutes` 90 to 600; per-child `timeout_minutes` 15, none), the long-child guidance (rewrite in minutes against the 15-minute default), and the failure-recovery line; add omit-unless-necessary guidance.
- `docs/workflow-tool.md` - update the quickstart example, the per-subtask parameter table (default 15, unit minutes, omit-unless-needed note), the limits table (range 1 to 600, default 90, minutes), the per-subtask default table (15 minutes), and the timeout error rows to name the field and minutes.
- `.agents/skills/task-delegation/workflows/task-delegation-workflow.md` - rename the fields, set the defaults to 15 and 90 minutes, update the constant name and line reference, and align the advice with omit-unless-necessary.
- Excluded: `.agents/skills/conductor/**` keeps its own `timeout_seconds` schema; this decision does not rename it.

### References

mem:architecture/adr-rules; mem:architecture/adr-template; mem:architecture/adr/ADR-001-envelope-tag-detection; mem:architecture/adr/ADR-003-tag-delimited-structured-output; mem:architecture/about.
Implementation surface: `.opencode/plugins/workflow.ts`, `.opencode/plugins/helpers/workflow-types.ts`, `.opencode/plugins/helpers/workflow-subtask.ts`, `.opencode/plugins/helpers/workflow-runner.ts`; tests under `.opencode/plugins/tests/**`; `.opencode/agents/rug-workflow.md`; `docs/workflow-tool.md`; `.agents/skills/task-delegation/workflows/task-delegation-workflow.md`.
