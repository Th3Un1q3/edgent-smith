---
id: cases/absence-claim-from-scoped-grep
type: cases
scope: cases — a single failure (wrong negative claim) plus its fix; not a claim about the API itself
L0: "Absence claim from grep over one package; capability lived in a sibling package"
provenance: orchestrator incident, negative emit/publish claim, corrected 2026-11-11
confidence: 0.9
hotness: 1.0
ttl: 90d
claim_ids: []
---

# Case: negative claim built from a scoped grep

## Symptom

An orchestrator reported "no emit/publish exists" in the OpenCode plugin API, and downstream design assumed plugins could not publish events at all.

## False hypothesis

The evidence was `grep -cE '\bemit\b|\bpublish\b'` over `client/dist/**/*.d.ts`, which returned 0. The zero was read as "the capability does not exist".

## Root cause

Two errors, either of which alone invalidates the claim:

1. **Scope.** The search covered one package. The real capability lives in `@opencode/plugin`'s `RpcRegistration.events.emit` (`dist/promise/rpc.d.ts:12-16`), which the searched tree never contained.
2. **Unreliable count.** A single prose hit in `client/dist/pty-handoff.d.ts:4` ("Publish the ticket…") contradicts the 0, so the count itself was not trustworthy — the pattern matched prose, not declarations.

## How confirmed

A fresh judge re-ran the search across every sibling package surface and read the prosaic hits. The corrected answer distinguishes "a plugin may publish its own RPC events, surfaced as `rpc.*`" from "nothing may publish a domain event". Corrections verified in mem:opencode/native-event-system-surface.

## Prevention

An absence claim must sweep every sibling package surface and the prosaic hits, and must be stated as the narrowest true form ("no X on surface S") rather than a global negative. Treat a grep count of 0 as unproven until the pattern is confirmed to match the construct being denied.
