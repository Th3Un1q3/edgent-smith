# Reference: Ambiguity — Conflicting Memories Without Explicit Pointer

Handle memories that contradict or overlap when no explicit conflict pointer exists.

When to load: when recall or dedup surfaces same-subject/contradictory facts without an explicit conflict link; before workflows/manage-memory.md dedup decision.

Vocabulary: ambiguity — same subject with contradictory facts and no explicit conflict pointer; supersession — replacing an active claim with a higher-confidence one while retaining the old for audit.

## Detection

Per-scope scan for same subject with contradictory facts; no pointer needed. Compare subjects and facts across the relevant scope; flag pairs whose subjects match and facts conflict.

```javascript
function conflict(a, b){ return a.subject===b.subject && a.fact!==b.fact; }
```

## Conflicts found during recall

Recall surfaces contradictions; resolution is a write, not a preference.

- **(a) Scan** across scopes and types for memories naming the same subject with contradictory facts — a neighbour in another scope still counts.
- **(b) Compare** freshness, hotness, confidence, and evidence quality for each side.
- **(c) Present** both values and state which is more trustworthy and why.
- **(d) Write** cross-references between the pair: new `active` with `supersedes: <old-id>`, old `superseded` with `superseded-by: <new-id>`; when the comparison is inconclusive, mark BOTH `disputed`.
- **(e) Never** silently pick one, and never answer from an unlinked pair.

Worked example — `claims/service-x-region-old` (us-east-1, freshness 2024-01-01, confidence 0.9) vs `claims/service-x-region-new` (eu-west-1, freshness 2026-09-01, confidence 0.95): present both, prefer the fresher higher-confidence side, then write the link in the same turn.

## Similarity / Conflict Thresholds

Reuse dedup table (references/gating.md). Conflict = contradictory overlap on the same subject.

| Condition | Similarity | Action |
|---|---|---|
| No existing memory on topic | — | Create |
| Near-identical, same provenance | >0.9 | Skip |
| Overlap, complementary detail | 0.6–0.9 | Merge |
| Contradictory overlap, same subject | 0.6–0.9 | Ambiguity (see Resolution) |
| Identical but stale vs fresh | >0.9 | Retire stale (status stale), keep fresh; delete only exact duplicates |

## Resolution Policy

- **High-confidence supersession:** when one side has clearly higher confidence (≥0.8 and ≥0.2 above the other) → old status `superseded` with `superseded-by: <new-id>`; new stays `active` with `supersedes: <old-id>`; keep old for audit.
- **Uncertain:** confidence within 0.2 or both <0.8 → both status `disputed`, human gate, no merge, no propagation.
- **Complementary overlap:** merge per dedup table (0.6–0.9) into existing; keep provenance of both.

## Resolution invariants

Every resolution below is a two-sided write; one side alone leaves an ambiguous state.

- **Supersede:** old status `superseded`, new status `active`, provenance links new → old (`supersedes: <old-id>`).
- **Uncertain:** BOTH old and new status `disputed`, human gate required, NEITHER `active`.
- **Forbidden:** leaving the old `active` while marking only the new `disputed` (asymmetric state).
- **Forbidden:** new `active` while old remains `active` (ambiguous duplication).
- Every conflict resolution writes provenance naming the other memory. Detection without one of these writes is incomplete: record the supersede or both-disputed transition with edit_memory/write_memory.

## Prevention of Spread

Only active claims with confidence ≥0.6 are eligible for evolution. Disputed/superseded claims are excluded. Dependent trajectories/experiences are flagged for review, never auto-updated.

- `canEvolve` requires status `active` and conf ≥0.6.
- On marking a claim `disputed`/`superseded`, flag (do not edit) dependent trajectories/experiences for human review.

## Recall Under Ambiguity

Present both memories with status + confidence; do not collapse. Cite provenance for each. Prefer `active` over `superseded`; flag `disputed`. Never silently pick one.

## About-Table Marking

Prefix L0_table entries for ambiguous claims: `[disputed]` or `[superseded]` before the L0 summary. Example: `claims/alice-role: [disputed] Alice is backend engineer`.

## Acceptance Criteria

- Done when: conflicting pair detected, resolution applied per policy, dependents flagged (not auto-updated), recall presents both with provenance.

## Related Skills

- See [references/claims.md](./claims.md) for claim status and confidence.
- See [references/gating.md](./gating.md) for dedup table.
