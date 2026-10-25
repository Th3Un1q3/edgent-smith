---
id: experiences/orchestration/measurement-pass-before-draft-and-pinned-sections
type: experiences
L0: "Arithmetic-credible artifacts start with a measurement pass that prints reconciled totals; delegated reports carry pinned sections under the cap with a named over-cap fallback."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-10-23
directory: experiences/orchestration
confidence: 0.9
status: verified
provenance: RUG orchestration retrospective 2026-10-23; children ses_e9607b77dffe5Xxw55fiD4vMc5, ses_e95f31392ffe4uPVNDaT86kmco, ses_e95e66790ffeELMpDaxdhOmRD3; produced mem:architecture/adr/ADR-017-prune-plugin-suite-to-hook-core
---
# Measurement pass before draft; pinned report sections

## Rule

1. An artifact whose credibility rests on arithmetic (ADR, audit, reconciliation report) is preceded by a measurement pass that prints every total with its addends and the equality that holds, before any drafting prompt is written.
2. A delegation asked for a report names the section order, a character target, and the over-cap fallback in the prompt itself.
3. An audit scope names per-file line ranges and a call budget, plus what may legitimately stay unverified.
4. A validator for such an artifact recomputes every sum with a script and prints the computed value beside the claimed one.
5. An authoring prompt carries the reconciled totals table, not raw prior-audit prose.
6. Every cited path, filename and line range is re-read from the tree at authoring time; audit text is not a source of truth.
7. A measurement or intermediate report that would exceed the result cap is split into a totals table under the cap plus a reference.

## Why

The first draft of the ADR carried 6,680 against a stated 6,772, a phantom test filename, and two stale line ranges copied out of audit text. Three authoring rounds and three validation rounds converged only when a validator was told to recompute the sums with a script. The authoring prompt had forwarded roughly 12,000 characters of audit prose in one pass, and no measurement pass existed until after the first rejection.

## Evidence

Source: orchestrator and child reports from the 2026-10-23 RUG orchestration; observed output, not inference.

- ses_e9607b77dffe5Xxw55fiD4vMc5 emitted 4,023 characters three times against a compact target, unusable twice; the fifth-section inventory was recovered only by a re-emit pinned at 2,400 characters with a fixed section order.
- ses_e95f31392ffe4uPVNDaT86kmco audited four files plus a config plus a types sweep, exhausted its 24-call budget, self-reported partial, and left types/ exports unverified.
- ses_e95e66790ffeELMpDaxdhOmRD3 needed three authoring and three validation rounds; only the scripted-sum validator caught the arithmetic.
- The measurement pass that fixed the draft then exceeded the 4,000-character result cap.

## Use

Request measure-then-draft in that order. Pin section order and target length in every report delegation, and name the fallback. Budget line ranges, not only file counts. Make the validator script the sums. Reject any citation not re-read from the tree.
