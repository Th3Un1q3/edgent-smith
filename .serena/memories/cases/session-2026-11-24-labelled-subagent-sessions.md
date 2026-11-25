---
id: cases/session-2026-11-24-labelled-subagent-sessions
type: cases
status: active
date: 2026-11-24
scope: orchestration
directory: cases
hotness: 0.6
ttl: 180d
version: 2
freshness: 2026-11-24
confidence: 0.9
claim_ids: []
L0: "Lessons: a child's report is its last action and its budget is counted in units; enumerate and check from the artifact that runs; a lock narrower than the document it replaces loses writes."
provenance: "Run record of the 2026-11-24 labelled-subagent-sessions delivery: ADR-024 accepted, stories US_09-US_12, four plugin slices, a fix round after a stricter verifier, and a green gate at 1087 tests and 80.20% mutation."
---

# Lessons - labelled subagent sessions

## L1 A child's last action is its report, and its budget is counted in units

An implementer backgrounded a filtered test, idled mid-turn, and returned a progress note where its report belonged, so the orchestrator had to resume it. A story writer spent its 24-call budget on gateway list and read-backs and closed without its frontmatter gate, so another child ran the gate.

Rule for the dispatch author: name the closing artifact (report or sentinel) as the pass condition, forbid backgrounding a gate inside a child turn, count each memory write as list + read + write + read-back when dividing the budget, and reserve the gate call. Observable: the child's last message carries the report and its own gate output, or the orchestrator resumes it for both.

Related: mem:cases/orchestration/limits-not-converted-to-unit-arithmetic, mem:cases/orchestration/gate-skipped-to-save-a-call

## L2 Enumerate and check from the artifact that runs

A closing verifier returned PASS on "label exclusions are enforced" because it read `normalizeParameters` - which does run before `runAttempt` - and never traced the `subtask_run` entry: `runLabelled` stripped the label before validation, so an invalid label and both the label+task_id and label+fork_from combinations were never refused, and every invalid call created a fresh child. The same error in a brief produced a four-path write allowlist that needed five files and two doc gaps that only the final verifier found.

Rule: the verifier traces every claim from the tool entry to the write it guards and names the criteria it did not check; the dispatch author copies the allowlist and the documentation obligations from the write sites the discovery map found, never from the decomposition. A gate is evidence only for the path it ran and the baseline it ran against, so the writer records a store-wide gate's pre-existing failing ids before writing and reports the delta. A finding outside the agreed contract - a ChildState value the host never emits - is reported as residue, not fixed inside the same change.

Related: mem:cases/guessed-plugin-path, mem:cases/opencode/doc-rename-dropped-tool-contract, mem:cases/orchestration/rendering-read-as-artifact

## L3 A lock narrower than the document it replaces loses writes

The bind lock was keyed per label while every bind rewrote the whole binding document, so two concurrent first-binds on different labels dropped a row. The fix is a session-scoped lock, tested by driving two first-binds on different labels concurrently and asserting both rows survive.

Rule: the lock key comes from the write's replacement unit, not from the field that identifies the caller's row; a whole-document write takes a per-document lock. Observable: the concurrency test ends with every accepted bind present, and no test proves the lock by running the binds serially.

## What held

Grilling before the operator question round produced four forks that each changed the mechanism; a discovery child mapped the real store API and prevented the in-memory map the research memory implied; the stricter verifier that traced the tool path found what the first verifier's PASS could not.
