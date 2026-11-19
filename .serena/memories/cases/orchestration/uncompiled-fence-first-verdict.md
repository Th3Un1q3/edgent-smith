---
id: cases/orchestration/uncompiled-fence-first-verdict
type: cases
L0: "A design-contract TypeScript fence was never compiled, so the first verdict found initializer keys missing against its own write path; no typecheck or probe ran before it."
hotness: 0.8
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
confidence: 0.9
status: active
provenance: "orchestration run 2026-11-15 extending a design-contract document with three new actions; round 1 verdict and the run's own cause statement"
related: mem:cases/orchestration/declared-param-not-threaded-to-write-and-read-sites, mem:cases/orchestration/prose-reachability-unreachable-self-arm
---
# A fence in prose that was never compiled

## Symptom
A design-contract document extended with three new actions shipped a TypeScript fence. The first judge verdict found the context initializer omitted keys the fence's own write path sets, so an entry action would throw at construction and one arm of the action map could never fire.

## False hypothesis
The defect read as a naming slip inside the fence, so the correction was to fix the two key names in the surrounding prose.

## Root cause
The document's TypeScript was never compiled. No typecheck and no probe ran on the fence before the first verdict, so the missing initializer keys were visible only by tracing the constructor against the write path, and neither the producer nor the judge traced it. Prose review checks a fence for shape, never for whether it compiles.

## How confirmed
The run's cause statement records that no typecheck or probe ran before the first verdict, and the verdict names initializer keys against the write path. Read side by side, the initializer cannot carry a key its own write path sets: a defect a compiler reports and unexecuted text hides.

## Prevention
Before the first verdict, extract every fenced block to a file of its declared language and run its compiler (`tsc --noEmit` for TypeScript, an import for Python), then one minimal probe that constructs the initializer and calls the block's stated entry point. Paste the compiler and probe output beside the fence in the report; a fence with no compiler output is `unverified`, never passing.

Related: mem:cases/orchestration/declared-param-not-threaded-to-write-and-read-sites, mem:cases/orchestration/prose-reachability-unreachable-self-arm, mem:cases/orchestration/citation-defects-four-fail-rounds.
