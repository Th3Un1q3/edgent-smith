---
type: experiences
status: active
confidence: high
provenance: 2026-10-23 harness analysis of a delegated ADR inventory; the child exhausted its budget on format discovery and needed a resume
---

# Convention discovery must precede the prompt

## Rule

A delegation prompt must not assert an artifact's template or location. Give the child a bounded discovery step (roughly 10% of its budget) that finds the authoritative rules file, quotes it, and returns the path. Only then does the prompt name sections or a home directory.

## Failure this prevents

A prompt asserted a generic ADR skeleton (Context / Decision / Consequences) and derived the ADR home from a `docs/plan/` folder name. In this repo the authoritative `architecture/adr-rules` puts Decision first and requires Options considered plus a Scoring table, and ADRs live in Serena under `architecture/adr/`. The child found the mismatch only after spending most of its budget, then needed a resume to finish.

The same prompt also carried a "reuse or extend" rule alongside "four distinct homes"; with no exact match, the child could not tell which constraint won. State the tie-break with the discovery criterion.

## Test before dispatching

- Does the prompt name a template section that no repo file shows?
- Does it name a home derived from a filename or folder name?
- If yes to either, replace the assertion with a discovery criterion plus a required quoted citation.

## Evidence

2026-10-23 delegated ADR inventory, one child, one resume.
