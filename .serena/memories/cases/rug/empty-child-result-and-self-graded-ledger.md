---
id: cases/rug/empty-child-result-and-self-graded-ledger
type: cases
L0: "rug: an ok child with empty outputText is recovered from its transcript by run(); an author's own ledger does not prove compliance."
freshness: 2026-10-23
provenance: ses_e9679aa77ffe2o3fxj18Xbvx9B, ses_e967bc607ffeSZ7HNZx8VmTCqE, ses_e967abeb7ffexyISmAgTIEax2S
---

# Ok-but-empty child results and the author's own ledger

Eight `subtask_run` calls returned `status: ok` with empty `outputText` in one orchestration session; every recovery was manual (list, tail, continue). `.opencode/agents/rug.md` stated the tail-then-resume rule, but the Execution envelope's `run` helper did not implement it, so the rule governed prose only. The helper now runs a `settle` step: for an `ok` result with empty `outputText` and a `task_id`, it reads the child's transcript with `subtask_tail`, keeps the last untruncated non-empty record, and returns it under the same field names before the interruption resume runs. Verification: wrap the fence in an async function and run `node --check`.

A writing child produced a four-cell ledger claiming its lines passed; a validator twice found lines naming none of the four cells. A self-graded ledger is a claim. `.opencode/instructions/writing-instructions.instructions.md` now states that the ledger is applied to the delivered text by a reader who did not write it, and that every cell quotes the exact token that earns it.

Two prompts also capped words while demanding a verbatim quote longer than the cap, and one child was asked for data with no schema. Prompt-side rules from the same run: the quote budget is set outside the word cap, and `data` is not read without a `schema`.