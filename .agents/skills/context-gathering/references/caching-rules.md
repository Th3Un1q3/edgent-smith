# Reference: Caching Rules

The skill's cache rulebook: cache-first default, context budgets, READ/WRITE checkpoints, one entry per fetched URL, key scheme, verification, and per-op status lines. Canonical home of every cache rule previously carried in the root SKILL.md.

**When to load:** whenever a research task fetches external content (deepwiki, github, fetch, tavily, youtube), checks `cache/{source}/...` for a HIT, writes cache entries, or returns per-op status reports — any time the cache-first pipeline, budgets, verification, or reporting rules apply.

## §1 Cache-first default

Cache first, always: every research fetch (deepwiki ask_question, github issue/search, fetch) checks `cache/{source}/...` before calling the tool, writes the full raw response on miss, and cites entries with `mem:` refs in any `researches/{topic}` memory. This is the default — no reminding needed.

Before answering from memory: run [collect-relevant-memories](../recipes/collect-relevant-memories.md) (list domains → read `about` → fetch matching) first.

## §2 Context budgets

**Context budget (hard, ~60K tokens for research subagents):** all tool returns must be truncated in-script — snapshot ≤2 KB; fetched content of ANY kind (transcript pages, doc pages, search results, raw tool responses) is CACHED to `cache/{source}/…`, NOT returned to the model; search results trimmed to {title, url}. Returning >5KB of raw content to the model is a violation.

**This applies to ALL tool returns AND file reads:** every snapshot (fetch output, memory read-back, file read, search results, enumeration output) returned to the model must be truncated in-script to ≤2 KB; memory read-backs for verification return only header + length + ≤700-char excerpt; full content stays in cache/files, NEVER in context. **Operating-memory exception:** the ≤700-char cap applies to VERIFICATION read-backs of result caches only — operating memories (extraction memories `browser-automation/<site>/<task>-extraction`, site-specific how-to memories) are read in FULL because they ARE the operating instructions; never act on a truncated selector list.

**Read-back integrity:** slicing a single memory/file into multiple reads whose concatenation returns the full content DEFEATS the ≤2KB rule — verification read-backs return ONLY header + length + ≤700-char excerpt (or aggregated scalar fields totaling ≤3KB), never the full content, even split across calls. Returning >5KB of raw content (from any source) to the model is a violation. Cross-referenced in [external-content-caching.md](../recipes/external-content-caching.md).

## §3 READ checkpoints (CHECK)

Check these BEFORE acting:

- Before ANY external research fetch (deepwiki, github, fetch, tavily, youtube): list + read `cache/{source}/...` for the deterministic key — a HIT means reuse, do NOT re-fetch. Per-URL lookup: before fetching URL X, check `cache/fetch/{host-slug}/{path-slug}` — the key is derived deterministically from X (host and path slugs); HIT = reuse, do NOT re-fetch that URL.
- Before synthesizing research findings: check existing `researches/{topic}` memories to build on, not duplicate.

**Vocabulary:** HIT — the cache key exists; reuse it, do not re-fetch. MISS — the key is absent; fetch and store. `mem:` prefix — a memory-name link inside another memory's content. `OK/FAIL <name> chars=<n> pages=<n>` — per-operation status line format. about-first — write the domain's `about` entry before any other memory in that domain. Phase labels CHECK (look in the cache before fetching) → FETCH (call the tool on a miss) → STORE (write the full raw response) → SYNTHESIZE (write the `researches/{topic}` memory with `mem:` refs) label every cache-aware research script. HARVEST — collect candidate targets before fetching.

## §4 Cardinality

**Cardinality — one cache entry per fetched URL:** every successful fetch of a URL stores THAT page's full returned content under its own deterministic key `cache/fetch/{host-slug}/{path-slug}`. Never collapse multiple pages into a single entry. Pagination rounds of one URL consolidate into that URL's single entry (assembled content; note any truncation in the header).

## §5 SYNTHESIZE

Every research task → SYNTHESIZE `researches/about` first, then `researches/{topic-slug}` with a "## Cached sources" section of `mem:` refs to every cache entry used.

## §6 About-first

`cache/about` per source before that source's first write; about-first rule.

## §7 Ground truth

**Ground truth:** Raw fetched page content is the ground truth for cross-checking and revisiting. Syntheses and extractions belong in `researches/` and MUST `mem:`-reference the raw cache entries they derive from — never replace raw content with a summary.

## §8 Verbatim-only + verify after cache-write

**Cache = verbatim tool output only.** Never write hand-crafted summaries, paraphrases, or truncated snippets as cache entries — a cache entry's body must be the raw tool return (full transcript/page).

**Verify cache writes:** after each cache-write batch, read back 1–2 entries via `read_memory`, confirm the stored content is present and matches what was fetched, and report counts as 'N fetched → N cached → N verified'. Any entry failing verification = FAIL: delete it and redo. (Length expectations are source-specific — see the labeled YouTube example in [external-content-caching.md](../recipes/external-content-caching.md) for transcript-specific guidance.)

General principle: SKILL.md Principles — "Verify every write".

## §9 Status-report requirement

**Status-report requirement:** Every research task's per-op status report MUST state the counts: "N pages fetched → N cache entries written" (match required), so ground-truth coverage is verifiable. Per-op lines are OK/FAIL `<name> chars=<n> pages=<n>`; never return content.

## §10 Return snippets

**Return snippets for relevance judgment:** cache the COMPLETE content verbatim, but return only per-op status lines plus a 200–300 char excerpt per item — never full content (pattern: [external-content-caching.md](../recipes/external-content-caching.md) "Return snippets for relevance judgment").

## §11 Check about existence before writing

**Before writing a domain `about`, check existence first** — during new-domain creation, list the domain prefix and confirm the `about` is absent before writing; an existing about is never overwritten during creation without operator approval (a fresh template would clobber accumulated scope/boundaries). Routine extension of an existing `about` (new source/scope) reads it first and appends — it does not re-create the about from scratch.

---

Rules here are referenced from the root ([SKILL.md](../SKILL.md), one pointer line) and from [research-with-caching.md](../recipes/research-with-caching.md) / [external-content-caching.md](../recipes/external-content-caching.md). Worked JS examples for budgets/read-back: [truncation-examples.md](./truncation-examples.md).
