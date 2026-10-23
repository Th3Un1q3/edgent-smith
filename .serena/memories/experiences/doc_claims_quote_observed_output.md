---
id: experiences/doc_claims_quote_observed_output
type: experiences
L0: "A doc edit asserting a tool signature or return shape must quote the observed call output in the same pass; an invented argument name survives review and is copied by the next reader."
version: 1
freshness: 2026-10-23
provenance: three-child documentation sweep retrospective
---

# Doc claims about call shape must quote observed output

## Rule

A documentation edit that states a tool signature, argument name, or return envelope must show the observed call output beside the claim in the same pass. The claim and the output travel in one diff.

## Why

A documentation sweep produced two claims that passed editor self-review and failed a hostile review: a falsified argument name and a wrong return envelope. Nothing in the edit distinguished a remembered shape from an observed one, so the reviewer had no evidence to check and the defect was copied into a downstream prompt.

## How to apply

1. Run the call once and capture its literal output before writing the sentence.
2. Paste the output (trimmed, fenced) next to the claim, or cite the pass that produced it.
3. Treat an unrun call as unverified: a signature asserted without output beside it is PLAUSIBLE, not verified, and never a PASS.
4. When the call cannot run, describe the outcome without naming argument or return keys.

## Scope

Applies to skill files, instructions, prompts, and any doc that a later agent will copy verbatim.
