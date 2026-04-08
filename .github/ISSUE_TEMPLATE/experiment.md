---
name: Experiment Proposal
about: Propose a new agent experiment (add the 'auto-research' label to trigger automation)
labels: ''
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

---

> **To trigger automation:** add the `auto-research` label to this issue.
> The workflow will invoke the Copilot implement agent, run evaluations,
> and open a PR automatically if the score exceeds the baseline.
