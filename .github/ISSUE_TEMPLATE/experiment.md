---
name: Experiment Proposal
about: Propose a new agent experiment
labels: experiment
---

## Hypothesis

> One sentence: what change do you propose and what improvement do you expect?

## Mutation surface

> Which files will you change? (Must be in the allowed list from EXPERIMENT_RULES.md)

- [ ] `prompts/system/edge_agent.md`
- [ ] `src/edgent_smith/agents/edge_agent.py`
- [ ] `src/edgent_smith/config/settings.py`
- [ ] `src/edgent_smith/tools/`

## Expected eval improvement

> Which eval cases should improve? Why?

## Simplicity check

- [ ] Simpler than current
- [ ] Same complexity
- [ ] More complex (justify below)

## Justification (if more complex)

## Checklist before submitting

- [ ] Checked `experiments/ledger.json` – this hypothesis hasn't been rejected before
- [ ] Read `EXPERIMENT_RULES.md`
- [ ] Mutation surfaces are in the allowed list
