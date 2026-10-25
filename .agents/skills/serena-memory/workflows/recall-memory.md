# Workflow: Recall Memory

Retrieve memories with progressive disclosure L0→L1→L2 via Serena gateway.

When to load: when you list, search, or read persistent memories to answer or ground a task.

## Pagination — no pagination API

`list_memories` has no pagination. Handle truncation at the top of every recall:

- Prefer scoped calls: `list_memories({topic:"<scope>"})` then slice 32.
- Full-store recall is undefined as a single call; use scoped topic-prefix calls plus `*/about` tables instead of `list_memories({})`.
- Never assume one call returns all.

```javascript
// Scoped recall — copy-pasteable, handles truncation
var raw = list_memories({ topic: "entities" }); // prefix filter
var parsed = JSON.parse(raw);
var all = parsed.memories || [];
all.sort();
var page = all.slice(0, 32); // first page — Implements: 32-sample + prefix
page.join("\n");
```

## Prerequisites

- Call `tools.gateway["list_memories"]` directly with a topic filter when known; use `list_memories({})` only when no topic is known. No sandbox setup.
- Load [references/frontmatter.md](../references/frontmatter.md) § Search Method for Q1/Q2/Q3 and budgets; [references/disclosure.md](../references/disclosure.md) for budgets; [references/typing.md](../references/typing.md) for scope filters.
- Guard every gateway return: cap to 2 KB (`snapshot`) and treat an empty/stderr return as an infra flake — fall back once to `bash cat .serena/memories/<id>.md`, zero gateway retries.
- Return ritual is conditional: `read_memory` is required before answering with content; existence/count/name-scan queries may answer from names alone.

## Tools

- gateway list_memories/read_memory

## Topic Prefix Semantics

`list_memories({topic:"prefix"})` matches memory names with that prefix. `topic:"about"` returns all `*/about` (every domain's about) — prefix match on `about` suffix via About tables. Use it for scoped recall. See [references/typing.md](../references/typing.md) and [frontmatter.md § Search Method](../references/frontmatter.md).

// BAD: topic:"automa" → 0 (prefix != substring); GOOD: topic:"browser-automation"

### Hyphenated topics (F7)

`list_memories` prefix filter splits on `-`, so a hyphenated topic such as `ci-failures` matches nothing. Use the first segment plus a client filter, or prefer underscore ids `ci_failures`.

```javascript
function hyphenSafe(topic){
  var seg = topic.split("-")[0];
  var raw = list_memories({ topic: seg });
  var names = JSON.parse(raw).memories || [];
  return names.filter(function(n){ return n.indexOf(topic) >= 0; });
}
hyphenSafe("ci-failures") // Implements: first segment + client filter
```

## Fast path (small stores <=32 memories)

> ⚠️ **WARNING: NEVER pass a hyphenated topic to `list_memories` (hyphen splits on `-` and returns 0). Use the first segment (e.g. `serena`) plus client filter, or use underscore ids. See [frontmatter.md](../references/frontmatter.md) § Hyphen prefix bug.**

Default to a scoped call: `list_memories({topic:"<scope>"})`. Use unfiltered `list_memories({})` only when no topic is known, then filter client-side. Shell filtering (bash/grep over names) is a fallback, not the primary path. Treat an empty return as an infra flake per [gateway-protocol.md](../references/gateway-protocol.md) — one-shot `bash cat .serena/memories/<id>.md` fallback, 0 retries. Target <=3 gateway calls typical. Budget target: recall+store <=5 gateway calls typical (4 when single candidate).

- 1 call `list_memories({topic:"<scope>"})` → names (L0 quote-only, 256c); slice to 32. If no topic is known, use `list_memories({})` and filter client-side.
- Read at most 2 bodies via `read_memory` (top-2); a 3rd read only on miss.
- Skip the about-table scan unless names are insufficient.

## Steps — Minimal Recall (default path)

Default path uses at most 1 `list_memories` and at most 2 `read_memory` calls typical (3 on miss).

1. **List names (L0)** — one `list_memories({topic:"<scope>"})`; treat names as L0 summaries; do not read bodies yet. Done when: parsed `.memories` array filtered by typed prefix or topic.
2. **Read L0 first (quote-only, 256c)** — quote the L0 field (≤256c) from frontmatter; escalate to L1 only on miss. Never read the full body unless top-K verified. Done when: L0 quotes captured for candidates.
3. **Read top-K at L1** — `read_memory` truncated to 4000c for at most 3 candidates; rank by prefix/exact/alphabetical plus optional hotness if present. Done when: ranked list of K≤3 candidates.
4. **Conflict check** — compare the K candidates for same-subject contradictions before answering; reconcile per [references/ambiguity.md](../references/ambiguity.md): compare freshness/hotness/confidence/evidence, present both, write the cross-reference. Done when: no unlinked contradictory pair remains in the answer.
5. **Fetch L2 for execution** — read full body only for verified top-K; inject mem: refs into context. Done when: full bodies available for synthesis and cited.

Gate: never fetch L2 for the entire store — cap L2 reads to top-K (default 3). Never read more than 3 bodies on the default path.

### Large-store fallback (about-table scan)

Use this only when the default path misses or the store is large. It costs more calls.

```javascript
function searchByAbout(query){
  var abouts = JSON.parse(list_memories({topic:"about"})).memories || [];
  for (var i = 0; i < abouts.length; i++) {
    var body = read_memory({ memory_name: abouts[i] });
    if (body.indexOf(query) >= 0) return abouts[i];
  }
  return null;
}
searchByAbout("backend") // Implements: about-table scan fallback
```

## Search Method — Q1 / Q2 / Q3

Use Q1/Q2/Q3 snippets from [frontmatter.md § Search Method](../references/frontmatter.md) — About tables first, prefix scan fallback, budgets 256c/4000c/700c.

### Q1 — Search by L0 via About tables (fallback)

About-table scan is the large-store fallback, not the default. Use the minimal path above first.

### Q2 — Summary L0 per Scope via About

```javascript
function scopeSummary(scope){
  var body = read_memory({ memory_name: scope + "/about" });
  var fm = body.match(/^---\n([\s\S]*?)\n---/);
  return fm ? fm[1].slice(0,4000) : body.slice(0,4000);
}
scopeSummary("entities") // Implements: Q2 L0 summary per scope
```

### Q3 — Fetch L1s by Topic Prefix (top-K only)

Read at most 3 bodies, not 32.

```javascript
function fetchL1s(topic, k){
  k = k || 3;
  var names = JSON.parse(list_memories({topic: topic})).memories || [];
  names.sort();
  return names.slice(0, k).map(function(n){
    var full = read_memory({ memory_name: n });
    return {name:n, l1:full.slice(0,4000), excerpt:full.slice(0,700)};
  });
}
fetchL1s("entities/person", 3) // Implements: Q3 top-K (3) only
```

## Hybrid Scoring — simplified (F4)

Drop the BM25/vector/hotness formula. Rank by prefix match, then exact match, then alphabetical; apply hotness only if present in frontmatter.

```javascript
function rankMemories(names, query, hotnessMap){
  hotnessMap = hotnessMap || {};
  var scored = names.map(function(n){
    var prefix = n.indexOf(query) === 0 ? 0 : 1;
    var exact = n === query ? 0 : 1;
    var hot = hotnessMap[n] || 0;
    return {name:n, key: prefix + ":" + exact + ":" + (hot ? (1-hot).toFixed(3) : "1.000")};
  });
  scored.sort(function(a,b){ return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  return scored.map(function(x){ return x.name; });
}
rankMemories(["entities/person/alice","entities/person/bob"], "entities/person/alice", {}) // Implements: prefix/exact/alphabetical + optional hotness
```

## Examples

List and scan at L0 budget:

```javascript
var raw = list_memories({ topic: "entities" });
var parsed = JSON.parse(raw);
var memories = parsed.memories || [];
var candidates = memories.filter(function(m){ return m.indexOf("entities/person")===0; });
candidates.slice(0, 3).join("\n"); // sample top-3
```

Rerank at L1 with budget guard:

```javascript
var read = read_memory({ memory_name: "entities/person/alice" });
var l1 = read.slice(0, 4000); // L1 cap — Implements: 4000c budget
```

L2 guarded fetch:

```javascript
var full = read_memory({ memory_name: "entities/person/alice" });
var excerpt = full.slice(0, 700);
excerpt
```

## Gateway Guard + Return Ritual (MANDATORY)

Apply the 2 KB `snapshot`, the empty-return fallback, and the conditional return ritual from [gateway-protocol.md](../references/gateway-protocol.md) before any synthesis.

## Acceptance Criteria

- Cite recalled memories with `mem:` refs: every contributing memory in a report/answer appears as `mem:memory-name`, not a bare name.
- Done when: default path uses ≤1 list_memories + ≤2 read_memory typical (3 on miss), top-K reranked at L1 4000c, L2 fetched only for K≤3 verified hits, mem: refs cited, return ritual verified for content answers, and budget target recall+store <=5 gateway calls typical (4 when single candidate).

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when external research supplements recall.
