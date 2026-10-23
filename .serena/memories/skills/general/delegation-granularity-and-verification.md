# Delegation granularity is per subtask, not per execute call

One `subtask_run` covers one unit of work — one deliverable, never "implement A and B" or "implement and research". Several subtask runs belong in the same execute call; serializing independent subtasks across separate calls buys no isolation and spends wall-clock and budget.

A validator may run in the same execute call as its producer provided it receives no `task_id` and no `fork_from`. Independence means no producer identity, not no write access, so a verifier may be authorized to fix inside a declared whitelist.

Only the closing PASS must come from a session that did not author the last edit.

Parse subtask results before reading them, since they may arrive as a JSON string; a truncated producer report is not validation.