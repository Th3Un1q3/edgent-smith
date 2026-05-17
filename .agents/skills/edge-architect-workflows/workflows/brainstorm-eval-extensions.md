# Workflow: Brainstorm Eval Extensions

Use this workflow to generate evaluation ideas that probe where the edge agent is weak, brittle, or underexercised.

## Inputs

- `agents/edge.py`
- `evals/smoke.py`
- `evals/runner.py`
- `tests/test_edge_agent.py`
- `tests/test_runner.py`
- `docs/ideas.md`

## Steps

1. Inspect the current edge-agent prompt, tool surface, and eval runner so the brainstorm is grounded in the actual repo.
2. Identify what the current evals reward well and what they barely test at all.
3. Brainstorm ideas that push the edge agent outside its comfort zone, such as longer contexts, ambiguous tool choice, recovery from partial tool failures, adversarial instruction mixtures, or latency-sensitive multi-step tasks.
4. For each idea, name the failure mode it would expose, the likely repo surface to change, and the signal it would add beyond the current evals.
5. Favor ideas that could become realistic follow-up experiments or new eval cases without broad infrastructure churn.

## Output

- A concise brainstorm of eval-extension ideas grounded in the repository's agent and eval surfaces.
- No experiment submission unless the caller explicitly switches to the experiment-creation workflow.

## Guardrails

- Keep the brainstorm focused on evaluation extensions, not implementation changes.
- Avoid generic benchmarking advice that is not tied to this repo.
- Prioritize stressors that reveal edge-agent limitations outside the current comfort zone.