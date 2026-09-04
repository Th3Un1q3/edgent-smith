# Workflow: Evolve Memory

Promote claims → cases → trajectories → experiences with human gating.

When to load: when you have multiple cases or trajectories sharing a pattern and need to evolve them.

## Prerequisites

- Activate serena sandbox via gateway_code-mode (name + servers) — the same activation used for store/recall; see [workflows/store-memory.md](./store-memory.md) for chain.
- Load [references/claims.md](../references/claims.md) and [references/lifecycle.md](../references/lifecycle.md).

## Tools

- gateway_mcp-find, gateway_code-mode, gateway_mcp-exec, serena list_memories/read_memory/write_memory

## Steps

1. **Verify 3:1 threshold** — list_memories for cases/ or trajectories/; count candidates sharing failure mode or pattern ≥3. Done when: count verified ≥3.
2. **Check score and hotness** — each candidate needs mem: link count ≥3 (score ≥3) and hotness ≥0.35. Done when: all candidates pass both numeric checks.
3. **Human gate** — present candidates to operator; operator confirms dedup, frontmatter, and about update. Done when: operator approves promotion.
4. **Write promoted memory** — create trajectory/ or experience/ with frontmatter provenance covering 3 inputs; update domain about. Done when: new memory verified by read-back and about reflects new scope.

Gate: do not promote without human approval — automated promotion corrupts procedural knowledge.

## Gateway activation note — verify evolve check

If gateway returns no output for the evolution check, the sandbox was not activated correctly. Fix:

- Call gateway_mcp-find to discover serena, then gateway_code-mode with BOTH name and servers in same call, then gateway_mcp-exec.
- Verify counts via `JSON.parse(list_memories({topic:"cases"})).memories.length` or `list_memories({topic:"trajectories"})` inside the exec script.

```javascript
// Verify evolve threshold when outer gateway seemed empty — copy-pasteable
var all = JSON.parse(list_memories({ topic: "cases" })).memories || [];
var grouped = {};
for (var i=0;i<all.length;i++){ var k=all[i].split("/")[1]; grouped[k]=(grouped[k]||0)+1; }
var ready = Object.keys(grouped).filter(function(k){ return grouped[k] >= 3; });
ready.length // check if any pattern hits 3 — Implements: 3:1 verify
```

## Examples

Promotion check with 3:1 ratio:

```javascript
var PROMOTE = 3;
var cases = JSON.parse(list_memories({ topic: "cases" })).memories || [];
var grouped = {};
for (var i=0;i<cases.length;i++){ var k=cases[i].split("/")[1]; grouped[k]=(grouped[k]||0)+1; }
var ready = Object.keys(grouped).filter(function(k){ return grouped[k] >= PROMOTE; });
ready // Implements: 3 cases → 1 trajectory
```

Score and hotness guard (threshold 3 and 0.35):

```javascript
function canPromote(linkCount, hot){
  return linkCount >= 3 && hot >= 0.35;
}
canPromote(4, 0.5) // true — Implements: score ≥3 and hotness ≥0.35
canPromote(2, 0.8) // false — count too low
```

Trajectory write after gate:

```javascript
var body = "---\n" + "id: trajectories/auth-timeout#2026-05-01\n" + "type: trajectories\n" + "provenance: cases/bugfix/auth-timeout-1,cases/bugfix/auth-timeout-2,cases/bugfix/auth-timeout-3\n" + "---\n# Auth trajectory";
write_memory({ memory_name: "trajectories/auth-timeout", content: body });
```

## Acceptance Criteria

- Done when: 3:1 threshold met, score ≥3, hotness ≥0.35, human approved, promoted memory verified.

## Related Skills

- Call harness-management via Skill tool on harness-management/SKILL.md when promotion reveals a recurring failure pattern needing a harness change.
