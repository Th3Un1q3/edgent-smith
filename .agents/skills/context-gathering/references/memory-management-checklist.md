# Memory Management Checklist — the Blocking Gate

One gate governs every memory write. This checklist is the canonical, complete gate — [store-memories.md](../recipes/store-memories.md) points here instead of embedding a copy, so there is only one source of truth.

## The Blocking Gate (7 checks, ~60 seconds)

Run BEFORE any `write_memory` call. If ANY box is unchecked, DO NOT WRITE — fix the item or skip the write. Writing with an unchecked box corrupts the store. For a batch of related memories, run the gate once on the planned set, then verify the set.

<!-- Canonical gate — the single source of truth; store-memories.md links here and embeds no copy. -->
- [ ] **Standalone** — a reader with no memory of this session can use it as-is. No "in this session…", "today we…", "the real cause was…". *If not:* session narrative is unusable to future readers → rewrite as knowledge ("the cause is X") with evidence.
- [ ] **Verified** — every claim names its source — docs, operator, or observed output — or is explicitly marked `UNVERIFIED`. *If not:* a confident-but-wrong fact poisons future sessions and forces human correction → check the claim against docs/operator/observed output before writing; never encode a theory as fact.
- [ ] **Reusable** — a different future task would use this; it is not one-session trivia. *If not:* trivia buries signal → skip the write.
- [ ] **Non-duplicative** — it adds knowledge not already in memories, skills, or AGENTS.md. *If not:* duplicate or contradictory entries mislead → extend the existing memory or skip.
- [ ] **Discoverable** — scanning the memory list, the name alone tells a reader whether this memory helps their task. Name is self-describing: <domain>/<subdomain>/<topic>, action-oriented (e.g., troubleshooting/software/finding-known-github-issues), never a bare title (e.g., Issue & Docs Analysis). *If not:* a memory whose name hides its content is dead weight → rename to a self-describing <domain>/<subdomain>/<topic> name; if a title-style name cannot be made self-describing, split the memory.
- [ ] **Right-size** — at the right abstraction level: no line numbers, exact paths, or code dumps that will stale; ≤ 3 paragraphs. *If not:* over-specific detail misleads after the code changes → raise the abstraction level.
  - **Exemption — dated extraction caches**: `private/<site>/<task>-<YYYY-MM-DD>` listings (rows with links) are data memories by design. The prose/right-size limit ("≤ 3 paragraphs", "no data dumps") applies to recipe/knowledge memories, NOT to dated data caches — intermediate checkpoint caches (partial results written as work proceeds) are covered by this exemption. The exemption's scope is `private/<site>/<task>-<YYYY-MM-DD>` row listings only — it does NOT waive the raw-content requirement for public `cache/fetch/...` entries, which store full fetched page content by design. Note: legacy `browser-automation/...` dated caches predate the private namespace.
- [ ] **Privacy** — only devtools-derived output from authenticated sessions, PII, or job/application data is private; such content is stored in `private/` (`private/about`, `private/{subdomain}/{topic}`, `private/cache/{source}/...`), never in a public domain; public memories never `mem:`-link into `private/*`. Public-source content (fetch/tavily/deepwiki/github/context7) stays public. *If not:* private data may be committed to version control → route to the private namespace or skip the write.

## After Writing — read the memory back once

AFTER WRITING — read the memory back once (or the whole batch). If it does not read as standalone, verified knowledge, fix it immediately. Confirm the memory's name is self-describing (a reader scanning the list can judge it) and its domain has an about that covers this memory's scope and boundaries.

## Secondary quality bar (absorbed from the superseded memory-quality.md)

When the gate passes, polish against these:

- **Right abstraction level** — Pass: "OpenCode plugins use a state model with accumulated step counts persisted to SessionStorage under a namespaced key, with hooks that read/modify/persist via readState/updateState." Fail: "The skill-usage-tracker plugin's `countStep` function at line 151 increments `stepCount` by 1." Think checklist, not a recipe for one file.
- **Concise** — max 2–3 paragraphs; bullet lists and tables; cross-reference with `mem:` instead of duplicating.
- **Granular** — one concept per memory; split large topics into sub-topics under the same domain.

## Negative examples

- **Too granular**: "…`countStep` function at line 151…" — duplicates source code; line numbers stale.
- **Session-specific**: "During today's refactoring, we moved the `getSessionAgent` helper…" — one-time change, not reusable.
- **Already documented**: "Python 3.13 uses `from __future__ import annotations`" — already in AGENTS.md.
- **Title-style name**: "Issue & Docs Analysis" — a reader scanning the list cannot tell what is inside or when it helps. Use action-oriented self-describing names (e.g., troubleshooting/software/finding-known-github-issues).

## Authoritative Source Rule

Operator statements and documented mechanics beat agent theories. When a memory records how something works, it must name the source it was verified against — docs, observed output, or the operator. If two sources disagree, record the discrepancy and the decisive test; do not average and do not pick the more confident story. A theory recorded as fact is the costliest memory failure: it poisons future sessions and forces human correction.

## Maintenance

- Memories written before this gate existed may violate it — fix them as you touch them (see manage-memories).
- store-memories.md points here — there is only one copy. If the gate changes, update the pointer in the store recipe.
