# Reference: Progressive Disclosure — L0 / L1 / L2

Load progressively — pay only for detail you need.

When to load: when you recall memories via workflows/recall-memory.md; when budgeting tool outputs.

Vocabulary: disclosure — the L0/L1/L2 tier system that caps how much memory text the model sees; budget — character limit per tier.

## Principles

- **Verify L0 before L1:** scan names/titles (256c) before reading bodies.
- **Cap L1 at 4000c:** structured snapshot for reranking top-K.
- **Guard L2 full fetch:** verbatim body only for verified top-K.

## Budgets — Single Source

See [frontmatter.md § Search Method](./frontmatter.md) for canonical budgets.

L0 example: `"Alice — backend engineer, owns auth"` — 33c, quoted ≤256c.

Legacy noFM (491 files): L0 inferred as first body line slice(0,256) — see [frontmatter.md § FM vs Inferred](./frontmatter.md) `inferredL0()`.

## Mapping to Serena Budgets

- **Verify L0 budget:** treat list_memories names as L0 — scan names only, do not read bodies yet.
- **Adopt L1 cap:** truncate read_memory to 4000c in gateway script; cite full body with mem: refs.
- **Expose L2 guard:** fetch full body only for verified top-K inside gateway_mcp-exec; never return L2 verbatim to model context.

## Examples

L0 budget scan (256c per memory):

```javascript
var raw = list_memories({ topic: "entities" });
var names = JSON.parse(raw).memories || [];
var l0 = names.map(function(n){ return n.slice(0,256); }); // Implements: 256c L0
l0.slice(0,32).join("\n"); // sample 32
```

L1 cap with truncation (4000c):

```javascript
function readL1(name){
  var raw = read_memory({ memory_name: name });
  return raw.slice(0, 4000); // Implements: 4000c L1 cap
}
readL1("entities/person/alice")
```

L2 guard — only top-K, with excerpt budget 700c:

```javascript
function readL2(name, isTopK){
  if(!isTopK) throw new Error("L2 requires verified top-K");
  var full = read_memory({ memory_name: name });
  return { full: full, excerpt: full.slice(0, 700) }; // Implements: Full vs 700c excerpt
}
readL2("entities/person/alice", true)
```

Budget helper (2 KB tool return cap):

```javascript
function budgetSlice(text, limit){ limit=limit||2048; return text.length>limit? text.slice(0,limit)+"...[truncated]" : text; }
budgetSlice(read_memory({ memory_name: "claims/alice-role" }), 2048) // Implements: ≤2KB snapshot
```

## Acceptance Criteria

- Done when: L0 ≤256c scanned, L1 ≤4000c reranked, L2 only for top-K with ≤700c excerpt returned to model.

## Related Skills

- Call context-gathering via Skill tool when disclosure applies to external cache budgets.
