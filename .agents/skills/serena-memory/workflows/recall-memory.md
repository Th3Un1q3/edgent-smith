# Workflow: Recall Memory

> Shaping exemption: canonical spec / snippet library — single source per Rule19/Rule24, split would duplicate truth. Flag threshold 250, not 120.

Retrieve memories with progressive disclosure L0→L1→L2 via Serena gateway.

When to load: when you list, search, or read persistent memories to answer or ground a task.

## Pagination — handle truncation first

`list_memories` truncates without pagination. Handle it at the top of every recall:

- Chunk with `slice(0,32)` or topic prefix filter `list_memories({topic:"prefix"})`.
- Prefix does exact prefix match on memory name (see [references/typing.md](../references/typing.md)).

```javascript
// Chunked filtering — copy-pasteable, handles truncation
var raw = list_memories({ topic: "entities" }); // prefix filter
var parsed = JSON.parse(raw);
var all = parsed.memories || [];
all.sort();
var page = all.slice(0, 32); // first page — Implements: 32-sample + prefix
page.join("\n");
```

If you need the full store, call `list_memories({})` then sort and slice 32. Never assume one call returns all.

## Prerequisites

- Activate serena sandbox via gateway_mcp-find → gateway_code-mode.
- Load [references/frontmatter.md](../references/frontmatter.md) § Search Method for Q1/Q2/Q3 and budgets; [references/disclosure.md](../references/disclosure.md) for budgets; [references/typing.md](../references/typing.md) for scope filters.
- Guard every gateway return: `if (!raw||raw.trim()===""||/Access denied/.test(raw)) throw new Error("empty gateway return → retry")` + 2KB cap `function snapshot(s){return s.length>2048?s.slice(0,2048)+"\n[...truncated]":s}`

## Tools

- gateway_mcp-find, gateway_code-mode, gateway_mcp-exec, serena list_memories/read_memory

## Topic Prefix Semantics

`list_memories({topic:"prefix"})` matches memory names with that prefix. `topic:"about"` returns all `*/about` (every domain's about) — prefix match on `about` suffix via About tables. Use it for scoped recall; Q1 scans About tables first via `topic:"about"`. See [references/typing.md](../references/typing.md) and [frontmatter.md § Search Method](../references/frontmatter.md).

// BAD: topic:"automa" → 0 (prefix != substring); GOOD: topic:"browser-automation"

## Steps

1. **List with L0 scan** — call list_memories, treat names as L0 256c summaries; do not read bodies yet. Done when: you have parsed .memories array and filtered by typed prefix or topic.
2. **Rerank top-K at L1** — read_memory truncated to 4000c for candidates; score with hybrid 0.6*BM25+0.1*hotness (vector 0 when absent) and threshold 0.35. When BM25/hotness not returned by Serena, fallback to exact-name match or alphabetical and bypass 0.35 threshold for exact matches — see fallback below. Done when: ranked list of K≤5 candidates with final >0.35 or exact match.
3. **Fetch L2 for execution** — read full body only for top-K verified candidates; inject mem: refs into context. Done when: full bodies available for synthesis and cited.

Gate: never fetch L2 for the entire store — cap L2 reads to top-K (default 3).

## Search Method — Q1 / Q2 / Q3

Use Q1/Q2/Q3 snippets from [frontmatter.md § Search Method](../references/frontmatter.md) — About tables first, prefix scan fallback, budgets 256c/4000c/700c.

### Q1 — Search by L0 via About tables

```javascript
function searchByL0(query){
  var abouts = JSON.parse(list_memories({topic:"about"})).memories || [];
  for(var i=0;i<abouts.length;i++){
    var body = read_memory({memory_name: abouts[i]});
    if(body.indexOf(query)>=0) return abouts[i];
  }
  var all = JSON.parse(list_memories({})).memories || [];
  return all.filter(function(m){ return m.indexOf(query)>=0; }).slice(0,32);
}
searchByL0("backend")
// Implements: Q1 index-first via about
```

Experiences aggregate 3 trajectories → hint describes experience content, not its topic prefix

### Q2 — Summary L0 per Scope via About

```javascript
function scopeSummary(scope){
  var body = read_memory({memory_name: scope + "/about"});
  var fm = body.match(/^---\n([\s\S]*?)\n---/);
  return fm ? fm[1].slice(0,4000) : body.slice(0,4000);
}
scopeSummary("entities")
// Implements: Q2 L0 summary per scope
```

### Q3 — Fetch All L1s via Topic Prefix

```javascript
function fetchL1s(topic){
  var names = JSON.parse(list_memories({topic: topic})).memories || [];
  names.sort();
  return names.slice(0,32).map(function(n){
    var full = read_memory({memory_name: n});
    return {name:n, l1:full.slice(0,4000), excerpt:full.slice(0,700)};
  });
}
fetchL1s("entities/person")
// Implements: Q3 topic prefix slice 4000c/700c
```

## Hybrid Scoring Fallback — when BM25/hotness missing

Serena may not return BM25 or hotness. Apply this operational fallback:

- If no scores returned, rank by exact name match first, then alphabetical.
- Do not enforce 0.35 threshold for exact prefix matches.
- For rerank, treat missing hot as 0 and vec as 0.

```javascript
function hybridScore(bm25, hot, backlinks){
  var vec = 0; // no embedding yet
  var s = 0.6*bm25 + 0.3*vec + 0.1*hot;
  var boost = 1 + 0.05*Math.log(1 + (backlinks||0));
  return s * boost;
}
// Fallback when scores absent — exact name wins
function fallbackRank(memories, query){
  var exact = memories.filter(function(m){ return m===query; });
  if(exact.length) return exact;
  memories.sort();
  return memories.slice(0,5);
}
// Implements: fallback to exact/alphabetical, bypass 0.35 for exact
```

## Examples

List and scan at L0 budget:

```javascript
var raw = list_memories({ topic: "entities" });
var parsed = JSON.parse(raw);
var memories = parsed.memories || [];
// L0 — names only, ≤256c each
var candidates = memories.filter(function(m){ return m.indexOf("entities/person")===0; });
candidates.slice(0, 32).join("\n"); // sample 32 deterministically
```

Rerank at L1 with budget guard:

```javascript
var read = read_memory({ memory_name: "entities/person/alice" });
var l1 = read.slice(0, 4000); // L1 cap — Implements: 4000c budget
if (hybridScore(0.8, 0.72, 2) <= 0.35) "discard";
```

L2 guarded fetch:

```javascript
// Only for verified top-K
var full = read_memory({ memory_name: "entities/person/alice" });
// keep header + excerpt ≤700c for model context
var excerpt = full.slice(0, 700);
excerpt
```

## Gateway Health-Check Guard + Return Ritual (MANDATORY)

Snapshot 2 KB before every gateway call; enforce list_memories → read_memory before responding.

```javascript
function snapshot(s){ return s.length>2048 ? s.slice(0,2048)+"\n[...truncated]" : s; }
// Before gateway_mcp-exec:
var snap = snapshot(JSON.stringify(parsed.memories || []).slice(0,2048));
var res = gateway_mcp_exec({tool:"list_memories", args:{topic:"cache"}});
if(!res || !res.content || res.content.length===0 || /Access denied/.test(String(res))){
  // 0 retries — immediate bash fallback
  var fallback = bash("cat .serena/memories/cache/github/edgent-smith/actions/runs-failed-2026-09-04.md | head -c 2048");
}
// Return ritual — gate fails if missing:
var ids = JSON.parse(res).memories || [];
if(ids.length===0) throw new Error("list_memories empty → fallback already taken");
var payload = read_memory({memory_name: ids[0]}); // verify 1765c before synthesis
if(!payload || payload.trim()==="") throw new Error("read_memory empty → use bash cat fallback");
```

Rules:
- Every `list_memories` must be followed by `read_memory({memory_name: ids[0]})` before you answer; responding from names alone fails the gate.
- Snapshot 2 KB first; on empty `content:[]` fall back to `bash cat .serena/memories/<id>.md` with 0 gateway retries.

## Acceptance Criteria

- Done when: L0 scan complete, top-K reranked at L1 4000c, L2 fetched only for K≤5 verified hits, mem: refs cited, and return ritual verified (`read_memory` payload cited, not just `list_memories` names).

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when external research supplements recall.
- See .opencode/instructions/serena-gateway.instructions.md for the global health-check guard.
