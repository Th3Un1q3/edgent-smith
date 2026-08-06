# Agentic Patterns — Context & Memory Category

Reference: agentic-patterns.com, an Astro static catalog of 180 agent operating patterns across 8 categories; 22 sit in Context & Memory (fetched 2026-08-06; raw extraction in mem:cache/fetch/agentic-patterns.com/patterns-context-memory-category-2026-08-06).

The category covers context hygiene, memory persistence, and retrieval across agent sessions. Prime candidates for managing/storing/recalling memory in multi-step workflows:

- **Episodic Memory Retrieval & Injection** (validated): vector-backed episodic store; after each episode write a structured memory blob (decision/evidence/outcome/confidence), embed new prompts and inject top-k as context hints, TTL-prune stale entries. Basis: Reflexion (91% pass@1 HumanEval), MemGPT.
- **Filesystem-Based Agent State** (established): persist intermediate results/state as checkpoint files; workflows check for prior state and resume; enables multi-session and collaborative execution (Anthropic code-execution-with-MCP source).
- **Working Memory via TodoWrite** (emerging): explicit todo list as working memory (status, blockedBy, verification, next actions); externalizes state per Baddeley/Miller; survives context switches.
- **Memory Synthesis from Execution Logs** (emerging): two-tier memory — agents write per-task diary entries; synthesis agents periodically review logs and extract reusable patterns into prompts/slash commands.
- **Cross-Agent Lesson Sharing via Git** (validated): git repo as shared memory substrate (lessons/ dir with problem/fix/verify markdown + YAML frontmatter), GitHub Issues as message bus; nodes pull and search before debugging.
- **Self-Identity Accumulation** (emerging): SessionStart hook injects a persistent identity document (WHO_AM_I.md/SOUL.md); SessionEnd hook extracts insights and refines it (dual-hook architecture).
- **Context Window Auto-Compaction** (validated): reactive compaction on overflow errors; reserve-token floor (default 20k), post-compaction token verification, model-specific transcript validation (Clawdbot compact.ts).
- **Context Budget as a Governed Resource** (validated): measure always-loaded sources per-source (chars/4), trend alarms on 4-8 week medians (+10-25%), hard budget caps for unattended runs, index ceilings, compaction survival rules.
- **Context-Minimization Pattern** (emerging): after transforming untrusted input into a safe intermediate, purge/redact the original tainted tokens — anti prompt-injection and context hygiene (Beurer-Kellner arXiv:2506.08837).
- **Prompt Caching via Exact Prefix Preservation** (emerging): static-first message ordering, append-only history, insert-not-update for config changes to preserve cache prefixes; 43% cost reduction at scale (HyperAgent).
- **Curated Code / File Context Window** (validated/best-practice): helper SearchSubagent returns top-k ranked file snippets; only relevant files/summaries enter the main agent window; progressive disclosure.
- **Semantic Context Filtering** (emerging): extract only semantic/interactive elements from raw sources (web DOM, APIs, docs); 10-100x token reduction; HyperAgent accessibility-tree basis.

Other patterns in category: Dynamic Context Injection, Layered Configuration Context (CLAUDE.md), Progressive Disclosure for Large Files, Tool Search Lazy Loading (MCP), Session-Scoped Context Runtime (lean-ctx), Schema-Guided Graph Retrieval (GraphRAG), Proactive Agent State Externalization, Context Window Anxiety Management, Agent-Powered Codebase Q&A / Onboarding.

## Cached sources

- mem:cache/fetch/agentic-patterns.com/patterns-context-memory-category-2026-08-06