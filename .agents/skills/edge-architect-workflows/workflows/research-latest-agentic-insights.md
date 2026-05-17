# Workflow: Research Latest Agentic Insights

Use this workflow to refresh `docs/ideas.md` from the latest Hugging Face papers without designing or submitting an experiment.

## Inputs

- `docs/ideas.md`
- `agents/edge.py`
- `evals/smoke.py`
- `README.md`

## Steps

1. Read `docs/ideas.md` first so you can extend or correct the existing idea bank instead of duplicating it.
2. Use the Hugging Face CLI as the required discovery surface for latest papers.
3. Inspect the current CLI help before choosing commands so the workflow stays accurate for the installed version.

```bash
hf --help
hf <paper-related-command> --help
```

4. Use the Hugging Face CLI to inspect the latest Hugging Face papers for the current month and collect only papers that are relevant to agentic engineering on constrained or edge-like systems.
5. Read the most relevant paper summaries or metadata surfaced through the Hugging Face CLI and extract concrete architectural insights, not generic trend summaries.
6. Update `docs/ideas.md` with concise idea entries, and revise existing entries when the latest papers invalidate or sharpen an older idea.
7. Keep each addition grounded in a paper, its likely impact on the edge agent, and the repository surface it could influence.

## Output

- Updated `docs/ideas.md` content only.
- No experiment spec.
- No `just autoresearch experiment create` submission.

## Guardrails

- Do not substitute generic web search for the Hugging Face CLI.
- Prefer a few high-signal ideas over a long list of weak ideas.
- Focus on ideas that could plausibly affect `agents/edge.py`, eval design, or the experiment loop.