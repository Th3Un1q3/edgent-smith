# Reference: Blocking Gate — 9 Checks

Run every check before any write_memory or edit_memory; stop if any box unchecked.

When to load: before every write_memory or edit_memory via workflows/store-memory.md; keep open while gating.

Vocabulary: gate — the 9-check blocking gate that guards every persistent write; dedup — duplicate detection that decides skip/create/merge/delete.

## The Blocking Gate (9 checks)

Run before any write_memory or edit_memory — every content write or edit including rewrites and appends. For a batch, run gate once on planned set, then verify set. rename_memory and delete_memory skip full gate: rename still passes Discoverable, delete leaves about consistent.

- [ ] **Standalone** — reader with no session context can use it. No "in this session...", "today we...". Fix: rewrite as knowledge with evidence.
- [ ] **Verified** — every claim names source (docs, operator, observed output) or marked UNVERIFIED. Fix: check docs/operator/output or mark.
- [ ] **Typed** — typed scope from [references/typing.md](./typing.md) assigned; type field matches prefix. If `serena/*`, `cache/*`, `researches/*` (synthesis), `private/*`, `browser-automation/*` → skip Typed check (untyped but not error). Fix: assign one of 9 types or mark exempt.
- [ ] **Discoverable** — self-describing hierarchical name (domain/subdomain/topic). Fix: rename to descriptive path.
- [ ] **Non-duplicate** — not duplicate within domain; dedup table decides skip/merge. Fix: apply dedup table below.
- [ ] **Grounded** — mem: refs cite sources; provenance field present. Fix: add provenance and mem: links.
- [ ] **Minimal** — no speculative content beyond evidence. Fix: cut speculation.
- [ ] **Fresh** — confidence ≥0.6 and staleness checked via [references/claims.md](./claims.md). Fix: refresh claim or mark low confidence.
- [ ] **Disclosed** — L0 quoted ≤256c in FM per [frontmatter.md § Formatting](./frontmatter.md) or inferred fallback for legacy; single source for L0/L1 is [frontmatter.md § Search Method](./frontmatter.md). Exempt `serena/*`, `cache/*`, `researches/*` (synthesis), `private/*`, `browser-automation/*` → skip Disclosed check. Fix: add quoted L0 or use inferredL0 slice(0,256).

> Budgets: See [frontmatter.md § Search Method](./frontmatter.md) for canonical budgets. Gate verifies presence only; exempt patterns skip Disclosed per [references/typing.md](./typing.md).

## Dedup Decision Table

| Condition | Similarity | Action |
|---|---|---|
| No existing memory on topic | — | Create |
| Near-identical, same provenance | >0.9 | Skip (DEDUP_SKIP) |
| Overlap, complementary detail | 0.6–0.9 | Merge into existing |
| Identical but stale vs fresh | >0.9 | Delete stale, keep fresh |

## Examples

Gate script inside gateway_mcp-exec (9 checks, copy-pasteable):

```javascript
function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
function gate(memory, fm){
  var exempt = /^(serena|cache|researches|private|browser-automation)\//.test(memory);
  var checks={
    standalone: memory.indexOf("in this session")<0,
    verified: memory.indexOf("Source:")>=0 || memory.indexOf("UNVERIFIED")>=0,
    typed: exempt || /^(profile|preferences|entities|events|cases|trajectories|experiences|claims|cache)\//.test(memory),
    discoverable: memory.split("/").length>=2,
    nonDuplicate: true, // check via dedup table
    grounded: memory.indexOf("mem:")>=0 || memory.indexOf("provenance:")>=0,
    minimal: memory.length < 4000,
    fresh: true, // check via claims.md
    disclosed: exempt || fm && fm.L0 && fm.L0.length<=256 || fm===null // inferred fallback for legacy; exempt skips
  };
  var failed=Object.keys(checks).filter(function(k){return !checks[k];});
  if(failed.length>0) throw new Error("gate failed: "+failed.join(","));
  return "pass";
}
// guard every gateway_mcp-exec return — empty + stderr capture + 2KB cap
var raw = list_memories({ topic: "entities" });
if (!raw || raw.trim()==="" || /Access denied|No such file/.test(raw)) throw new Error("empty gateway return → retry");
snapshot(raw)
// Implements: 9-check blocking gate with Disclosed quoted L0 or inferred fallback + snapshot 2KB cap + empty guard (capture_stderr)
```

Dedup table usage (numeric thresholds 0.9 and 0.6):

```javascript
function dedup(similarity, exists){
  if(!exists) return "create";
  if(similarity > 0.9) return "skip";
  if(similarity > 0.6) return "merge";
  return "create";
}
dedup(0.95, true) // skip — Implements: >0.9 skip
 dedup(0.75, true) // merge — Implements: 0.6–0.9 merge
```

## Local Verification — 3-script gate

Canonical scripts live in `agent_utils/scripts` only — skill copy `.agents/skills/serena-memory/scripts/validate_memory_frontmatter.py` deleted; run before declaring complete:

```bash
python3 agent_utils/scripts/validate_memory_frontmatter.py --path .serena/memories
python3 agent_utils/scripts/validate_md_links.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills
python3 agent_utils/scripts/audit_fences.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills
# or
just agent_utils::validate-memories
```

Stop when any script fails; declare complete only after all three exit 0.

## Acceptance Criteria

- Done when: all 9 checks pass, dedup action selected, and gate result recorded before write_memory; all three local scripts exit 0.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when verification needs external docs.
