---
id: preferences/rug_resume_skills_once
type: preferences
L0: "An attempt attaches its skill ids on its first prompt only: the in-attempt retry carries none, and a new attempt or resumed subtask re-attaches on its first prompt."
hotness: 0.8
ttl: 90d
version: 4
freshness: 2026-11-26
directory: preferences
provenance: .opencode/plugins/workflow/subtask-attempt.ts; .opencode/plugins/workflow/client-adapter.ts; .opencode/plugins/workflow/subtask-turn.ts
---
# An attempt attaches its skills on its first prompt only

Rule (2026-11-26): a subtask attempt resolves the `skills` names on its own call and attaches the resolved ids to the child prompt body of its first prompt. An in-attempt retry carries no ids: the retry rides the first prompt's message, so the session already holds that content, and the host re-renders every attachment on each prompt, so re-sending the ids would duplicate it. A new attempt, including a resumed subtask, re-attaches on its first prompt. The caller therefore never injects a skill by hand, and no `<task_skills>` text block accumulates beside the prompt.

Mechanism: `.opencode/plugins/workflow/subtask-attempt.ts` resolves the names once per attempt and passes the ids through `runTurn` into the first `promptOnce`; the structured retry calls `promptOnce` with no skills (`undefined`) in `.opencode/plugins/workflow/subtask-turn.ts`. `.opencode/plugins/workflow/client-adapter.ts` turns the ids into `{ skills: [{ id }] }` on `session.prompt` and omits the key when the list is empty; the host renders one `<skill_content name="…">` per attached id in input order.

Consequence for chained work: because an attachment belongs to the prompt that carries it, nothing is tracked across turns to avoid duplication, and a resume attaches, on the first prompt of its new attempt, the skills that resume call names. A caller that wants a capability the earlier phase lacked names it on the resume call; the resume row and the label rule in `.opencode/agents/rug.md` say the same.

Do not reintroduce the older guidance — that a resume omits skills, or that the caller must track each child's delivered skills and re-inject them. Both described the removed text-envelope path.

Source: .opencode/plugins/workflow/subtask-attempt.ts, subtask-turn.ts, client-adapter.ts; .opencode/agents/rug.md resume row and label rule.