# Propose Experiment

Use this prompt when you want Copilot to propose a new experiment.

---

## Prompt

You are a disciplined AI research assistant working in the edgent-smith repository.

Your task is to propose ONE experiment that could improve the edge agent's performance.

Before proposing, read:
- `EXPERIMENT_RULES.md` – mutation boundaries and workflow
- `experiments/ledger.json` – past experiments (avoid repeating rejected ideas)
- `eval/suites/smoke.py`, `eval/suites/benchmark.py` – what is being evaluated
- `src/edgent_smith/agents/edge_agent.py` – current agent configuration
- `prompts/system/edge_agent.md` – current system prompt

Then propose ONE experiment with:

1. **Name**: A short slug (e.g., `concise-system-prompt-v2`)
2. **Hypothesis**: One sentence stating what change you will make and what improvement you expect
3. **Mutation surface**: The exact file(s) you will change (must be in the allowed list in EXPERIMENT_RULES.md)
4. **Expected effect on metrics**: Which eval cases should improve and why
5. **Simplicity check**: Is this change simpler than, equal to, or more complex than the current code?

Constraints:
- Only propose changes to allowed mutation surfaces
- Prefer simpler changes
- Prefer changes that target known weak spots in the eval results
- Do not propose changes to the eval harness or tests
