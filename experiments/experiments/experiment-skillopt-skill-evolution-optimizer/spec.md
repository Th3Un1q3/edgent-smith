## Hypothesis
If a bounded text-space optimizer (SkillOpt) proposes small, validated edits to on-device skill documents and a held-out validation gate accepts only those that improve a lightweight simulator metric, then skill utility on constrained devices will improve measurably with near-zero inference overhead.

## Motivation
Skill edits are cheaper than model updates. For edge devices, evolving compact skill artifacts (prompts, adapters, small scripts) can deliver meaningful behavior improvements without retraining or heavy downloads.

## Type
Research + Prototype (local proof-of-concept)

## Mutation surface
Skill documents and small skill adapters: repository files under agents/skills/ and docs/skills/ (text-based skill manifests and prompt templates). A new lightweight SkillOpt prototype script lives in experiments/skillopt/ and produces a vetted patchset.

## Implementation Instructions
1. Add experiments/skillopt/propose_and_validate.py: reads skill docs, proposes bounded edits (add/replace/delete) using a small edit-proposal model or template-driven heuristics and an edit-budget (text-space learning rate).
2. Implement a held-out validation gate: a small simulator harness (tests/skillopt/simulator.py) that runs representative micro-tasks and computes a scalar utility metric (accuracy, task success, safety score, latency).
3. Build an accept/reject buffer: accepted edits are output as patch files; rejected edits go to experiments/skillopt/rejected.log with metadata and rationale.
4. Provide a CLI: experiments/skillopt/apply_patch.sh that dry-runs patches and optionally applies them after human review.
5. Keep changes local to experiments/skillopt/ and non-destructive by default (no auto-apply without explicit flag).

## Validation (code, prompts, tasks)
- Unit tests for proposer and validator under tests/skillopt/: ensure deterministic behavior under fixed RNG seeds.
- Tasks: create 10 representative micro-tasks derived from existing skills (e.g., intent classification, slot-filling, simple action-selection). Use the simulator to compare baseline vs. post-edit utility.
- Metrics: delta in task success rate, false-positive safety regressions, median latency change, and edit acceptance rate.
- Success criteria: >=3% relative improvement in aggregated utility across micro-tasks with <=0.5% safety regression and no latency increase >5%.

## Anticipated missteps and fallbacks
- Overfitting proposer to simulator: mitigate via cross-validation folds and a rejected-edit buffer for manual inspection.
- Unsafe edits that alter guarded behavior: add safety checks in validator (prompt-based safety classifier) and require human approval for any edit that touches guardrail files.
- Low signal in micro-tasks: expand task set or use simulated noise to increase robustness of validation.

## Sources
- docs/ideas.md — "SkillOpt: Skill evolution optimizer" (May 2026)
- Paper: 2605.23904 — SkillOpt (referenced in ideas.md)

## Notes
- Low-cost, local experiment that reuses existing harness patterns and focuses on text-only artifacts to avoid heavy infra or model changes.
- If promising, follow-ups: integrate SkillOpt into the harness and add federated aggregation of accepted edits.