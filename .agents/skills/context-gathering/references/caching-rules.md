# Reference: Caching Rules

The skill's cache rulebook: cache-first default, context budgets, READ/WRITE checkpoints, one entry per fetched URL, key scheme, verification, and per-op status lines. Canonical home of every cache rule previously carried in the root SKILL.md.

**When to load:** whenever a research task fetches external content (deepwiki, github, fetch, tavily, youtube), checks `cache/{source}/...` for a HIT, writes cache entries, or returns per-op status reports — any time the cache-first pipeline, budgets, verification, or reporting rules apply.

> **Storage invariant:** `cache/`, `researches/`, `private/` are Serena memory domains (`write_memory`/`read_memory` via serena server), never filesystem paths under `/workspace/cache/`. Do not use filesystem `write_file` for cache entries; use `write_memory({memory_name:\"cache/...\", max_chars:100000})` only. Lint: `just agent_utils::validate-memories` and filesystem guard in [filesystem-server-api.md](./filesystem-server-api.md).

## §1 Cache-first default

Cache first, always: every research fetch (deepwiki ask_question, github issue/search, fetch) checks `cache/{source}/...` before calling the tool, writes the full raw response on miss, and cites entries with `mem:` refs in any `researches/{topic}` memory. This is the default — no reminding needed.

Before answering from memory: run serena-memory recall (list domains → read about → fetch matching) — see [recall-memory](../../serena-memory/workflows/recall-memory.md) first.

## §2 Context budgets

See [serena-memory/references/frontmatter.md § Search Method](../../serena-memory/references/frontmatter.md) for canonical budgets. All tool returns truncated in-script — see [truncation-examples.md](./truncation-examples.md) `snapshot()` and `verifyAfterWrite()` for worked examples.

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

**Per-source verify:** split tavily, fetch, deepwiki, github into separate `gateway_mcp-exec` calls. After each source's STORE, run `verifyAfterWrite([names], minChars)` and `snapshot()` (see [truncation-examples.md §B](./truncation-examples.md)) before the next source. Return `COUNT N fetched → N cached → N verified` plus per-op `OK/FAIL <name> chars=<n>` lines. All returns truncated in-script to ≤2 KB. Respect 2× retry cap per tool/target — never exceed 2 attempts on the same target.

General principle: SKILL.md Principles — "Verify every write".

## §9 Status-report requirement

**Status-report requirement:** Every research task's per-op status report MUST state the counts: "N pages fetched → N cache entries written" (match required), so ground-truth coverage is verifiable. Per-op lines are OK/FAIL `<name> chars=<n> pages=<n>`; never return content.

## §10 Return snippets

**Return snippets for relevance judgment:** cache the COMPLETE content verbatim, but return only per-op status lines plus a 200–300 char excerpt per item — never full content (pattern: [external-content-caching.md](../recipes/external-content-caching.md) "Return snippets for relevance judgment").

## §11 Check about existence before writing

**Before writing a domain `about`, check existence first** — during new-domain creation, list the domain prefix and confirm the `about` is absent before writing; an existing about is never overwritten during creation without operator approval (a fresh template would clobber accumulated scope/boundaries). Routine extension of an existing `about` (new source/scope) reads it first and appends — it does not re-create the about from scratch.

---

Rules here are referenced from the root ([SKILL.md](../SKILL.md), one pointer line) and from [research-with-caching.md](../recipes/research-with-caching.md) / [external-content-caching.md](../recipes/external-content-caching.md). Worked JS examples for budgets/read-back: [truncation-examples.md](./truncation-examples.md).

## §12 Private cache layer

Session-private devtools output goes to `private/{site}-research/*` and `private/cache/devtools/...` — never to public `cache/{source}/...`. `cache/` holds public verbatim fetches (tavily, fetch, deepwiki, github on public content) and is regenerable. `private/` is gitignored, session-derived, and must not be `mem:`-referenced from public `researches/*` or `cache/*`. Sources: `cache/` = public verbatim; `private/` = devtools authenticated output and PII.

For persistent memory disclosure see serena-memory/references/disclosure.md

