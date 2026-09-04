# Workflow: Store Memory

Persist a typed, gated memory through the Serena gateway.

When to load: when you create or overwrite a persistent memory via write_memory.

## Store Checklist — 80% case in one place

Use this checklist for every store; details live in linked refs.

- [ ] Typed scope assigned from 9 types — see [references/typing.md](../references/typing.md) (profile, preferences, entities, events, cases, trajectories, experiences, claims, cache)
- [ ] Disclosure budgets loaded — L0 256c / L1 4000c / L2 full with 700c excerpt, 2 KB tool cap — see [references/frontmatter.md](../references/frontmatter.md) and [references/disclosure.md](../references/disclosure.md)
- [ ] Gate 9 checks pass — Standalone, Verified, Typed, Discoverable, Non-duplicate, Grounded, Minimal, Fresh, Disclosed — see [references/gating.md](../references/gating.md)
- [ ] Dedup decided — >0.9 skip, 0.6–0.9 merge, <0.6 create — via [references/gating.md](../references/gating.md)
- [ ] TTL set per type — events 30d, cache 7d, claims 60d, profile/preferences 90d, cases/trajectories/experiences 180d — see [references/lifecycle.md](../references/lifecycle.md)
- [ ] Staleness checked — age>30d && hot<0.3 or superseded/disputed — see [references/claims.md](../references/claims.md)
- [ ] Order: Type → Gate (includes disclosure check) → Write/verify

If any box fails, stop — do not call write_memory.

## Prerequisites

- Discover serena via gateway_mcp-find; activate sandbox with gateway_code-mode (name + servers).
- Read [references/typing.md](../references/typing.md) to choose scope and [references/gating.md](../references/gating.md) to run gate.
- Load disclosure budgets from [references/frontmatter.md](../references/frontmatter.md) § Search Method (L0 256c / L1 4000c / 700c excerpt) and [references/disclosure.md](../references/disclosure.md).

## Tools

- gateway_mcp-find, gateway_code-mode, gateway_mcp-exec, serena list_memories/read_memory/write_memory

## Steps

1. **Route through gateway** — chain gateway_mcp-find → gateway_code-mode → gateway_mcp-exec; never read .serena/memories on disk. Done when: sandbox active with serena server and script can call list_memories.
2. **Type before gating** — assign one of 9 typed scopes (profile/preferences/entities/events/cases/trajectories/experiences/claims/cache). Done when: memory name carries typed prefix and frontmatter type matches.
3. **Run blocking gate** — verify all 9 checks in [references/gating.md](../references/gating.md) inside gateway_mcp-exec script; Disclosed check verifies quoted L0 per [frontmatter.md § Formatting](../references/frontmatter.md) or inferred fallback for legacy. Done when: every check passes or you skip the write and report DEDUP_SKIP.
4. **Write and verify** — build FM via normalizeFM, include quoted L0 ≤256c, strip leading space, call write_memory, then read_memory to confirm echo. Guard every gateway_mcp-exec return with `if (!raw || raw.trim()==="" || /Access denied|No such file/.test(raw)) throw new Error("empty gateway return → retry")` and cap output via `snapshot(raw)` 2KB; capture stderr via same guard (see SKILL gateway pre-flight GOOD/BAD). Done when: read-back content equals written content and L0 present.
5. **Verify 3-script gate locally** — run `python3 agent_utils/scripts/validate_memory_frontmatter.py --path .serena/memories`, `python3 agent_utils/scripts/validate_md_links.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills`, `python3 agent_utils/scripts/audit_fences.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills` or `just agent_utils::validate-memories`; declare complete only after all three exit 0.

Gate: if any gate check fails, stop — do not call write_memory. If any script fails, stop — do not declare complete.

## Examples

Store a typed entity memory with normalizeFM and quoted L0:

```javascript
// gateway_mcp-exec script — store with gate already passed
function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
function normalizeFM(fm){
  return fm.split("\n").map(function(l){ return l.trimEnd(); })
    .map(function(l){ return l.replace(/^\s+/, ""); }).join("\n");
}
var fm = normalizeFM("---\nid: entities/person/alice\ntype: entities\nL0: \"Alice — backend eng, team X\"\nhotness: 0.72\nttl: 30d\nclaim_ids: [claims/alice-role]\n---");
var body = fm + "\n# Alice\nBackend engineer, owns auth service. Source: events/2026-05-01-interview.";
// formatting validation before write
if(/^ /m.test(fm)) throw new Error("leading space in FM");
if(/ $/m.test(fm)) throw new Error("trailing space in FM");
if(!/L0: \".*\"/.test(fm)) throw new Error("L0 not quoted");
var res = write_memory({ memory_name: "entities/person/alice", content: body });
if (!res || String(res).trim()==="" || /Access denied|No such file/.test(String(res))) throw new Error("empty gateway return → retry");
var raw = read_memory({ memory_name: "entities/person/alice" });
if (!raw || raw.trim()==="" || /Access denied|No such file/.test(raw)) throw new Error("empty gateway return → retry");
if (raw.indexOf("Alice") < 0) throw new Error("verify failed: " + snapshot(raw));
snapshot(String(res))
// Implements: normalizeFM + quoted L0 ≤256c + no leading/trailing space + snapshot 2KB cap + empty guard (capture_stderr)
```

Count-based dedup decision (inside gate):

```javascript
function dedupAction(existingCount, similarity){
  if (existingCount === 0) return "create";
  if (similarity > 0.9) return "skip";
  if (similarity > 0.6) return "merge";
  return "create";
}
// Implements: dedup table skip/create/merge per references/gating.md
```

## Clarification Triggers

Ask before proceeding if:
- Memory scope ambiguous between two typed domains (e.g., entities vs preferences)
- Claim evidence missing or confidence below 0.6

## Acceptance Criteria

- Done when: gateway chain executed, typed scope assigned, gate passes, write verified by read-back echo.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when research precedes the write.
