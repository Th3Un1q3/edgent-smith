---
id: cases/opencode/homebrew-persistence-vs-library-snapshot
type: cases
L0: "A persistence layer (field allowlist, copier map, dotted-path converter, restore registry) was replaced by XState's persisted snapshot plus one context boundary; the mapping only reconstructed what the library already stores."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-20
directory: cases/opencode
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; incident details recorded as reported, source tree not re-read in this session (UNVERIFIED as to file paths)"
related: mem:cases/opencode/state-machine-snapshot-read-during-init
claim_ids: []
---
# A hand-written mapping layer where the library had a persisted snapshot
## Symptom
Persistence was built from four moving parts: a field allowlist saying what to save, a copier map saying where each field goes, a dotted-path converter for nested keys, and a restore registry saying how each field comes back. Every context change required editing several of them, and a missed entry silently dropped state on reload.
## False hypothesis
That the machine's context is bespoke enough that the library cannot persist it, so the fields must be enumerated by hand, nested paths converted, and restorers registered per field.
## Root cause
The layer existed to reconstruct what the library already keeps. XState's persisted snapshot restores state and context wholesale; the only real design question is the context boundary, that is, what must stay serializable. Enumerating fields answered a question nobody had asked and created four places to forget.
## How confirmed
Replacing the four-part layer with the persisted snapshot plus one explicit context boundary restored a round trip correctly, with no allowlist, copier map, dotted-path converter or restore registry left to maintain.
## Prevention
Read the persistence API of the library before writing any serializer. If a mapping layer starts to appear, treat it as evidence of a missing context boundary, not as a reason for more maps; one boundary plus the native snapshot is the default. Source: reported retrospective, 2026-11 state-machine run (UNVERIFIED paths).