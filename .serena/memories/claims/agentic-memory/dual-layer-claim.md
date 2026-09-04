---
id: claims-agentic-memory-dual-layer-claim
type: claims
hotness: 1.0
ttl: 90d
claim_ids: ["dual-layer-claim"]
L0: "dual-layer: Serena source, vector reference cache"
---
# Claim — Dual-Layer Retrieval: Serena as Source, Vector as Index

9-check gate: pass — standalone (atomic architectural claim), verified (synthesized from mem:cache/fetch/agentic-patterns.com/patterns-context-memory-category-2026-08 and mem:researches/agentic-patterns-memory-patterns 22 patterns, plus mem:architecture/adr/ADR-002-memory-system-and-structure), reusable (guides retrieval design), non-duplicative (first claims/*), discoverable (via mem:claims/about), right-size (2 paras), privacy (no PII), event-centric N/A, dedup: new.

Statement: Retrieval must treat Serena AGFS as source of truth and vector as reference cache (512/64 flat_hybrid per retrieval-architecture.md); hybrid score 0.6*BM25+0.3*vector+0.1*hotness, threshold >0.35. Confidence: high — grounded in 22 Context & Memory patterns (Episodic Memory Retrieval & Injection, Filesystem-Based Agent State) cached at mem:cache/fetch/agentic-patterns.com/patterns-context-memory-category-2026-08-06.

Evidence: mem:researches/agentic-patterns-memory-patterns lists 22 patterns; mem:cache/fetch/agentic-patterns.com/patterns-context-memory-category-2026-08-06 holds raw fetch. See mem:architecture/adr/ADR-002-memory-system-and-structure for store invariants.
