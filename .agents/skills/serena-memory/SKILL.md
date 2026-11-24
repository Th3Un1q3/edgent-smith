---
name: serena-memory
description: >
  Find and organize persistent knowledge via the Serena memory gateway: typed recall, storage, dedup, and consolidation. Use when mentions memories, serena, .serena/memories, recall memories, store memory, save to memory, persistent memory, typed memory, memory gate, disclosure, consolidation, claims, evolution, or asks to remember/find/organize across sessions. Trigger on failure: untyped writes, skipped gate, stale duplicates, or direct .serena reads.
license: MIT
compatibility: Universal
metadata:
  version: "1.4.23"
  author: Th3Un1qu3
---

# Serena Memory

Recall, store, gate, and consolidate typed persistent knowledge through the Serena gateway.

## When to Use This Skill

- Storing, recalling, updating, or consolidating persistent memories via Serena
- Choosing a typed scope, running the blocking gate, or applying disclosure budgets
- Extracting claims, checking staleness, or promoting cases → trajectories → experiences
- Investigating stale, duplicate, or untyped memories across sessions

## When Not to Use This Skill

- Transient or unverified research, external fetch, or synthesis without persistence — unverified findings stay out of memory; the Routing pre-step below holds the handoff to context-gathering
- Scratch files or deliverables — keep them out of memory
- Pure codebase edits with no memory persistence
- One-off file reads that do not require recall or storage

## Principles

Gateway pre-flight (MANDATORY):
1. `tools.gateway["list_memories"]({})` — the snapshot that precedes any answer
2. `tools.gateway["read_memory"]({memory_name: "<id>"})`  // before any answer
// GOOD: `tools.gateway["read_memory"]({memory_name: "entities/person/alice"})`
// BAD: answering from list_memories names alone
// BAD: a code-mode or mcp-exec script for a single call

- **Resolve conflicts symmetrically:** either the old memory is superseded (status=superseded, new active) or BOTH are disputed; never leave the old active while marking only the new disputed; never leave two active contradictory memories. Detection without one of these writes is incomplete: you must call edit_memory/write_memory to record the supersede or the both-disputed transition. A superseded memory opens with a banner naming its replacement (`superseded by <id>`), so a reader who lands on the body learns it is dead before reading it as guidance; the status write without that banner leaves a dead body reading as live guidance.
- **Detect conflicts during recall:** when two memories on the same subject disagree, read both, judge trust by freshness/hotness/confidence/evidence, explain the choice, and write cross-references (superseded-by/supersedes) so the pair is no longer unlinked.
- **Never delete outdated or irrelevant memories:** mark status stale/retired/superseded, keep them for audit, and write a persistent audit memory naming the retired ids, status change, reason, and date. Marking a memory stale/retired does NOT require a human gate; a human gate is required before any deletion or before superseding a contested claim.
- **Route every memory through gateway:** call `tools.gateway["list_memories"]`, `["read_memory"]`, or `["write_memory"]` directly; never read .serena/memories directly, except the single infra-flake fallback under Fall back once on an infra flake below.
- **Type every memory before gating:** assign one of 9 typed scopes via references/typing.md before you gate.
- **Promote rather than duplicate:** follow AGENTS.md STORAGE SELECTION for what to keep, where, and which copy is authoritative.
- **Apply disclosure budgets before gating:** load L0 256c / L1 4000c / 700c excerpt via references/disclosure.md; quote L0 only from a `read_memory` return, never reconstituted.
- **Write within the 4000c L1 ceiling:** L1 counts frontmatter with the body, so frontmatter plus body stays within 4000c and the body allowance is 4000c minus its frontmatter. A memory over the ceiling splits into a document memory plus a summary carrying its pointers, or is trimmed; an existing oversized body is split on its next edit rather than exempted. Measure the draft with `wc -c` before the first store: a draft over the allowance is split into parts first, because a stored oversized body costs a rewrite instead of an edit. Size it once from a section-length breakdown, store it once, then edit that memory in place, and run the post-write verification (read-back, then the validation scripts when present) immediately after the first successful write rather than after polishing prose. The documented body allowance is the only ceiling: a writer who applies a tighter self-imposed cap has no memory to verify.
- **Resolve the lesson before gating:** before a memory is created, `list_memories({topic:"<namespace>"})` and read the names it returns, then merge or supersede — when an existing memory in that namespace already teaches the lesson, merge into it or supersede it, so one active memory teaches one lesson. This step precedes the gate; the gate stays 9 checks.
- **A body carries the lesson, not the write.** Write the subject and nothing about producing the memory: no report scaffolding (outcome, evidence, residual risk, spend, "left undone", "not a case"), no provenance of this write ("moved verbatim", "byte-identical to its pre-split form", "merged from here"), no changelog or correction log, no counts paragraph, no loss note, no appendix the lesson does not use. A case keeps its five fields — symptom, false hypothesis, root cause, how confirmed, prevention — because each states the incident, and "how confirmed" records how the incident's cause was confirmed, never how this memory was written. Whatever belongs to the run that wrote the memory stays in that run's report.
- **Name the actor in every action statement.** In a memory body, every sentence about an action names who acted, by role — the dispatch author who wrote the prompt, the child who executed it, the reviewer who checked the result — never "the orchestrator", "no one", "it was decided", "whoever", or a passive that hides the actor ("the discrepancy was absorbed"). A prevention line names the role that acts next time, so the next reader knows whose behaviour changes: "the dispatch author names the write target in the prompt", not "the target should be named".
- **Gate every write with 9 checks:** run the blocking gate in references/gating.md; stop when any check fails. The three python scripts (`validate_memory_frontmatter`, `validate_md_links`, `audit_fences`) are optional verification — run them if available, never block completion on their absence.
- **Verify staleness before consolidating:** check confidence, hotness, and claim status via references/claims.md and references/lifecycle.md; merge only with human trigger.
- **Evolve claims into typed memories:** promote 3 cases → 1 trajectory → 1 experience with score ≥3 and human gate via workflows/evolve-memory.md.
- **Handle truncation:** list_memories truncates silently — filter with `topic:"<domain>"`, then slice the returned `memories` array to 32 and sort; see workflows/recall-memory.md.
- `preferences/` is canonical; `profile/preferences/` is a legacy alias kept for navigation only.
- **About for every scope:** every scope with children (including exempt scopes) carries an `*/about` for navigation; the global index aggregates About tables.
- **Shard large abouts:** when a scope exceeds 32 children, split into sub-scope abouts instead of overflowing the 256c L0 table.
- **Snapshot every gateway call:** `list_memories` returns at most 2 KB.
- **Fall back once on an infra flake:** an empty or stderr return is an infra flake; fall back once to `bash cat .serena/memories/<id>.md` where the harness permits direct reads, with 0 retries — the single sanctioned infra-flake exception to the never-read-.serena rule.
- **A denial is not an infra flake:** a denied direct read ends the fallback, is reported, and is not retried.
- **Close recall with the return ritual:** complete recall with the conditional `read_memory` return ritual in references/gateway-protocol.md.
- Cite recalled memories with `mem:` refs: every contributing memory in a report/answer appears as `mem:memory-name`, not a bare name.
- **Never record a bypass recipe:** a memory must not tell an agent how to work around a gated action. Record the denial and the mechanism; ask the user when the gated action is essential.

## Routing pre-step

If the task needs external fetch or synthesis before persisting, call `context-gathering` via the Skill tool on context-gathering/SKILL.md first, then return here for typed store. This skill owns persistent typed memory only; transient researches/* synthesis belongs to context-gathering (exempt per [references/typing.md](./references/typing.md)).

## Scope decision (one line)

| Scope | Means |
|---|---|
| entities | people / systems / orgs |
| claims | atomic facts + evidence |
| cases | single failure + fix |
| preferences | user choices |

## Task Routing Table

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

- `context-gathering` — transient research and cache-first external content.
- `harness-management` — decide where persistent guidance belongs; Call harness-management via Skill tool on harness-management/SKILL.md when a recurring failure needs a harness change.
