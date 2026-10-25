---
name: serena-memory
description: >
  Find and organize persistent knowledge via the Serena memory gateway: typed recall, storage, dedup, and consolidation. Use when mentions memories, serena, .serena/memories, recall memories, store memory, save to memory, persistent memory, typed memory, memory gate, disclosure, consolidation, claims, evolution, or asks to remember/find/organize across sessions. Trigger on failure: untyped writes, skipped gate, stale duplicates, or direct .serena reads.
license: MIT
compatibility: Universal
metadata:
  version: "1.4.18"
  delta: "1.4.18 — require mem: refs citation for every recalled memory used in an answer: SKILL.md principle plus recall-memory.md acceptance line."
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

- **Resolve conflicts symmetrically:** either the old memory is superseded (status=superseded, new active) or BOTH are disputed; never leave the old active while marking only the new disputed; never leave two active contradictory memories. Detection without one of these writes is incomplete: you must call edit_memory/write_memory to record the supersede or the both-disputed transition.
- **Detect conflicts during recall:** when two memories on the same subject disagree, read both, judge trust by freshness/hotness/confidence/evidence, explain the choice, and write cross-references (superseded-by/supersedes) so the pair is no longer unlinked.
- **Never delete outdated or irrelevant memories:** mark status stale/retired/superseded, keep them for audit, and record the action in a memory (or flag for review). Marking a memory stale/retired does NOT require a human gate; a human gate is required only before deleting or superseding a contested claim; write a persistent audit memory naming the retired ids, status change, reason, and date.
- **Route every memory through gateway:** call `tools.gateway["list_memories"]`, `["read_memory"]`, or `["write_memory"]` directly; never read .serena/memories directly.
- **Type every memory before gating:** assign one of 9 typed scopes via references/typing.md before you gate.
- **Promote rather than duplicate:** follow AGENTS.md STORAGE SELECTION for what to keep, where, and which copy is authoritative.
- **Apply disclosure budgets before gating:** load L0 256c / L1 4000c / 700c excerpt via references/disclosure.md; quote L0 only from a `read_memory` return, never reconstituted.
- **Gate every write with 9 checks:** run blocking gate in references/gating.md; stop when any check fails; declare complete only after the 9 checks pass. The three python scripts (`validate_memory_frontmatter`, `validate_md_links`, `audit_fences`) are optional verification — run them if available, never block completion on their absence.
- **Verify staleness before consolidating:** check confidence, hotness, and claim status via references/claims.md and references/lifecycle.md; merge only with human trigger.
- **Evolve claims into typed memories:** promote 3 cases → 1 trajectory → 1 experience with score ≥3 and human gate via workflows/evolve-memory.md.
- **Handle truncation:** list_memories truncates silently — filter with `topic:"<domain>"`, then slice the returned `memories` array to 32 and sort; see workflows/recall-memory.md.
- **Canonical preferences path:** `preferences/` is canonical; `profile/preferences/` is a legacy alias kept for navigation only.
- **About for every scope:** every scope with children (including exempt scopes) carries an `*/about` for navigation; the global index aggregates About tables.
- **Shard large abouts:** when a scope exceeds 32 children, split into sub-scope abouts instead of overflowing L0_table.
- **Guard every gateway call:** snapshot returns to 2 KB, treat an empty/stderr return as an infra flake and fall back once to `bash cat .serena/memories/<id>.md` (0 retries) — the single sanctioned infra-flake exception to the never-read-.serena rule — and complete recall with the conditional `read_memory` return ritual — see references/gateway-protocol.md.
- Cite recalled memories with `mem:` refs: every contributing memory in a report/answer appears as `mem:memory-name`, not a bare name.
- **Never record a bypass recipe:** a memory must not tell an agent how to work around a gated action. Record the denial and the mechanism; ask the user when the gated action is essential.

## Routing pre-step

If the task needs external fetch or synthesis before persisting, Call context-gathering via Skill tool on context-gathering/SKILL.md first, then return here for typed store. This skill owns persistent typed memory only; transient researches/* synthesis belongs to context-gathering (exempt per [references/typing.md](./references/typing.md)).

## Scope decision (one line)

| Scope | Means |
|---|---|
| entities | people / systems / orgs |
| claims | atomic facts + evidence |
| cases | single failure + fix |
| preferences | user choices |

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Store a new persistent memory | [workflows/store-memory.md](./workflows/store-memory.md) |
| Recall memories with progressive disclosure | [workflows/recall-memory.md](./workflows/recall-memory.md) |
| Update, rename, deduplicate, or retire memories | [workflows/manage-memory.md](./workflows/manage-memory.md) |
| Evolve claims → trajectories → experiences | [workflows/evolve-memory.md](./workflows/evolve-memory.md) |
| Run skill evals via OpenCode CLI | [workflows/run-evals.md](./workflows/run-evals.md) |
| Choose the typed scope for a memory | [references/typing.md](./references/typing.md) |
| Run the 9-check blocking gate | [references/gating.md](./references/gating.md) |
| Apply progressive disclosure budgets | [references/disclosure.md](./references/disclosure.md) |
| Run the gateway snapshot, empty-return fallback, and return ritual | [references/gateway-protocol.md](./references/gateway-protocol.md) |
| Extract and manage claims | [references/claims.md](./references/claims.md) |
| Resolve conflicting/ambiguous memories without explicit pointer | [references/ambiguity.md](./references/ambiguity.md) |
| Track lifecycle, TTL, and hotness | [references/lifecycle.md](./references/lifecycle.md) |
| Consolidate multiple memories into one | [recipes/consolidate.md](./recipes/consolidate.md) |
| Define frontmatter families, limits, inheritance, and search | [references/frontmatter.md](./references/frontmatter.md) |
| Validate memory frontmatter and fences | [agent_utils/scripts/validate_memory_frontmatter.py](../../../agent_utils/scripts/validate_memory_frontmatter.py) |
| Validate an eval run against success criteria | [references/evaluations.md](./references/evaluations.md) |

## Related Skills

- `context-gathering` — transient research and cache-first external content; Call context-gathering via Skill tool on context-gathering/SKILL.md when research precedes memory writes.
- `harness-management` — decide where persistent guidance belongs; Call harness-management via Skill tool on harness-management/SKILL.md when a recurring failure needs a harness change.
