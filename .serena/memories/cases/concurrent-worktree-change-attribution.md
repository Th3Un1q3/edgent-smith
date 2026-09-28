---
id: cases/concurrent-worktree-change-attribution
type: cases
L0: "Unexplained mid-session worktree changes are often a concurrent unrelated workflow, not your damage. Attribute via OpenCode session exports + mtimes before reverting; MM git status can mimic damage."
hotness: 0.75
ttl: 180d
version: 1
freshness: 2026-09-23
directory: cases
provenance: OpenCode session exports (.tmp/session-review) + opencode export; wf#f3ac23
---
# Attribute unexplained worktree changes before treating them as damage

Problem: during a quality-gate fix and re-run, `git status` showed unexpected uncommitted changes to 4 `.opencode/plugins/*.ts` files plus tests. The `MM` state (staged and worktree divergence) and the timing looked like self-inflicted damage or gate-cheating, inviting a revert.

## Root cause
The edits came from a concurrent, unrelated OpenCode workflow run, not from this session:
- workflow `wf#f3ac23`, child session `ses_f30fe841affesde43I0XxR3h2u`, parent session `ses_f321e92f1ffefRtJXWGbkNDLnV`, task "remove timeout_seconds completely".
- Write time 16:03:21, after this session fix (16:00:42) and re-run (16:03:05) - interleaved, not part of this work.

## Resolution method
- Do not revert or clean up unexplained changes until attributed.
- Recover exact tool calls and timestamps from OpenCode session records: exported session JSON under `/workspace/.tmp/session-review` plus `opencode export`.
- Batch file mtimes to find the write moment, then correlate with the concurrent session activity window.
- Treat `git status` `MM` (staged vs worktree divergence) as a signal to investigate, not proof of damage; it reflects index/worktree difference, not authorship.

## Durable rule
In a shared workspace, concurrent workflow runs can legitimately edit files mid-session. Attribute first via session records and mtimes, then decide. Reverting another session work is destructive and out of scope.

Related: mem:subagent-workflows/parallel-edits-cross-file-references; mem:subagent-workflows/about.

Sources: session exports under /workspace/.tmp/session-review; `opencode export`; observed `git status`.