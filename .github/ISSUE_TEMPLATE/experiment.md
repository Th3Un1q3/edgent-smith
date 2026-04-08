---
name: Experiment Proposal
about: Propose a new agent experiment
labels: experiment
---

## Hypothesis

> One sentence: what change do you propose and what improvement do you expect?

## Mutation surface

> Which file(s) will you change? Only the allowed surfaces are permitted.

- [ ] `agents/edge.py` (system prompt `_SYSTEM`, tool descriptions)
- [ ] `evals/smoke.py` (evaluation cases)

## Expected eval improvement

> Which smoke eval cases should improve? Why?

## Simplicity check

- [ ] Simpler than current
- [ ] Same complexity
- [ ] More complex (justify below)

## Justification (if more complex)

## Checklist before submitting

- [ ] Mutation surface is restricted to `agents/edge.py` and/or `evals/smoke.py`
- [ ] No changes to CI, devcontainer, or workflow files
- [ ] No new dependencies required
