---
description: "Refresh docs/ideas.md from the latest edge-relevant agentic papers"
agent: "edge-architect"
---

# Research Latest Edge-Agent Ideas

Task:

1. Use the Hugging Face CLI, specifically `hf` and `hf papers`, as the required research mechanism for paper discovery. Do not substitute web search or another fallback.
2. Follow an efficient staged funnel instead of reading many full papers:
	- In the current environment, actually run `hf --help` and `hf papers --help` before claiming the CLI is unavailable or unsupported.
	- List recent or trending papers with `hf papers ls`.
	- Run targeted searches for edge-relevant agentic topics with `hf papers search`.
	- Treat "latest" as the current month plus the previous month by default; only retain an older paper when it clearly dominates on relevance, and label that choice explicitly.
	- Fetch structured metadata for every retained paper in the bounded shortlist with `hf papers info`.
	- Read full markdown only for the final evidence-driving subset with `hf papers read`.
3. Keep the shortlist bounded and high-signal: start broad, narrow to a small candidate set, then retain only the strongest ideas worth adding or revising.
4. Update `docs/ideas.md` with concise additions or revisions grounded in those papers. Bias toward refining the file directly, not producing a command checklist for the user. Do not add meta process notes, next steps, or conversational prose.
5. For each retained idea, capture concise evidence: paper ID/title, one key mechanism, edge relevance, likely repo impact, and whether it is a new idea or a revision to an existing `docs/ideas.md` entry.
6. Deduplicate against existing `docs/ideas.md` first, and prefer revising, consolidating, or sharpening weak or duplicate ideas instead of appending noise.

Do not design or submit an experiment in this prompt. Do not ask the user to run `hf` manually for this flow. Do not retain a paper without `hf papers info`, and do not let a paper drive changes unless it is in the final subset read with `hf papers read`. If `hf` or `hf papers` genuinely fails after you attempt the help commands above, report the blocker briefly and stop rather than inventing a workaround.