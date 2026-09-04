# Workflow: Manage Memory

Update, merge, rename, or retire existing memories with dedup handling.

When to load: when you edit, reorganize, or clean up memories; when dedup table signals merge/delete.

## Prerequisites

- Activate serena sandbox; read [references/gating.md](../references/gating.md) for dedup table and [references/lifecycle.md](../references/lifecycle.md) for TTL.
- Read [references/frontmatter.md](../references/frontmatter.md) for FM formatting, inferred fallback, and inheritance.

## Tools

- gateway_mcp-find, gateway_code-mode, gateway_mcp-exec, serena read_memory/edit_memory/rename_memory/delete_memory/list_memories

## Steps

1. **Scan full store** — call list_memories({}) with no topic filter before any correction; duplicates hide under near-identical stems (e.g., research/ vs researches/). Done when: complete memory list parsed.
2. **Decide action via dedup table** — compare similarity: >0.9 skip, 0.6-0.9 merge, <0.6 create; >0.9 identical with newer provenance → delete stale. Done when: one of skip/create/merge/delete selected per references/gating.md.
3. **Apply edit with gate** — for edit_memory run blocking gate on updated body; for rename_memory verify Discoverable check only; for delete_memory ensure about remains consistent. Done when: write verified by read-back or about consistent after delete.
4. **Update claim links and inheritance** — patch claim_ids and provenance in frontmatter per [frontmatter.md § What Belongs](../references/frontmatter.md); increment hotness via lifecycle formula; update parent About L0_table when child L0 changes. Done when: claim_ids reflect merged sources and About aggregated.

Gate: rename/delete skip full 9-check gate — still verify single owning check (Discoverable / about-consistent).

## Rename / Delete Invariance

- **Rename:** `rename_memory({old_name, new_name})` preserves `id` update: set new FM `id` == `new_name`, update `directory` to new parent prefix, and patch parent About `L0_table` (remove old L0, insert new L0 sorted, cap 32). Verify read-back echoes new id.
- **Delete:** remove L0 entry from parent About `L0_table`; keep About sorted and capped. Verify About still lists remaining children.
- **Legacy fallback:** if old memory lacked FM, inferred L0 is first body line slice(0,256); on rename, create Typed FM with quoted L0 for the new name. Migration regex for leading space: `body.replace(/^\s+(hotness|ttl|claim_ids|L0):/gm, "$1:")`.

```javascript
function renameInvariance(oldName, newName, oldBody){
  var fm = oldBody.match(/^---\n([\s\S]*?)\n---/);
  var newFm = fm ? fm[1].replace("id: "+oldName, "id: "+newName) : "id: "+newName+"\ntype: entities\nL0: \""+oldBody.split("\n").find(function(l){return l.trim();}).slice(0,256)+"\"";
  // update directory
  var dir = newName.split("/").slice(0,-1).join("/");
  newFm = newFm.replace(/directory:.*/, "directory: "+dir);
  return "---\n"+newFm+"\n---";
}
renameInvariance("entities/person/alice-old","entities/person/alice","# Alice")
// Implements: rename preserves id/directory/L0_table update; legacy inferred fallback
```

## Examples

Full-store scan before correction:

```javascript
var all = JSON.parse(list_memories({}));
var memories = all.memories || [];
// scan all domains — do not scope to named domain
var stale = memories.filter(function(m){ return m.indexOf("cache/fetch")===0; });
stale
```

Dedup merge edit (adjacent example for merge threshold 0.6):

```javascript
function mergeMemories(existing, incoming){
  var body = existing + "\n\n--- merged ---\n\n" + incoming;
  edit_memory({ memory_name: "entities/person/alice", needle: existing.slice(0,20), repl: body, mode: "literal" });
}
// Implements: merge when 0.6 < similarity ≤ 0.9
var sim = 0.75; if (sim > 0.6 && sim <= 0.9) "merge";
```

Rename with Discoverable check:

```javascript
rename_memory({ old_name: "entities/person/alice-old", new_name: "entities/person/alice" });
// Verify about consistent
read_memory({ memory_name: "entities/about" });
```

## Acceptance Criteria

- Done when: full-store scan executed, dedup action applied, about consistent, read-back verified, L0_table updated on rename/delete.

## Related Skills

- Call context-gathering via Skill tool when external source supersedes a memory.
