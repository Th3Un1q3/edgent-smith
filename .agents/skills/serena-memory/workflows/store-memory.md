# Workflow: Store Memory

Persist a typed, gated memory through the Serena gateway.

When to load: when you create or overwrite a persistent memory via write_memory.

## Store Checklist — 80% case in one place

Use this checklist for every store; details live in linked refs.

- [ ] Typed scope assigned from 9 types — see [references/typing.md](../references/typing.md) (profile, preferences, entities, events, cases, trajectories, experiences, claims, cache)
- [ ] Disclosure budgets loaded — L0 256c / L1 4000c / L2 full with 700c excerpt, 2 KB tool cap — see [references/disclosure.md](../references/disclosure.md)
- [ ] Gate 9 checks pass — Standalone, Verified, Typed, Discoverable, Non-duplicate, Grounded, Minimal, Fresh, Disclosed — see [references/gating.md](../references/gating.md)
- [ ] Dedup decided — see [references/gating.md](../references/gating.md) §Dedup
- [ ] TTL set per type — events 30d, cache 7d, claims 60d, profile/preferences 90d, cases/trajectories/experiences 180d — see [references/lifecycle.md](../references/lifecycle.md)
- [ ] Staleness checked — age>30d && hot<0.3 or superseded/disputed — see [references/claims.md](../references/claims.md)
- [ ] Order: Type → Gate (includes disclosure check) → Write/verify

If any box fails, stop — do not call write_memory.

## Prerequisites

- Call `tools.gateway["list_memories"]({})` directly; no discovery or sandbox setup.
- Read [references/typing.md](../references/typing.md) to choose scope and [references/frontmatter.md](../references/frontmatter.md) § Search Method for disclosure budgets (L0 256c / L1 4000c / 700c excerpt).
- Optional (checklist links): [references/gating.md](../references/gating.md) for the 9-check gate, [references/disclosure.md](../references/disclosure.md) for L0/L1/L2 budgets, [references/gateway-protocol.md](../references/gateway-protocol.md) for snapshot/empty-return/return ritual.

## Tools

- gateway list_memories/read_memory/write_memory

## 9-Check Gate (summary; single source: gating.md)

- Standalone — memory is self-contained; no dangling refs.
- Verified — claims backed by source evidence.
- Typed — domain prefix matches one of 9 types.
- Discoverable — name/findable via prefix or about table.
- Non-duplicate — dedup decision applied (skip/merge/create).
- Grounded — content traces to a source.
- Minimal — no redundant content.
- Fresh — TTL/staleness within policy.
- Disclosed — L0/L1/L2 budgets respected.

Full criteria: [references/gating.md](../references/gating.md).

## Freshness & Hotness (inline)

No separate reference read is required for these two fields.

- freshness = today YYYY-MM-DD.
- hotness per lifecycle formula: `sigmoid(log1p(active_count)) * exp(-ln2/7 * age_days)` (half-life 7 days); active_count = number of `mem:` refs.

## Steps

1. **Route through gateway** — call `tools.gateway["list_memories"]` / `["read_memory"]` / `["write_memory"]` directly; never read .serena/memories on disk. Done when: `list_memories` returns the store.
2. **Type before gating** — assign one of 9 typed scopes (profile/preferences/entities/events/cases/trajectories/experiences/claims/cache). Done when: memory name carries typed prefix and frontmatter type matches.
3. **Re-run full 9-check gate after scope decision** — typed prefix first, then all 9 checks (Standalone, Verified, Typed, Discoverable, Non-duplicate, Grounded, Minimal, Fresh, Disclosed) before write. Done when: every check passes or you skip the write.
4. **Dedup check** — `list_memories({topic:"<domain>"})`; if empty, create. Done when: existing names inspected or empty confirmed.
5. **Run blocking gate** — verify all 9 checks in [references/gating.md](../references/gating.md) with direct gateway calls. Done when: every check passes or you skip the write and report DEDUP_SKIP.
6. **Write and verify** — build FM with `normalizeFM` (defined in the example below), include quoted L0 ≤256c per [references/disclosure.md](../references/disclosure.md), strip leading space, call write_memory. Guard every return with the snapshot + empty-return fallback in [references/gateway-protocol.md](../references/gateway-protocol.md). Done when: write_memory returns.
7. **Update parent about** — after a successful write, if a parent `*/about` exists, edit_memory its L0_table to add this child's L0 (or flag for review if edit unavailable). Done when: parent about updated or flagged.
8. **Read-back verification (HARD GATE)** — read_memory after write; compare echo; on empty return, `bash cat .serena/memories/<id>.md` fallback once where direct reads are permitted. Done when: read-back content equals written content and L0 present.
9. **Optional local verification** — scripts are optional verification; gate passes on 9 checks. The 9-check gate above is sufficient to declare complete. If available, run `python3 agent_utils/scripts/validate_memory_frontmatter.py --path .serena/memories`, `python3 agent_utils/scripts/validate_md_links.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills`, and `python3 agent_utils/scripts/audit_fences.py .agents/skills/serena-memory .agents/skills/context-gathering .agents/skills/building-modular-skills` (or `just agent_utils::validate-memories`) as a bonus check; a missing script is not a failure.

Gate: if any gate check fails, stop — do not call write_memory. If any script that runs fails, stop — do not declare complete; a missing script is not a failure.

## Examples

Store a typed entity memory with normalizeFM and quoted L0:

```javascript
// store helpers — gate already passed
// gateway guard: 2 KB cap + empty/stderr detection (infra flake -> bash cat, 0 retries)
function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
function gatewayEmpty(raw){ return !raw || raw.trim() == "" || /Access denied|No such file/.test(raw) || raw.indexOf("content:[]")>=0; }
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
// gateway guard: stop on empty/stderr return; fall back once to the filesystem, 0 retries
var raw = read_memory({ memory_name: "entities/person/alice" });
if (gatewayEmpty(raw) || raw.indexOf("Alice") < 0) throw new Error("verify failed - bash cat .serena/memories/entities/person/alice.md: " + snapshot(raw));
snapshot(String(res))
// Implements: normalizeFM + quoted L0 ≤256c + no leading/trailing space + snapshot 2KB cap
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
