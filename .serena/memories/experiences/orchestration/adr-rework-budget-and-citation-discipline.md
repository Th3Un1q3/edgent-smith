---
id: experiences/orchestration/adr-rework-budget-and-citation-discipline
type: experiences
L0: "Artifact-owning children write the file before verifying; a validator re-reads every cited file:line, never a sample; gate failures are attributed to the causing session first"
hotness: 0.7
ttl: 180d
version: 2
freshness: 2026-10-28
directory: experiences/orchestration
provenance: "Observed orchestration run 2026-10-28 reworking an accepted ADR; children ses_e7d628adaffeeJdjcTKClpqAG0, ses_e7d60a93effeIlTfbstLZGVXZE, ses_e7d5e5f2dffd78uaKQlOGd5Ll1; relates mem:cases/orchestration/child-evidence-before-verdict, mem:cases/delegation-goal-gate-and-prompt-width"
---
# Budget arithmetic and citation trust in a decision-record rework

Three research children returned analysis but no artifact: a 24-call budget went to discovery and recall before the write, so the handover travelled as report text and the next child re-derived it. One ADR landed with 20+ exact citations and one false code claim that only a fresh judge caught, after the record was accepted.

## Rules

1. **Allocate the budget at dispatch.** Split 24 calls into discovery / write / readback / verify / report before the first call; reserve the last four. All three children spent the whole budget on evidence and recall and wrote no file.
2. **Write the artifact early, then append.** A partial artifact left by a stop beats none: draft as soon as the first six facts land.
3. **A report is not a handover.** A child that owns an artifact hands over a path; prose forces the consumer to re-derive paid-for work.
4. **Dispatch a consumer only after its prerequisite exists on disk.** The ledger child ran before the premise file existed, rebuilding verified evidence. Check the path, not the producer's status.
5. **A citation from a child that did not open the file is the highest-risk claim in a decision record.** The validator re-reads every cited file:line against the tree; spot-checking hides exactly that failure, and a false workflow.ts hook claim survived into an accepted record.
6. **Precedence must be stated, not inferred.** When a prompt asks for N sections and the governing ADR rules fix another order, the dispatch names the winner; unresolved, `## Decision` moved from third to seventh silently.
7. **One find beats guessed paths.** Three failed SDK path probes cost calls; locate a package with one `find`/`ls` first.
8. **Mark vendor or cache claims as inference.** Spend no calls searching what the cache already answers; label it inferred.
9. **Confirm suspicious bytes by character code.** A quoted backslash in a read-back was JSON escaping, not content; char codes settle it in one step.
10. **Attribute a gate failure before fixing it.** Memory-gate failures on two cases/ files belonged to a parallel session; name the owner first, never repair another session's files.
11. **Do not invent sub-parts under a tight budget.** An implicit P4/P5 split duplicated work; sub-sections come from the user.

## Root causes

- No budget plan at dispatch, so discovery had no ceiling: the dominant cause, shared by all three children.
- Preconditions unowned: a consumer dispatched without its on-disk input, and prose accepted where a path was required.
- Verification scheduled after acceptance: the citation audit ran as a fresh judge pass on an already-accepted record.
- Silent prompt precedence, plus self-invented section splits.

## Verification

Source: the three child sessions and four orchestrator observations above, one run on 2026-10-28. Rules 10 and 11 are single observations, confidence 0.6; the rest recurred across at least two children.

## Scope rationale

scope: experiences — a cross-child pattern over four failure classes, not one failure-plus-fix. Tier caveat: promotion asks for three trajectories; this entry promotes from four observed instances because cases/ is owned by another session here.
