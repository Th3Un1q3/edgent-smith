# Harness Change Checklist

A verification-first checklist for a harness change: every item names the evidence that proves it. Run top to bottom before declaring the change done, and record the evidence.

## 1. Scope

- [ ] List each file the change must land in; a single home needs no portability pass.
- [ ] Confirm each target path exists before editing it.
- [ ] State the outcome the reader must get, and the fallback for any target that needs one.

## 2. Evidence for Every Claim

- [ ] For every sentence that describes behavior, cite the repo artifact that proves it: a file, a command, or a config key.
- [ ] Delete any claim you cannot point to an artifact for.
- [ ] For a mechanism that needs a capability not every home has, state the outcome and a fallback that names no environment.
- [ ] Name the verifier for each fallback: a human, or a CI job running the repo's `just` gates.

## 3. Skill Shaping

- [ ] For a skill change, run the building-modular-skills completion gate: [Shaping Checklist](../../building-modular-skills/workflows/shaping-checklist.md). Its 24 checks cover root leanness, routing, link and fence audits, line budgets, and version deltas; do not restate those checks here.

## 4. Re-verify After the Last Edit

- [ ] Re-run the link, fence, and validator checks the Shaping Checklist names.
- [ ] Re-read the changed lines; confirm no claim outruns its evidence.
- [ ] Confirm the change records a verifier for each target it cannot reach.
