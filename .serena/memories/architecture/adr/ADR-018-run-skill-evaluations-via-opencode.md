---
id: ADR-018
title: Run skill evaluations via an OpenCode command
status: superseded
superseded-by: ADR-019
date: 2026-10-24
scope: skill-evaluations
---

# ADR-018: Run skill evaluations via an OpenCode command

## Decision

Skill evaluations (each skill's evals/evals.json) run through an OpenCode command under .opencode/commands/, invoked interactively in-session or headless with `opencode run`; assertion grading uses a shared Python helper that parses evals.json and records per-assertion results, and each skill ships a workflow doc describing its eval protocol.

## Considerations

### Context

Skills (e.g. serena-memory) now ship evals/evals.json with LLM-judged cases and null graded assertions. Existing runners do not fit: top-level evals/runner.py targets model/provider datasets, not skill cases; skill-creator ships its own scripts/run_eval.py and eval-viewer, duplicating logic. A decision is needed on the canonical mechanism for running these evals using the OpenCode CLI.

### Options considered

#### Option A: Skill with a script (per-skill run_eval.py, mirroring skill-creator)
Pros:
- Self-contained per skill; follows an established pattern.
- No new shared infrastructure.
Cons:
- Duplicates runner logic across every skill.
- Maintenance burden grows with skill count.

#### Option B: OpenCode command (.opencode/commands/) — LLM-judged cases
Pros:
- Native to the harness; fits LLM-judged assertions.
- Cheap to add; works interactively and headless via `opencode run`.
- Single command serves all skills.
Cons:
- Non-deterministic grading (LLM-dependent).
- Requires OpenCode CLI availability in CI.

#### Option C: Just recipe + shared Python runner
Pros:
- Deterministic, CI-friendly, single source of truth.
Cons:
- New shared script to maintain.
- Cannot itself judge LLM behavior without shelling to an agent.

#### Option D: Standalone CLI subcommand (cli/commands/eval.py)
Pros:
- User-facing integration with CLI agents.
Cons:
- Couples runtime code to dev-only evals.
- Overkill; high implementation cost.

#### Option E: Hybrid (shared runner + OpenCode command + skill workflow)
Pros:
- Maximum flexibility.
Cons:
- Most moving parts; highest maintenance and cost.

### Scoring

Criteria (each scored -2 to +2): Maintainability, Flexibility, Implementation ease, Initial implementation cost (higher = cheaper).

| Criteria | Opt A | Opt B | Opt C | Opt D | Opt E |
|---|---|---|---|---|---|
| Maintainability | -1 | 0 | 2 | -1 | 1 |
| Flexibility | 1 | 2 | 1 | 0 | 2 |
| Implementation ease | 1 | 1 | 0 | -1 | -1 |
| Initial implementation cost | 0 | 1 | -1 | -2 | -2 |
| Total | 1 | 4 | 2 | -4 | 0 |

### Consequences

- Add one .opencode/commands/ entry for running skill evals, accepting a skill name and case id range.
- Add a shared Python helper (scripts/run_skill_evals.py or agent_utils/) that loads evals.json, shells to `opencode run` per case, and records assertion results.
- Each skill keeps a workflow doc (e.g. references/evaluations.md) describing its eval protocol and success criteria.
- CI invokes the command headless via `opencode run`; interactive runs use the same command in-session.
- Per-skill run_eval.py scripts (skill-creator style) are not duplicated; the shared helper replaces them.
