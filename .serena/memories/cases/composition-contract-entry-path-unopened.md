---
id: cases/composition-contract-entry-path-unopened
type: cases
L0: "Composition contract named the glue entry plugins/state-machine/state-machine.ts; the entry is the sibling file plugins/state-machine.ts. Open an interface path before writing it into a contract, and never derive an entry from its directory name."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine split run; tree re-read in this session 2026-11-19"
claim_ids: []
---

# The composition contract's entry path was never opened

## Symptom
A composition contract for the state-machine split named the glue component's path `.opencode/plugins/state-machine/state-machine.ts`. The real entry is `.opencode/plugins/state-machine.ts` — a file beside that directory, not inside it. The fresh validator returned the path as a finding, and the contract had to be corrected.

## False hypothesis
That a plugin entry follows its directory's naming pattern, `<dir>/<dir-name>.ts`, so `state-machine/` must hold `state-machine/state-machine.ts`. The convention looked obvious, so prediction was treated as a read.

## Root cause
The path entered an interface contract, not a write allowlist, so "open every allowlist path before dispatch" did not apply on its face, and a path in a contract read as descriptive prose rather than an address. Deriving it from the directory's naming pattern put the entry one level too deep: the entry is the sibling file, while the directory holds `core/` and the contract documents.

## How confirmed
`ls .opencode/plugins/` lists both `state-machine` and `state-machine.ts`; `ls .opencode/plugins/state-machine/` lists `core/`, `CONTRACT.md` and `SIGNALS-CONTRACT.md`, with no `state-machine.ts`. The tree was re-read in this session; the validator's finding named the same absent path the contract carried.

## Prevention
Open every path an interface carries — a composition contract's glue entry as much as a write allowlist — before writing it down, and copy it from the tree. An entry point is not derived from its directory: check the sibling file and the directory listing. Related: `mem:cases/guessed-plugin-path` covers the allowlist surface; this case is the contract surface and the naming-pattern derivation.