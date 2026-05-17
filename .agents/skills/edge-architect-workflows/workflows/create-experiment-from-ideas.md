# Workflow: Create Experiment From Ideas

Use this workflow when the task is to turn the existing idea bank into exactly one submitted experiment.

## Experiment selection lens

- Prefer one high-impact, low-cost experiment that is likely to improve eval outcomes by increasing reliably passing cases, reducing average passing-case time, or avoiding regressions.
- Keep the mutation surface small and name the scoring lever you expect to move.
- Experiments can target agent architecture, prompting, libraries, model configuration, tooling, or another repo-local variable.
- Do not propose increasing context window size or switching to a strictly more-capable model.

## Inputs

- `docs/ideas.md`
- `agents/edge.py`
- `evals/smoke.py`
- `evals/runner.py`
- `auto_research.baseline.json`
- `.agents/skills/edge-architect-workflows/references/experiment-contracts.md`

## Steps

1. Read `docs/ideas.md` first as the primary source of candidate directions.
2. Inspect the nearby repository surfaces that the idea could affect so the experiment stays grounded in current code and eval behavior.
3. Choose exactly one high-impact, low-cost experiment. Do not return a menu of options.
4. Write the experiment in the normal-mode contract documented in `references/experiment-contracts.md`.
5. Name the expected scoring lever: more passing cases, lower passing-case latency, or fewer regressions.
6. Submit the finished spec exactly once with:

```bash
just autoresearch experiment create --title "<title>" --description "<markdown body>"
```

## Output

- Exactly one Markdown experiment spec with the required headings.
- A single submission via `just autoresearch experiment create`.

## Guardrails

- Do not edit `docs/ideas.md` in this workflow.
- Do not create multiple experiments.
- Do not run evals, tests, or implementation work.
- Do not use queue-replenishment YAML unless the caller explicitly requests queue replenishment mode.