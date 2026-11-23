---
id: conventions/tests-survive-template-wording
type: claims
L0: "Plugin tests take template prose from the shipped template file instead of pinning it, so a wording edit moves the expectation with production and never fails the suite."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-22
directory: conventions
provenance: .opencode/plugins/tests/helpers/template-text.ts; .opencode/plugins/state-machine/machines/session/template-files.ts
---
# Tests survive template wording

Templates and fixtures are content, not API. When a test pins their prose, a wording edit breaks the suite with no behavioural change: the failure reports a copy difference, not a regression.

## Derive the expectation from production's source

The test author builds the expectation from the same source production loads: render the template through the production renderer, or read the template file at test time, so a wording change moves both sides together. `templateText(id)` in `.opencode/plugins/tests/helpers/template-text.ts` reads the template from `TEMPLATE_DIRECTORY`, the directory production resolves; `templateStart` and `templateEnd` return the literal text around the first and last tag. The test author calls those helpers and never pastes the sentence.

## Assert behaviour and invariants

The test author asserts what holds regardless of words: emitted exactly once, only after the triggering event, non-empty, not the generic fallback, and the correct template identity. Those survive any wording edit.

## One shared helper

`template-text.ts` is the single helper for this. An author who needs more - a count, a tag value, a section body - extends it, because a second helper drifts from the directory production reads.

## Zero versus zero is false-green

A test that compares two zero counts asserts nothing; the author asserts the count derived from behaviour, so a template that stops being emitted fails.