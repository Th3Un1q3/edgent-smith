---
id: audits/truncation-sites-2026-10-28
title: Truncation audit 2026-10-28 — 19 sites, 2 removed, 3 raises deferred, 14 kept
date: 2026-10-28
L0: "Truncation audit 2026-10-28: 19 clamp sites reviewed; 2 removed (12KB tail clip + truncated flag); 3 description cuts deferred at 80→160 chars; 14 kept (count/TTL/id/log/step/ledger bounds)."
provenance: architecture/adr/ADR-017-prune-plugin-suite-to-hook-core
---

# Truncation audit — 2026-10-28

Scope: every clamp or cut site the workflow plugin applies to subtask output and to its own store, plus the docs that describe them. 19 sites reviewed. Decision recorded into `mem:architecture/adr/ADR-017-prune-plugin-suite-to-hook-core` under "Truncation audit (2026-10-28)"; this memory holds the summary and the rationale.

## Site → decision (19)

| Decision | Sites | What |
|---|---|---|
| Remove | 2 | The 12 KB tail clip `MAX_TAIL_ENTRY_CHARS` (subtask-tail.ts:5) and its `truncated` flag. Ordered by a user TODO on 2026-10-28: entries store the full child output and the orchestrator decides how much to read back. |
| Raise (deferred) | 3 | Description cuts at 80 chars; raising to 160 recommended. Deferred as a separate follow-up, not part of this change. |
| Keep | 14 | Count cap (5 entries), TTL (24 h), 1,000-id store cap, and the log, step and ledger bounds. These bound structure and volume, not content length. |

Totals: 2 + 3 + 14 = 19.

## Why the removals are safe — memory-risk rationale

The tail store no longer caps entry bytes. With the clip and flag gone, bytes are bounded by count × TTL: at most 5 entries per task alive for 24 h, against a 1,000-id ceiling on the store. A direct subtask result is unbounded by design, because the orchestrator, not the plugin, knows how much of a child's output it needs.

Accepted trade-off: a single very large child output can inflate store size and read cost for its 24 h window. Accepted because the count and TTL caps keep total volume bounded, the 1,000-id cap keeps the id table bounded, and the read decision now sits with the consumer. The residual risk is per-entry size, not unbounded growth.

## Kept bounds, and what each protects

- Count (5): bounds entries per task; the primary volume control now that no byte ceiling exists.
- TTL (24 h): bounds how long one large entry can occupy the store.
- 1,000-id cap: bounds the id table independently of payload size.
- Log, step and ledger bounds: diagnostic and progress surfaces, unrelated to the payload path; kept so logs cannot grow without limit.

## Follow-up

- Raise the three 80-char description cuts to 160 chars. Recommended, deferred, and tracked separately so it does not widen this audit's change.

Related: `mem:architecture/adr/ADR-017-prune-plugin-suite-to-hook-core`, `mem:architecture/adr-rules`.
