---
id: subagent-workflows/staged-worktree-drift-commit-handling
type: preferences
L0: "After the user stages work, agent edits leave MM/AM drift in the index; re-stage before committing; when user WIP shares the index, commit only intended paths with git commit -- <paths>."
hotness: 0.8
ttl: 180d
freshness: 2026-09-27
directory: subagent-workflows
provenance: session audit of staged/worktree drift
---

# Staged / Worktree Drift and Commit Handling

- When the user stages their work and an agent then edits those files, index and worktree diverge: git status shows MM (staged plus unstaged changes) or AM (added then modified). Re-stage the changed paths before committing, or the commit carries stale staged content.
- When the user WIP shares the index, a bare git commit sweeps in those staged changes. Commit only the intended paths with a path-limited form: git commit -- <paths>.
- A commit is a gated write. Authorization: .opencode/instructions/no-permission-workarounds.instructions.md.

Related: mem:cases/concurrent-worktree-change-attribution.
