---
id: ADR-009
title: Skill-Usage Heuristics over Historic Sessions
status: proposed
date: 2026-10-19
scope: OpenCode v2 harness — skill effectiveness measurement and skill/harness improvement, replacing the retired skill-usage-tracker plugin
---

# ADR-009: Skill-Usage Heuristics over Historic Sessions

## Decision

Skill-usage measurement moves from a live per-session plugin to six named heuristics applied to historic OpenCode sessions with existing OpenCode tools. ADR-009 supersedes the retired `skill-usage-tracker` plugin; no plugin replaces it.

| Heuristic | Signal | Threshold | Action |
|---|---|---|---|
| Budget Overrun | Steps between skill load and session end, derived from the exported session transcript | Per-skill `maxSteps`, opt-in only: `test-design` 8, `context-gathering` 12 | Flag the session for forensics |
| Overrun Forensics | The flagged session's tool-call sequence: repeated tool+args, error results, retries, dead ends; workflow envelopes; quality-gate results | None (bounded to flagged sessions) | Record a one-line finding naming the expensive pattern |
| Skill Rewrite | A forensics finding attributable to the skill's own guidance | Recurrence in ≥2 flagged sessions, or one high-cost occurrence | Edit the skill's `SKILL.md` |
| Dead Skill | Skill absent from `loadedSkills` and from prompt-injected `<task_skills>` envelopes across the window | Zero loads in the window (≥20 sessions or 30 days) | Removal candidate |
| Correlated Rewrite | Sessions loading skill X versus baseline: error/retry rate and median session length | ≥2× baseline over ≥3 sessions | Rewrite candidate; forensics first |
| Re-measure | Heuristics 1 and 5 recomputed on sessions after the edit | ≥3 post-change sessions; delta-since-load median falls, no error/retry regression | Keep and close the finding, else revert |

Thresholds stay opt-in with the numeric rationale beside the number. Findings batch into a review artifact; nothing interrupts a running task.

## Considerations

### Context

The `skill-usage-tracker` plugin is retired. It tracked two per-session signals: `loadedSkills: Record<name, {source: 'tool'|'prompt', loadedAtStep}>` — `prompt` from a `<skill name="...">` regex over the first user message, `tool` from a `skill` tool call, first load winning — and `stepCount`, incremented on every `tool.execute.before` except `tool === 'skill'`. Its only derived metric was `stepCount - loadedAtStep`, compared strictly greater-than a per-skill threshold from `harness.config.ts` (`test-design` 8, `context-gathering` 12). It wrote a `ProblemStatement` into `sessionReview`, and `tool-limit-reminder.ts` exported the session and rendered `.tmp/session-review/<sessionID>/problems.md`. It never aggregated across sessions, read outcomes or errors, or measured whether a change helped.

Seven heuristics survive: a delta-since-load budget rather than absolute session length; two acquisition channels with provenance and first-load-wins anchoring; excluding the `skill` tool from step counting because loading is not work; strictly-greater-than crossing so equality stays within budget; opt-in thresholds with the rationale encoded beside the number; report-don't-interrupt batching instead of mid-task steering; and carrying the signals forward to cross-session aggregation.

The replacement runs on tools the repo already has: exported session transcripts (the `session-insights` schema), tool-call counts from the migrated `tool-limit-reminder` counters, workflow envelopes, quality gates, and the `just agent_utils/export-opencode-session` exporter. Historic exports retain every `skill` tool call and every prompt-injected `<task_skills>` block, so both acquisition channels and step counts remain reconstructible.

### Process

**Cadence.** Run the review on demand before a skill or harness change, and after every such change as the mandatory Re-measure step. Run a periodic sweep when ≥20 new exported sessions have accumulated since the last review, or monthly, whichever comes first.

**Gather.** Export each session in the window with `just agent_utils/export-opencode-session`. For each export, read the transcript in `session-insights` schema order; count tool-call parts after each skill's load part, excluding `skill` calls, to compute the delta-since-load. Read per-session tool-call totals from the migrated `tool-limit-reminder` counters. Read workflow envelopes and quality-gate results to separate a skill problem from a failing gate or an aborted run. Collect prompt-injected `<task_skills>` names for the provenance channel. Apply heuristic 1 to every session that loaded a configured skill, then heuristics 2–5 to the flagged set.

**Record.** Append one row per finding to a review artifact (`.tmp/session-review/<window>/skill-usage.md`) with columns: heuristic, skill, signal values, threshold, action, status. Link the exact session IDs and the offending tool calls. When a change lands, write the edit and the Re-measure result back into the same row, so each finding closes with evidence rather than an assertion. Record removal candidates with their zero-load evidence and the review window. An unconfigured skill yields no finding: silence means "not measured", not "healthy".

### Options considered

#### Option A: Keep the skill-usage-tracker plugin

Pros:
- Automatic and real-time; the live `stepCount` hook counts steps exactly.
- Code exists; only thresholds and config remain.

Cons:
- Per-session only; it never aggregated across sessions, which is the measurement this decision needs.
- Hardcoded thresholds in a TypeScript plugin config; every threshold change is a code change.
- Quarantined; it duplicates the `tool-limit-reminder` consumer path it feeds.
- Maintains a plugin, a hook, and a storage namespace to produce one subtraction.

#### Option B: Manual review only, no defined heuristics

Pros:
- No tooling and no false positives.
- Reviewers spend effort only on questions they already suspect.

Cons:
- No named metrics, no thresholds, no repeatable output.
- No re-measure step, so a change cannot be shown to help.

#### Option C: Named heuristics over historic sessions with existing OpenCode tools

Pros:
- No plugin; measurement reuses exported sessions, counters, envelopes, and gates.
- Cross-session aggregation, which the plugin never performed.
- Opt-in thresholds keep the rationale beside the number.
- Report-don't-interrupt batching and a mandatory re-measure loop.

Cons:
- Step counting is export-derived, so it is coarser than the live hook.
- Depends on exports being retained and complete.
- Measurement lags the session by one review window.
- Thresholds need calibration against real distributions.

#### Option D: Do nothing, drop skill-usage measurement

Pros:
- Zero cost and no new process to follow.

Cons:
- Loses the seven retained heuristics, including the delta-since-load budget.
- Leaves skill pruning and rewriting without evidence.

### Scoring

Criteria (each scored -2 to +2):
- Maintainability — ease of understanding and evolving over time
- Flexibility — adaptability to future requirements
- Implementation ease — straightforwardness with the current stack
- Initial implementation cost — effort to build (higher score = cheaper)

| Criteria | Opt A | Opt B | Opt C | Opt D |
|---|---|---|---|---|
| Maintainability | -2 | +2 | +2 | +2 |
| Flexibility | -1 | -2 | +2 | -2 |
| Implementation ease | +1 | +2 | +1 | +2 |
| Initial implementation cost | +2 | +2 | +2 | +2 |
| Total | 0 | +4 | +7 | +4 |

Option C wins on score. Options B and D are additionally **disqualified by constraint override**: the replacement must produce repeatable, named heuristics with thresholds and a re-measure loop, which neither a heuristic-free manual review nor dropping measurement provides. Option A is eliminated on the same constraint plus its per-session-only scope — it cannot perform the cross-session aggregation the decision requires.

### Consequences

Positive:
- Removes a plugin, a hook, and a storage namespace; measurement runs on exported sessions and existing counters.
- Aggregates across sessions for the first time, so dead skills and correlated rewrites become visible.
- Re-measure closes the loop: every skill edit carries before-and-after evidence.
- Thresholds stay opt-in with the rationale beside the number, and unconfigured skills are explicitly unmeasured.

Negative:
- Export-derived step counts are coarser than the live hook; the `skill`-tool exclusion moves from the counter to the parser.
- Coverage starts when export capture starts; sessions predating the retirement have no `loadedSkills` records to backfill, and the review lags sessions by one window.
- Correlation is not causation: a long session may be a hard task, not a bad skill, and the forensics step must separate them.
- No mid-task interruption means a bad skill stays bad until the next review.

### Alternatives considered

- **Per-session live steering** — rejected: duplicates `tool-limit-reminder` and interrupts work; the report-don't-interrupt heuristic is retained instead.
- **Prompt-envelope-only inference, no `skill`-tool channel** — rejected: drops the on-demand channel and the provenance split.
- **Reusing the `sessionReview`/`problems.md` artifact unchanged** — rejected: it is per-session and per-threshold; the new artifact aggregates across a window and carries actions and re-measure results.
- **Hardcoding thresholds in `harness.config.ts`** — rejected with the plugin; thresholds now live in the heuristic record, opt-in, with their rationale.

### Open questions

- Whether to backfill `loadedSkills` from historic exports or start measurement at the retirement date.
- How to control for task difficulty when attributing an overrun to a skill rather than to the task.
- The calibration method for `maxSteps`, and whether `test-design` 8 and `context-gathering` 12 survive it.
- Where thresholds are stored now that the plugin config block is gone.
- Whether the aggregation becomes a `just` recipe or stays a skill-driven manual review.
- Who approves removing a dead skill, and what deprecation grace period precedes deletion.
- Whether prompt-injected loads count toward dead-skill detection the same way tool loads do.
