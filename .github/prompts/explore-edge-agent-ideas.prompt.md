---
description: "Refresh docs/ideas.md from the latest edge-relevant agentic papers and repositories"
agent: "edge-architect"
---

# Research Latest Edge-Agent Ideas

Task:

1. Use the Hugging Face CLI, specifically `hf` and `hf papers`, as the required research mechanism for paper discovery. Do not substitute web search or another fallback.
2. If the invoking task provides a cached discovery artifact such as `.cache/discover/hf_papers.md`, you must inspect it before editing `docs/ideas.md`. If that file is too large to read at once, immediately switch to ranged reads or targeted search. A file-too-large response is not completion and is not a valid reason to skip the file.
3. Use DeepWiki MCP as the required primary mechanism for repository exploration when a target repository is available there. Start with `mcp_deepwiki_read_wiki_structure`, then use `mcp_deepwiki_ask_question` or `mcp_deepwiki_read_wiki_contents` only for the smallest sections that can materially change `docs/ideas.md`. Do not skip the DeepWiki pass and then proceed with edits.
4. Follow two efficient staged funnels instead of reading many full papers or repositories:
	- For papers:
		- In the current environment, actually run `hf --help` and `hf papers --help` before claiming the CLI is unavailable or unsupported.
		- List recent or trending papers with `hf papers ls`.
		- Run targeted searches for edge-relevant agentic topics with `hf papers search`.
		- Treat "latest" as the current month plus the previous month by default; only retain an older paper when it clearly dominates on relevance, and label that choice explicitly.
		- Fetch structured metadata for every retained paper in the bounded shortlist with `hf papers info`.
		- Read full markdown only for the final evidence-driving subset with `hf papers read`.
	- For repositories:
		- Start from this bounded shortlist of highly starred repositories: `punkpeye/awesome-mcp-servers`, `dair-ai/Prompt-Engineering-Guide`, `Meirtz/Awesome-Context-Engineering`, `Shubhamsaboo/awesome-llm-apps`, and `shareAI-lab/learn-claude-code`.
		- Use `punkpeye/awesome-mcp-servers` to explore query types such as local-first MCP server categories, offline-capable tool surfaces, low-latency integrations, and thin tool abstractions suitable for edge agents.
		- Use `dair-ai/Prompt-Engineering-Guide` to explore query types such as prompt compression, routing, decomposition, reflection, retrieval pruning, and context-budget strategies.
		- Use `Meirtz/Awesome-Context-Engineering` to explore query types such as context packing, memory distillation, cache reuse, selective retrieval, and long-context control mechanisms that can shrink to edge settings.
		- Use `Shubhamsaboo/awesome-llm-apps` to explore query types such as lightweight agent or RAG architectures, reusable eval loops, local or hybrid execution patterns, and practical task decomposition ideas.
		- Use `shareAI-lab/learn-claude-code` to explore query types such as shell-first agent harness structure, planning loops, tool invocation boundaries, failure recovery, and the smallest useful control loop for coding agents.
		- Retain at least one repository-derived pattern that is backed by an actual DeepWiki inspection when DeepWiki coverage exists for the shortlisted repositories.
		- Keep the repository pass bounded: retain only the strongest repo-derived patterns, prefer README or wiki-level understanding over code spelunking, and use DeepWiki to answer targeted design questions instead of browsing loosely.
5. Keep the overall shortlist bounded and high-signal: start broad, narrow to a small paper set plus a small repository-derived pattern set, then retain only the strongest ideas worth adding or revising.
6. Deduplicate against existing `docs/ideas.md` first, and prefer revising, consolidating, or sharpening weak or duplicate ideas instead of appending noise.
7. Update `docs/ideas.md` with concise additions or revisions grounded in the final paper subset and the retained repository evidence. Bias toward refining the file directly, not producing a command checklist for the user. Do not add meta process notes, next steps, or conversational prose.
8. For each retained idea, capture concise evidence: paper ID/title if applicable, repository name if applicable, one key mechanism, edge relevance, likely repo impact, and whether it is a new idea or a revision to an existing `docs/ideas.md` entry.

Do not design or submit an experiment in this prompt. Do not ask the user to run `hf` manually for this flow. Do not retain a paper without `hf papers info`, and do not let a paper drive changes unless it is in the final subset read with `hf papers read`. Do not let a repository drive changes unless you inspected the relevant wiki or documentation slice through DeepWiki when available, or the smallest relevant top-level docs when DeepWiki does not cover that repo. Do not make any edits, cleanup passes, deletions, or commits to `docs/ideas.md` until you have completed the cached-file read if one was provided, the required `hf` help and paper-inspection steps, and the DeepWiki-backed repository pass. If `hf`, `hf papers`, or DeepWiki MCP genuinely fails after the checks above, report the blocker briefly and stop rather than inventing a workaround.