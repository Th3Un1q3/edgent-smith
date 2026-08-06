# Context & Memory Patterns — agentic-patterns.com (extracted 2026-08-06)

Dated extraction from https://www.agentic-patterns.com/patterns (Astro static site; category filter is client-side).
All 22 patterns in the Context & Memory category of the 180-pattern catalog.
Detail pages: https://www.agentic-patterns.com/patterns/{slug} — each has Problem / Solution / How to use it / Trade-offs / References sections.

Format: name | slug | status | tags

Agent-Powered Codebase Q&A / Onboarding | agent-powered-codebase-qa-onboarding | validated in production | code-understanding,onboarding,q&a,retrieval,search,context-awareness
Context Budget as a Governed Resource | context-budget-as-a-governed-resource | validated in production | context-budget,token-costs,ghost-tokens,compaction
Context-Minimization Pattern | context-minimization-pattern | emerging | context-hygiene,taint-removal,prompt-injection
Context Window Anxiety Management | context-window-anxiety-management | emerging | context-anxiety,token-management,premature-completion
Context Window Auto-Compaction | context-window-auto-compaction | validated in production | context-management,compaction,overflow-recovery,token-estimation
Cross-Agent Lesson Sharing via Git | cross-agent-lesson-sharing | validated in production | distributed-memory,knowledge-sharing,git-based,lessons-learned
Curated Code Context Window | curated-code-context-window | validated in production | context-management,file-selection,noise-reduction
Curated File Context Window | curated-file-context-window | best practice | code-context,file-scope,relevance,memory-management
Dynamic Context Injection | dynamic-context-injection | established | context management,dynamic context,lazy loading,slash commands,at-mention
Episodic Memory Retrieval & Injection | episodic-memory-retrieval-injection | validated in production | episodic-memory,vector-db,retrieval-augmented,context-hint
Filesystem-Based Agent State | filesystem-based-agent-state | established | state-management,persistence,resumption,long-running-tasks
Layered Configuration Context | layered-configuration-context | established | context management,configuration,scoped context,CLAUDE.md
Memory Synthesis from Execution Logs | memory-synthesis-from-execution-logs | emerging | memory,logs,diary,synthesis,pattern-detection
Proactive Agent State Externalization | proactive-agent-state-externalization | emerging | state-externalization,memory-management,self-documentation
Progressive Disclosure for Large Files | progressive-disclosure-large-files | emerging | progressive-disclosure,large-files,lazy-loading,metadata
Prompt Caching via Exact Prefix Preservation | prompt-caching-via-exact-prefix-preservation | emerging | prompt-caching,exact-prefix,performance,stateless
Schema-Guided Graph Retrieval for Multi-Hop Reasoning | schema-guided-graph-retrieval | emerging | graphrag,schema-guided,multi-hop-reasoning,typed-retrieval
Self-Identity Accumulation | self-identity-accumulation | emerging | self-identity,persona,session-hooks,familiarity,cross-session
Semantic Context Filtering Pattern | semantic-context-filtering | emerging | context-filtering,token-optimization,semantic-extraction
Session-Scoped Context Runtime for Agent Tools | session-scoped-context-runtime-for-agent-tools | emerging | mcp,context-compression,session-cache,agent-tools
Tool Search Lazy Loading | tool-search-lazy-loading | emerging | mcp,tool-discovery,context-optimization,lazy-loading,search
Working Memory via TodoWrite | working-memory-via-todos | emerging | context,memory,working-memory,state,todo-tracking

## Extraction notes

- Category/status read from pattern-card HTML data attributes (data-category, data-status, data-tags); tallies match the site filter counts (Context & Memory = 22).
- Full catalog is 180 patterns / 8 categories. Synthesized analysis: mem:researches/agentic-patterns-context-memory-patterns.