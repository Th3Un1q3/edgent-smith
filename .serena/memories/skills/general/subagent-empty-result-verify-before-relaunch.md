# Subagent "Empty" Results Are Often Truncated Reports, Not Failed Runs

An "empty" subagent result frequently means the run completed its tool work but the final report was truncated — not that the task failed. In one skill-rework campaign, three consecutive "empty" results were completed batch-recipe edits whose closing summary was cut; `git diff --stat` proved the work landed on disk.

Before assuming failure and re-launching from scratch, resume the session and ask for a status report plus an on-disk state check (git diff/status, file line counts). Re-running wastes budget and risks double-applying the same edit.

Related: mem:skills/general/edit-heavy-task-splitting (the failures often came from oversized single tasks).