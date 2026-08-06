---
id: ADR-002
title: Memory system and structure: serena store with domain/about organization
status: draft
date: 2026-08-06
scope: project memory system and structure — how knowledge is persisted, organized, and accessed
---

# ADR-002: Memory system and structure

## Decision

Project memory is stored in the serena store: organized by domain with about-first indexes and hierarchical self-describing names, accessed only through the gateway MCP server, with cache-first research and a BLOCKING GATE before every write.

## Considerations

### Context

The project persists knowledge in the serena memory store (`.serena/memories/`), accessed ONLY via the serena MCP server through the gateway — never direct file reads. The structure is domain-based and about-first: each domain has an `about` index describing its scope and boundaries; memory names are hierarchical and self-describing (`domain/subdomain/topic`); public vs private namespaces split committable knowledge from never-commit content (`private/`). A BLOCKING GATE (7 checks) runs before every write; research is cache-first. Domains today include `refactoring/`, `testing/`, `troubleshooting/`, `researches/`, `skills/`, `subagent-workflows/`, and `architecture/` (new). The `architecture/` domain records decisions as ADRs (`mem:architecture/adr-template`, `mem:architecture/adr-rules`).

### Options considered

#### Option A: Serena memory store with domain/about structure (current)
Pros:
- Structured retrieval; MCP-accessible; established conventions (gate, about-first, cache)
Cons:
- Requires gateway/serena access (not directly file-readable); depends on external MCP server; discipline needed to keep domains clean

#### Option B: Plain markdown files in the repo (e.g., `docs/memories/`)
Pros:
- Visible in repo; git-tracked; no external dependency
Cons:
- No structured retrieval/namespace; pollutes repo; no semantic search; no gate enforcement

#### Option C: External knowledge base / vector DB
Pros:
- Scalable semantic search
Cons:
- Heavy infrastructure; overkill for project scale; sync complexity

### Scoring

Criteria (each scored -2 to +2):
- Ease of finding - How easy is it to list, index relevant memories.
- Ease of acessing - How easy it to retreive batch memories.
- Ease of consistency checking - Programmatic reference and consistency check - no missing links
- Infrastructure Setup/Cost/Connectivity - Supports offline, cost of maintaining, setup and update requirements

| Criteria | A: Serena store | B: Plain files | C: External KB |
|---|---|---|---|
| Ease of finding | +2 | +1 | +1 |
| Ease of accessing | +2 | +2 | +1 |
| Ease of consistency checking | +1 | 0 | -1 |
| Infrastructure Setup/Cost/Connectivity | +1 | +2 | -2 |
| Total | +6 | +5 | -1 |

### Consequences

- The `context-gathering` skill documents the memory system: domains, structure, access, and cache gates — it is the operational reference for how memories are organized and written.
