# Requirements Analysis Questions

## Q1. [developer] Signal delivery channel

The quality-gate-enforcer currently reports gate results with `session.prompt({ resume: false })`, which starts a model turn, while instructions-loader delivers its steering text with `session.synthetic(...)`. Which signals should move to synthetic delivery?

- A. Every gate signal — both the pre-change pass and the post-change status transition — goes out as a synthetic message, matching instructions-loader
- B. Only post-change (status transition) signals go synthetic; pre-change results stay silent
- C. Make the delivery channel configurable per gate in `harness.config.ts`
- D. Keep prompt delivery and only align the message formatting
- X. Other (please specify)

[Answer]: A. Every gate signal goes out as a synthetic message

## Q2. [developer] Consolidation scope

Which repeated parts should be consolidated in this change?

- A. Extract the shared path helpers (`readFilePath`, workspace-relative conversion) and a shared steering-message builder into helper modules used by both plugins
- B. Also unify the remaining cross-plugin duplicates (idle-event predicate, template-array construction, glob/shell quoting) across all five plugins
- C. Deduplicate only inside quality-gate-enforcer, leaving instructions-loader untouched
- D. Leave duplication in place; limit the change to the delivery channel
- X. Other (please specify)

[Answer]: A. Extract shared path helpers and steering builder for both plugins

## Q3. [developer] Unused code and configuration

The scan found an unused debounce batcher, a single-gate formatter, a `debounceMs` setting, and two unused status types. What should happen to them?

- A. Remove them, along with their tests and configuration entries
- B. Wire the debounce batcher in so `debounceMs` actually takes effect
- C. Keep them unchanged
- X. Other (please specify)

[Answer]: A. Remove them with their tests and configuration entries

## Q4. [developer] Delivery frequency and idempotency

Today a gate reports only when its pass/fail status changes. After the switch to synthetic messages, what should the rule be?

- A. Keep status-diff reporting: one synthetic message per status transition
- B. Keep status-diff reporting and also suppress duplicates per session, as instructions-loader does with its per-path token
- C. Send a synthetic message on every gate run, whether or not the status changed
- X. Other (please specify)

[Answer]: A. Keep status-diff reporting, one synthetic message per transition

## Consolidated Summary Confirmation

- Every gate signal — the pre-change pass and the post-change status transition — is delivered as a synthetic message, matching how instructions-loader delivers steering text.
- The duplicated parts consolidated are the shared path helpers (path extraction and workspace-relative conversion) and a shared steering-message builder, used by both plugins.
- The unused debounce batcher, single-gate formatter, `debounceMs` setting, and two unused status types are removed, with their tests and configuration entries.
- Status-diff reporting stays: one synthetic message per status transition, not one per run.

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
