---
name: serena-memory
description: >
  Fix stale, untyped, or bypassed-gate persistent writes to Serena memory. Use when mentions memories, serena, .serena/memories, recall memories, store memory, save to memory, persistent memory, typed memory, memory gate, disclosure, consolidation, claims, evolution, or asks to remember across sessions. Trigger on failure: untyped writes, skipped gate, stale duplicates, or direct .serena reads.
license: MIT
compatibility: Universal
metadata:
  version: "1.4.12"
  delta: "1.4.12 — direct list_memories/read_memory pre-flight; code mode no longer recommended."
  author: Th3Un1qu3
---

# Serena Memory

Enforce typed, gated, progressive-disclosure persistent knowledge via the Serena gateway.

## When to Use This Skill

Invoke this skill when:
- Storing, recalling, updating, or consolidating persistent memories via Serena
- Choosing a typed scope, running the blocking gate, or applying disclosure budgets
- Extracting claims, checking staleness, or promoting cases → trajectories → experiences
- Investigating stale, duplicate, or untyped memories across sessions

## When Not to Use This Skill

Do not use this skill for:
- Transient or unverified research, external fetch, or synthesis without persistence — Call context-gathering via Skill tool on context-gathering/SKILL.md first; unverified findings stay out of memory, and return here only to persist verified ones via typed store
- Not for scratch or deliverables - route per AGENTS.md STORAGE SELECTION.
- Pure codebase edits with no memory persistence
- One-off file reads that do not require recall or storage

## Principles

Gateway pre-flight (MANDATORY):
1. `tools.gateway["list_memories"]({})` — call the tool, do not build a script
2. `tools.gateway["read_memory"]({memory_name: "<id>"})`  // before any answer
// GOOD: `tools.gateway["read_memory"]({memory_name: "entities/person/alice"})`
// BAD: answering from list_memories names alone
// BAD: a code-mode or mcp-exec script for a single call

- **Route every memory through gateway:** call `tools.gateway["list_memories"]`, `["read_memory"]`, or `["write_memory"]` directly; never read .serena/memories directly.
- **Type every memory before gating:** assign one of 9 typed scopes via references/typing.md before you gate.
- **Promote rather than duplicate:** follow AGENTS.md STORAGE SELECTION for what to keep, where, and which copy is authoritative.
- **Apply disclosure budgets before gating:** load L0 256c / L1 4000c / 700c excerpt via references/disclosure.md; quote L0 only from a `read_memory` return, never reconstituted.
- **Gate every write with 9 checks:** run blocking gate in references/gating.md; stop when any check fails; declare complete only after gate passes (all three scripts exit 0) — `validate_memory_frontmatter`, `validate_md_links`, `audit_fences` via `agent_utils/scripts` or `just agent_utils::validate-memories`.
- **Verify staleness before consolidating:** check confidence, hotness, and claim status via references/claims.md and references/lifecycle.md; merge only with human trigger.
- **Evolve claims into typed memories:** promote 3 cases → 1 trajectory → 1 experience with score ≥3 and human gate via workflows/evolve-memory.md.
- **Handle truncation:** list_memories truncates silently — filter with `topic:"<domain>"`, then slice the returned `memories` array to 32 and sort; see workflows/recall-memory.md.
- **Guard every gateway call:** snapshot returns to 2 KB, treat an empty/stderr return as an infra flake and fall back once to `bash cat .serena/memories/<id>.md` (0 retries), and complete recall with the `read_memory` return ritual — see references/gateway-protocol.md.
- **Never record a bypass recipe:** a memory must not tell an agent how to work around a gated action. Record the denial and the mechanism; ask the user when the gated action is essential.

## Routing pre-step

If the task needs external fetch or synthesis before persisting, Call context-gathering via Skill tool on context-gathering/SKILL.md first, then return here for typed store. This skill owns persistent typed memory only; transient researches/* synthesis belongs to context-gathering (exempt per [references/typing.md](./references/typing.md)).

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Store a new persistent memory | [workflows/store-memory.md](./workflows/store-memory.md) |
| Recall memories with progressive disclosure | [workflows/recall-memory.md](./workflows/recall-memory.md) |
| Update, rename, deduplicate, or retire memories | [workflows/manage-memory.md](./workflows/manage-memory.md) |
| Evolve claims → trajectories → experiences | [workflows/evolve-memory.md](./workflows/evolve-memory.md) |
| Choose the typed scope for a memory | [references/typing.md](./references/typing.md) |
| Run the 9-check blocking gate | [references/gating.md](./references/gating.md) |
| Apply progressive disclosure budgets | [references/disclosure.md](./references/disclosure.md) |
| Run the gateway snapshot, empty-return fallback, and return ritual | [references/gateway-protocol.md](./references/gateway-protocol.md) |
| Extract and manage claims | [references/claims.md](./references/claims.md) |
| Track lifecycle, TTL, and hotness | [references/lifecycle.md](./references/lifecycle.md) |
| Consolidate multiple memories into one | [recipes/consolidate.md](./recipes/consolidate.md) |
| Define frontmatter families, limits, inheritance, and search | [references/frontmatter.md](./references/frontmatter.md) |
| Validate memory frontmatter and fences | [agent_utils/scripts/validate_memory_frontmatter.py](../../../agent_utils/scripts/validate_memory_frontmatter.py) |

## Related Skills

- `context-gathering` — transient research and cache-first external content; Call context-gathering via Skill tool on context-gathering/SKILL.md when research precedes memory writes.
- `harness-management` — decide where persistent guidance belongs; Call harness-management via Skill tool on harness-management/SKILL.md when a recurring failure needs a harness change.
