---
id: ADR-019
title: Skill evaluations run as a conductor pipeline
status: accepted
date: 2026-10-25
scope: skill-evaluations
---

# ADR-019: Skill evaluations run as a conductor pipeline

## Decision

Skill evaluations run as the Conductor workflow workflows/skill_eval_workflow.yaml: probe models in priority order (free, then paid, then local), seed deterministic fixtures via each skill's evals/setup.py, validate the eval schema, run each case with the rug-swe agent, grade with the evaluation-grader agent pointed at the raw transcripts, emit a scorecard, and tear down via evals/teardown.py. ADR-018 is superseded by this decision.

## Considerations

### Context

ADR-018 chose an OpenCode command plus a shared Python helper. Implementation exposed four defects in that shape: a single model plus fallback was fragile when the primary was rate-limited or unreachable; passing full case output inline to the grader exceeded input limits and hid tool calls; shared eval fixtures were mutated across cases and polluted production memory; and setup/teardown performed by an agent was non-deterministic. A workflow that probes models, seeds fixtures deterministically, and grades from transcripts addresses all four.

### Options considered

#### Option A: Single OpenCode command plus shared helper (ADR-018)
Pros:
- Small surface; one command.
Cons:
- Single-model fragility; inline grading loses tool detail; shared fixtures mutate; agentic setup/teardown is non-deterministic.

#### Option B: Conductor workflow with script steps
Pros:
- Explicit stages (probe, setup, validate, run, grade, scorecard, teardown); model priority probing; deterministic fixtures; transcript-based grading; CI-runnable via conductor run.
Cons:
- More moving parts (workflow plus step scripts plus a grader agent); requires the conductor binary.

#### Option C: Orchestrator-driven subtasks per case
Pros:
- Flexible; no new workflow file.
Cons:
- Same non-determinism as agentic setup; token-heavy; harder to reproduce.

### Scoring

Criteria (each -2 to +2): Maintainability, Flexibility, Implementation ease, Initial implementation cost (higher = cheaper).

| Criteria | Opt A | Opt B | Opt C |
|---|---|---|---|
| Maintainability | 0 | 2 | -1 |
| Flexibility | -1 | 2 | 1 |
| Implementation ease | 1 | 0 | 0 |
| Initial implementation cost | 0 | -1 | -1 |
| Total | 0 | 3 | -1 |

### Consequences

- workflows/skill_eval_workflow.yaml is the canonical eval entry point; the just skill-eval recipe wraps it.
- Each skill with evals ships evals/setup.py, evals/teardown.py, and evals/fixtures.json; setup/teardown are deterministic and never agentic.
- Scenario execution uses rug-swe; grading uses the read-only evaluation-grader agent pointed at per-case raw transcripts.
- Results are saved as a scorecard; teardown removes the eval namespace so the store returns to a clean state.
- ADR-018 is superseded; its shared-helper shape is not used for skill evals.
