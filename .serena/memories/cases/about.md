---
id: cases-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "cases: reusable extraction cases distilled"
L0_table:
  - id: cases/rug/empty-child-result/*
    L0: "Grouped: 2 empty-result cases — a batched pair of long children returned empty outputText and each resumed alone succeeded, so a gate run goes alone and in the background; and a child's empty result paired with a self-graded ledger."
  - id: cases/brief-omitted-test-max-lines
    L0:     L0: "Brief named gates but not the 650-line test-file ceiling: four criteria UNVERIFIED"
  - id: cases/browser-automation/linkedin-growth-chart
    L0:     L0: "LinkedIn growth chart: aria-label regex extraction"
  - id: cases/ci-*
    L0: "Grouped: 5 CI gate failures 2026-09 — devcontainer setup, markdownlint EOF heading, dependabot majors, gate merge, Stryker incremental cache v2."
  - id: cases/composition-contract-entry-path-unopened
    L0: "Composition contract named the glue entry plugins/state-machine/state-machine.ts; the entry is the sibling file plugins/state-machine.ts. Open an interface path before writing it into a contract, and never derive an entry from its directory name."
  - id: cases/concurrent-worktree-change-attribution
    L0:     L0: "Concurrent worktrees: attribute changed files to the right worktree"
  - id: cases/criterion-universal-unmeasured
    L0: "A criterion required {type, params} on every action and guard; three parameterless guards carried {type} only, as the source always had. Measure a shape universal against the existing items, then name the exception."
  - id: cases/scope-widening/*
    L0: "Grouped: 2 scope cases - a criterion wider than the request failed an out-of-scope site; an undefined reference let the judge read one claim against a new surface each round."
  - id: cases/delegation/never-infer-operator-identity
    L0:     L0: "Never infer an operator's identity or credentials: a guessed email became a duplicate dotenv key that won last, and the tunnel rejected it as an unauthorized broker assertion."
  - id: cases/docs/prose_capability_claims_rot
    L0:     L0: "Docs prose: capability claims rot without a check"
  - id: cases/guessed-plugin-path
    L0:     L0: "An implementer brief named .opencode/plugins/core/machine.ts, which does not exist; the module is plugins/state-machine/core/machine.ts. Open every allowlist path before dispatch and copy it from the discovery report."
  - id: cases/markdown/table-html-comment-splits-table
    L0:     L0: "Markdown: an HTML comment between rows splits a table"
  - id: cases/one-offs-flat
    L0: "Grouped: 12 flat delegation and validation one-offs — payload shape, subtask partials, trial mechanism, dispatch handle, research artifact, load path, absence claims."
  - id: cases/opencode/*
    L0: "Grouped: 21 plugin-era OpenCode cases — session and fork lineage, plugin tool exposure, SDK, skill catalog, Stryker, workflow fork and budget, instruction injection."
  - id: cases/orchestration/* (tail)
    L0: "Grouped: 14 earlier orchestration cases — citation defects, judge scope creep, review-criteria collisions, rename sweeps, unreachable self-arm."
  - id: cases/opencode/lint-gate-run-after-behaviour
    L0: "lint failed on three rules only after tests were green, because the gate ran after the behaviour. Run the lint gate with each increment that moves code, not after tests pass."
  - id: cases/opencode/signals-tool-signals-closed-over
    L0: "The slice owning definitions.ts and machine.ts left signals.ts closing over TOOL_SIGNALS, so the user's ad-hoc signal was stored but neither accepted nor advertised. Trace a datum to every definition site before slicing."
  - id: cases/opencode/state-machine-snapshot-read-during-init
    L0: "Reading self.getSnapshot().value inside the action threw xstate's initialization error and failed 66 tests. Carry the state id in action params as set_tools_policy does, and assert it matches its containing state."
  - id: cases/orchestration/child-evidence-before-verdict
    L0:     L0: "Judge a child by its transcript not outputText; paste full verdicts; scope validators to the target path"
  - id: cases/orchestration/delegated-report-completeness-contract
    L0:     L0: "A delegated report with no closing sentinel and count is truncated, not complete; a sliced verdict drops the tail where sentinels and totals live."
  - id: cases/orchestration/delegation-prompt-assumptions
    L0:     L0: "A delegation prompt inherits orchestrator assumptions: an ADR lives in mem: rules plus the about index, not a repo file:line; a child may lack the gateway, so load it first; a citation disagreeing with the tree is corrected, never fit to a count."
  - id: cases/orchestration/dirty-baseline-unverifiable-no-modification
    L0:     L0: "UNVERIFIABLE on 'no existing file modified' from a tree already dirty; pre-declare the expected path and the dirty baseline."
  - id: cases/orchestration/execute-body-hygiene-and-timeout-scoping
    L0:     L0: "Execute bodies: hygiene and timeout scoping"
  - id: cases/orchestration/quantifier-claim-falsified-by-one-line
    L0:     L0: "Absolute framing (no X exists, the only effect) falsified three times by one unenumerated line; counting words asserted a set nobody closed."
  - id: cases/orchestration/resume-error-empty-error-text
    L0:     L0: "Resume returned error with an empty error and no output; relaunch fresh."
  - id: cases/orchestration/self-graded-count-mismatch
    L0:     L0: "Validation block said all 8 sites, enumerated 9; passed on unrecounted"
  - id: cases/orchestration/skill-scouting-cadence-counter
    L0:     L0: "Skill scouting: a cadence counter gates re-scouting"
  - id: cases/orchestration/unverified-length-from-stacked-edits
    L0:     L0: "Two rounds reported an UNVERIFIED character count because edits were stacked behind one earlier measurement; measure after the last edit and print wc -c."
  - id: cases/orchestration/validator-external-diff-attribution
    L0:     L0: "Validators: attribute external diffs to the right producer"
  - id: cases/research/*
    L0: "Grouped: 2 research-claim cases - an existence-negative shipped with no level-scoped search; snippet figures drifted from the source page."
  - id: cases/serena-memory/* (tail)
    L0: "Grouped: 3 Serena recall-friction rounds."
  - id: cases/serena-memory/untyped-orchestrator-supplied-id
    L0:     L0: "Orchestrator pinned a memory id outside the nine typed scopes; content landed and read back fine, gate failed 8/9 at Typed. A dispatch saying use-exactly-this yields to the skill naming gate."
  - id: cases/uncapped-discovery-report
    L0:     L0: "A discovery report outran one result; a resume capped at <=1600 chars returned the usable facts. State the character cap at dispatch: the reader-budget rule already existed and was skipped."
  - id: cases/validator-evidence-bar-ambiguous
    L0:     L0: "10 criteria judged by path:line; the one named command (just ci) went unrun: UNVERIFIABLE"
  - id: cases/prompt-fork-decided-unasked
    L0: "Two prompt forks (call open before machine.interrupted with no machine state; log or silently drop an unrecognised reason) were decided by the child and surfaced only after the fact."
  - id: cases/verdict-sliced-at-display
    L0: "A 4000-char validator verdict sliced in the orchestrator's return expression lost criteria 6-8; subtask_tail held no copy, so the tail cost a resume."
  - id: cases/spec-field-list-omits-invariant
    L0: "A manifest spec listed fields per signal but not the rule that every signal carries a JSON schema; three schema-less signals shipped though the request named schemas. A data spec states per-item fields plus cross-item invariants."
  - id: cases/ts-excess-property-computed-keys
    L0: "TypeScript skips excess-property checks on computed keys: a computed-key `on` map accepted a bogus event, so a mistyping experiment proves nothing there; probe the literal shape first."
  - id: cases/opencode/guard-proliferation-to-one-policy-guard
    L0: "Two admission guards plus a stateId assertion collapsed to one guard with params {in:[...]} and an unguarded fallback; the stateId assertion only fed per-state arm derivation."
  - id: cases/opencode/homebrew-persistence-vs-library-snapshot
    L0: "A field allowlist, copier map, dotted-path converter and restore registry were replaced by XState's persisted snapshot plus one context boundary."
  - id: cases/opencode/green-unit-suite-live-bug-present
    L0: "The unit suite was green while a live probe still showed a subagent receiving its own loop; the probe had to be repeated before it was believed."
  - id: cases/opencode/duplicate-arm-was-the-named-requirement
    L0: "An always pair identical in effect to an on.admit pair was deleted as a duplicate, then restored because the requirement named always."
---

# Cases

Reusable distilled cases extracted from events/browser-automation: one problem, solution, and verification per case. Cases compose into trajectories (3 cases → 1 trajectory) per agent-evolution.md.

## Scope
- Cases at cases/<subdomain>/<case-slug>: selector, quirk, failure mode, verified fix, and provenance mem: refs.
- Distilled from mem:events/about and mem:browser-automation/about recipes.
- Atomic enough to reuse across sites; trajectories aggregate 3+ cases.

## Boundaries (out of scope)
- Raw event logs — mem:events/about.
- Cross-case patterns — mem:experiences/about.
- Atomic claims — mem:claims/about.

## Related Domains
- mem:browser-automation/about — source recipes for case extraction.
- mem:experiences/about — patterns distilled from cases.
- mem:events/extraction/batch-linkedin-2026-08 — event that yielded cases.
