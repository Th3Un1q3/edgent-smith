---
name: orchestration-retro-2026-10-25
id: lessons/orchestration-retro-2026-10-25
description: Dispatcher rules from a 24-child run — omit timeouts by default and extend only for expected long runs, keep rounds worth a reserve, ask once with a recommendation, answer before detail.
scope: experiences
type: experiences
status: active
confidence: high
timestamp: 2026-10-25
freshness: 2026-10-25
ttl: 180d
L0: "Dispatcher rules — omit timeouts by default and extend only for expected long-running work, rounds carry 2+ deliverables, ask once with a recommendation, answer in 3 lines before detail."
tags: [orchestration, delegation, budget, timeout, reporting]
sources:
  - .agents/skills/task-delegation/workflows/task-delegation-workflow.md
  - .agents/skills/task-delegation/SKILL.md
  - mem:lessons/orchestration/content-report-priority-cap
  - mem:lessons/orchestration/file-priority-char-budget
provenance: 24-child dispatch run, 2026-10-25; all children returned ok, zero timeouts, two reported spend 24/24.
---

# Orchestration lessons — 2026-10-25

## Evidence

- 24 children dispatched; every child returned `ok`; none timed out.
- The binding limit was the per-task call budget (~24 calls): two children exhausted it and reported `spend 24/24`.
- `timeout_minutes` was set to 10-25 on nearly every dispatch and never came close to firing. The user corrected the rule: pass a timeout only to extend past the default when this task is expected to run longer; never habitually and never to shorten.
- Defects the user named: too many sequential rounds before any answer; the user was pulled in mid-flow twice for decisions the orchestrator could have made; long multi-table answers were hard to navigate.

## Rules

### 1. Omit `timeout_minutes` by default; extend only for expected long-running work

Do not pass `timeout_minutes` at all for most tasks — the default timeout is right for them. When this particular request is expected to run longer than the default, pass `timeout_minutes` to extend it so the child is not interrupted mid-work. Never pass it to shorten a task, and never as a habitual per-dispatch value. The trigger is expected duration relative to the default, not a past run's duration. Anchor: `.agents/skills/task-delegation/workflows/task-delegation-workflow.md` §Output and Timeout Budgets.

### 2. A round carries two or more deliverables, or it is a reserve call

A one-deliverable round spends an orchestrator call plus a round trip for no parallel gain. Batch independent work into one round; keep single calls for VERIFY and DELIVER. Anchor: `.agents/skills/task-delegation/SKILL.md` §Delegation Granularity.

### 3. Ask the user once, with a recommendation, only for a gated action or a fork that changes the deliverable

Everything reversible and inside scope is the orchestrator's decision: decide, state the choice in the report, move on. Reserve a question for a permission gate or a fork that changes what is delivered, and carry a recommended option when asking. Anchor: `.agents/skills/task-delegation/SKILL.md` §Talking to the User.

### 4. Answer first: ≤3 lines, ≤1 table, no fenced report block, detail on request

Open with the answer, then offer detail. The reader can ask for more; they cannot un-read a wall of tables. Anchor: same section, `.agents/skills/task-delegation/SKILL.md` §Talking to the User.

### 5. Ask for narrow fixed-width rows when a child returns many records

Wide markdown tables are the most result-cap-fragile return shape; specify the column set and row width up front rather than reconciling truncated rows afterwards. See `mem:lessons/orchestration/file-priority-char-budget` and `mem:lessons/orchestration/content-report-priority-cap`.
