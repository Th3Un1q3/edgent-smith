---
id: researches/worktree-coding-workflow
L0: "PROPOSAL: a coding workflow that gives each task its own git worktree, moves the session into it, reloads skills at every stage boundary, validates with non-author sessions plus repo gates, then merges back only behind user authorization."
---
## Idea
A coding task takes its own git worktree and branch before the first edit, keeping the shared checkout clean while the session works there. Skills reload per stage, non-author sessions validate, and a user-authorized merge closes it.

## Shape
1. Branch `wt/<slug>-<yyyymmdd>`, worktree `.worktrees/<slug>` under /workspace so mounts and recipes resolve; an existing branch takes a numeric suffix.
2. `git worktree add -b <branch> .worktrees/<slug> HEAD`, run by the dispatch author before the first edit; local, not a gated remote write.
3. The working directory moves in before any read or edit; client session move expected, UNVERIFIED.
4. Each stage boundary gets a find-skills pass whose picks ride that stage's dispatch.
5. Each stage appends stage, chosen skills with reason, files touched and gate outcome; the ledger stays in the worktree, summarised at merge.
6. Validators are fresh sessions that did not write the change, running the repo gates for PASS.
7. On PASS the branch merges only after the user authorizes git add/commit/push in this session; a denial stops the workflow, worktree intact, removed once the user confirms.
8. A failed criterion loops back to a fix; past the retry limit the author abandons with `git worktree remove --force` and keeps the branch.

## Where it lives
- `.agents/skills/worktree-coding-workflow/` - PROPOSED; stages, naming, ledger.
- `.agents/skills/harness-management/` - PROPOSED; owns placement.
- `.agents/skills/software-engineering/` - PROPOSED; gate side and proof of done.
- `.opencode/instructions/`, `.opencode/agents/` - PROPOSED; path convention; an agent only if the stage loop becomes one.
- `workflows/`, `justfile` - PROPOSED; cross-process stages, and create/validate/merge wrappers.
- No marketplace skill documents worktree mechanics.

## Grounding
- /home/vscode/.local/share/opencode/opencode.db, 5.6 GB SQLite; child sessions link via session.parent_id.
- A dispatch is a task tool part with data.state.input keys [description, prompt, subagent_type, skills]; prompt present in 6,696 of 6,889.
- subtask_run: prompt, description, agent, skills, task_id (resume), fork_from, timeout_minutes, schema; resume keeps context and state.
- Repo policy: git add/commit/push are gated writes needing the user's explicit authorization this session; a denial is final.
- A fresh harness-management subtask runs /sessions/retrospect to RETROSPECTIVE_COMPLETE; the PASS comes from a session that did not produce the artifact.
- UNVERIFIED: the client session move under that name or semantics; just recipes resolving relative paths in the worktree.

## Related memories
- mem:researches/about - navigation index for this entry.
- mem:researches/harness-patterns-loop-context-coding - overlaps; external loop patterns only.

## Open questions
- Does a session move exist, and does it change cwd for later calls?
- What retry limit separates fix loop from abandonment, and who sets it?
- Is the ledger a file, memory or transcript query, and who reads it at merge?
- Which gates run in the worktree versus on the merged branch under DevContainer CI, and must a validator move in?
- Do sibling worktrees confuse the AGENTS.md loader, justfile discovery or plugin watchers?

## Risks
- A merge is a gated write, so the workflow cannot close unattended.
- Worktrees widen the tooling surface; watchers and paths may misfire.
- Two stage skills can disagree; no contradiction sweep is defined.
- Abandoned worktrees leave litter no one owns; per-boundary discovery adds latency.

## First step
Read the OpenCode client API for a session move operation; record its existence, parameters and cwd effect on later calls.
