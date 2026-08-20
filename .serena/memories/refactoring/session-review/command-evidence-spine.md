# Command Evidence Spine

The session-review flow keeps two commands separate on a shared evidence spine: `retrospect` and `session-analysis`. `session-insights` is the extraction spine (session JSON -> review.md evidence); `harness-management` is the implementation spine.

## Prioritization policy

- Score each item by recurrence × cost per occurrence.
- One-off items: note in the flow's lesson record, not a harness change. Repeated/expensive items: harness change.
- Cap the action-item list at 1-3 (default).

## session-analysis behavior

- Reads the pre-filled review.md §3-§7 (no recompute); single residual jq step (crossing step).
- Step 7 implements the top 1-3 items per the policy, then asks for an opencode restart (plugin changes load at server start).

Related: mem:refactoring/session-review/review-document-contract, mem:refactoring/session-review/open-decisions, mem:troubleshooting/opencode-plugin-live-diagnosis.