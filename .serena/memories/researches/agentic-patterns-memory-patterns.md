# Agentic Patterns — Context & Memory Category

Source: https://www.agentic-patterns.com/patterns?category=Context%20%26%20Memory (server-rendered Astro site; query param ignored server-side, all 179 cards in HTML with data-category attrs). Fetched 2026-08-06 via fetch MCP (raw HTML).

The category has 22 patterns. Per-pattern detail (Problem/Solution/How-to-use-it sections + language-* code blocks) was extracted from each pattern page.

## The 22 Context & Memory patterns

1. Agent-Powered Codebase Q&A / Onboarding (validated) — agent with retrieval/search/QA (embeddings, AST, code graphs) answers repo questions; CLAUDE.md config, MCP.

2. Context Budget as a Governed Resource (validated) — measure per-source ghost tokens, baseline + trend alarm (+10-25% vs 4-8wk median), cap scheduling.

3. Context-Minimization Pattern (emerging) — purge/redact untrusted tokens after transformation; staged pipeline: ingest->transform->discard original.

4. Context Window Anxiety Management (emerging) — models panic near limits; enable 1M-token window but cap use at 200k, counter-prompt reassurance.

5. Context Window Auto-Compaction (validated) — on context_length_exceeded errors, compact session transcript, reserve tokens (>=20k floor), lane-aware retry.

6. Cross-Agent Lesson Sharing via Git (validated) — git repo lessons/ dir as shared memory; YAML-frontmatter lessons (problem/fix/verify); GitHub Issues as bus.

7. Curated Code Context Window (validated) — keep main context sterile; helper SearchSubagent returns top-K relevant files; offline index (ripgrep/tree-sitter/vector).

8. Curated File Context Window (best practice) — load only primary files + explicit deps; sub-agents gather/rank additional files without polluting main context.

9. Dynamic Context Injection (established) — user-driven @file/folder at-mentions and slash commands inject context into working memory mid-session.

10. Episodic Memory Retrieval & Injection (validated) — vector store of memory blobs (event/outcome/rationale); embed prompt, retrieve top-k, inject hints; TTL decay.

11. Filesystem-Based Agent State (established) — persist intermediate results/state to files as checkpoints; resume workflows; state/step1_results.json pattern.

12. Layered Configuration Context (established) — hierarchical config files (CLAUDE.md) auto-discovered by location: enterprise root, ~/.claude, project dirs.

13. Memory Synthesis from Execution Logs (emerging) — task diaries + periodic synthesis agents extract reusable patterns; Reflexion (NeurIPS 2023, 91% pass@1) cited.

14. Proactive Agent State Externalization (emerging) — models self-write notes (CHANGELOG/SUMMARY); guide with templates, hybrid memory, validation checkpoints.

15. Progressive Disclosure for Large Files (emerging) — prompt has file metadata only; load_file/extract_file tools fetch content on demand.

16. Prompt Caching via Exact Prefix Preservation (emerging) — never mutate messages; static-first ordering, stable tool order; token-level prefix caching.

17. Schema-Guided Graph Retrieval for Multi-Hop Reasoning (emerging) — one shared schema drives graph construction, evolution, decomposition, typed retrieval (GraphRAG).

18. Self-Identity Accumulation (emerging) — SessionStart hook injects WHO_AM_I.md; SessionEnd hook refines it; persistent identity document.

19. Semantic Context Filtering Pattern (emerging) — strip 40-80% boilerplate/noise; extract only semantic/interactive elements for the LLM.

20. Session-Scoped Context Runtime for Agent Tools (emerging) — MCP-style runtime caches reads with mtime revalidation; structured read modes (map/signatures/diff).

21. Tool Search Lazy Loading (emerging) — ToolSearchTool loads tool metadata on demand when descriptions exceed ~10% context threshold.

22. Working Memory via TodoWrite (emerging) — explicit task-state list (pending/in_progress/blocked/completed), single active task, blocks/blockedBy deps.

## Other-category patterns that are memory/context related (seen on listing)

- Memory Reinforcement Learning (MemRL) — Learning & Adaptation: RL over agent memory.

- Self-Rewriting Meta-Prompt Loop — Orchestration & Control: meta-prompt accumulates and rewrites itself across runs.

- Cross-Cycle Consensus Relay — Orchestration & Control: carries consensus/state across cycles.

- Skill Library Evolution — Learning & Adaptation: persistent, evolving skill knowledge base.

- Extended Coherence Work Sessions — Reliability & Eval: long multi-session workflows needing continuity.

## Prime candidates for multi-step memory workflows

Working Memory via TodoWrite (explicit task-state), Episodic Memory Retrieval & Injection (vector store), Filesystem-Based Agent State (checkpoint files), Context Window Auto-Compaction (session transcripts), Memory Synthesis from Execution Logs (two-tier logs->patterns), Cross-Agent Lesson Sharing via Git (shared persistent lessons), Self-Identity Accumulation (session hooks), Session-Scoped Context Runtime (cached reads).

## Cached sources

- mem:cache/fetch/www-agentic-patterns-com/patterns-category-context-memory
- mem:cache/fetch/www-agentic-patterns-com/patterns-agent-powered-codebase-qa-onboarding
- mem:cache/fetch/www-agentic-patterns-com/patterns-context-budget-as-a-governed-resource
- mem:cache/fetch/www-agentic-patterns-com/patterns-context-minimization-pattern
- mem:cache/fetch/www-agentic-patterns-com/patterns-context-window-anxiety-management
- mem:cache/fetch/www-agentic-patterns-com/patterns-context-window-auto-compaction
- mem:cache/fetch/www-agentic-patterns-com/patterns-cross-agent-lesson-sharing
- mem:cache/fetch/www-agentic-patterns-com/patterns-curated-code-context-window
- mem:cache/fetch/www-agentic-patterns-com/patterns-curated-file-context-window
- mem:cache/fetch/www-agentic-patterns-com/patterns-dynamic-context-injection
- mem:cache/fetch/www-agentic-patterns-com/patterns-episodic-memory-retrieval-injection
- mem:cache/fetch/www-agentic-patterns-com/patterns-filesystem-based-agent-state
- mem:cache/fetch/www-agentic-patterns-com/patterns-layered-configuration-context
- mem:cache/fetch/www-agentic-patterns-com/patterns-memory-synthesis-from-execution-logs
- mem:cache/fetch/www-agentic-patterns-com/patterns-proactive-agent-state-externalization
- mem:cache/fetch/www-agentic-patterns-com/patterns-progressive-disclosure-large-files
- mem:cache/fetch/www-agentic-patterns-com/patterns-prompt-caching-via-exact-prefix-preservation
- mem:cache/fetch/www-agentic-patterns-com/patterns-schema-guided-graph-retrieval
- mem:cache/fetch/www-agentic-patterns-com/patterns-self-identity-accumulation
- mem:cache/fetch/www-agentic-patterns-com/patterns-semantic-context-filtering
- mem:cache/fetch/www-agentic-patterns-com/patterns-session-scoped-context-runtime-for-agent-tools
- mem:cache/fetch/www-agentic-patterns-com/patterns-tool-search-lazy-loading
- mem:cache/fetch/www-agentic-patterns-com/patterns-working-memory-via-todos