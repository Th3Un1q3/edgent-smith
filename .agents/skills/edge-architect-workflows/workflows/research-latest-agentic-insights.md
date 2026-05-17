# Workflow: Research Latest Agentic Insights

Use this workflow to refresh `docs/ideas.md` from the latest Hugging Face papers without designing or submitting an experiment.

## Inputs

- `docs/ideas.md`
- `agents/edge.py`
- `evals/smoke.py`
- `README.md`

## Steps

1. Read `docs/ideas.md` first so you can extend or correct the existing idea bank instead of duplicating it.
2. Use the Hugging Face CLI as the required discovery surface for latest papers, specifically `hf` and `hf papers`.
3. In the current environment, actually run the current CLI help before choosing commands so the workflow stays accurate for the installed version. Do not claim the CLI is unavailable until both help commands have been attempted.

```bash
hf --help
hf papers --help
```

If either help command genuinely fails after being attempted, report the blocker briefly and stop. Do not ask the user to run `hf` manually, and do not substitute another discovery surface.

4. Use a staged funnel instead of broad paper reading:
	- List recent or trending papers with `hf papers ls`.
	- Run targeted searches for agentic engineering on constrained or edge-like systems with `hf papers search`.
	- Treat "latest" as the current month plus the previous month by default; only retain an older paper when it clearly dominates on relevance, and label that choice explicitly.
	- Build a bounded shortlist from the returned metadata and keep the retained set small and high-signal.
	- Fetch structured information for every retained paper first with `hf papers info`.
	- Read full markdown only for the final evidence-driving subset with `hf papers read`.
5. Keep the funnel tight: prefer a few strong candidates over a long queue of weak reads.
6. Extract only concrete architectural insights, not generic trend summaries.
7. Before writing, deduplicate against `docs/ideas.md` and prefer revising, consolidating, or sharpening existing weak or overlapping ideas instead of appending noise.
8. Update `docs/ideas.md` with concise idea entries or revisions only. Do not add meta process notes, command checklists, next steps, or conversational prose. For each retained idea, capture: paper ID/title, one key mechanism, edge relevance, likely repo impact, and whether the entry is new or a revision.

## Output

- Updated `docs/ideas.md` content only.
- No experiment spec.
- No `just autoresearch experiment create` submission.
- No command checklist telling the user to run `hf` themselves.

## Guardrails

- Do not substitute generic web search for the Hugging Face CLI.
- Do not ask the user to run `hf` commands manually when executing this workflow autonomously in Copilot CLI.
- If `hf` or `hf papers` fails after you attempt the help commands above, report that blocker briefly and stop instead of inventing a workaround.
- Prefer a few high-signal ideas over a long list of weak ideas.
- Focus on ideas that could plausibly affect `agents/edge.py`, eval design, or the experiment loop.
- Do not retain a paper without `hf papers info`, and do not let a paper drive changes unless it is in the final subset read with `hf papers read`.