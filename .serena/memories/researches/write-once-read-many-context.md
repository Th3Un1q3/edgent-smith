---
id: researches/write-once-read-many-context
L0: "PROPOSAL: write a dispatch brief once into a memory, then send later children its reference plus their delta; context reuse, not token compression, is the lever."
---

## Idea
Every dispatch re-explains the same goal, and each child pays for it. Write the brief once, store it under a stable name, read it many times: a child assembles its full prompt from the reference plus a small delta. Reusing context, not compressing it, is the lever.

## Shape
1. Authoring: the dispatch author asks one child to write the brief and nothing else, or makes it part of the first child's deliverable, so the text is produced once.
2. Content: goal, constraints, acceptance criteria, domain vocabulary, shared paths. Never role, deliverable path, or write allowlist, which change per child.
3. Storage: the author writes it through the gateway under a stable name in the scope the 9-type rule assigns. A brief that dies with the task lives in the typed cache scope; one that outlives the task is promoted to an entity. No new namespace is invented for it.
4. Dispatch: later children receive `IN=memory:<name>` plus their delta: role, deliverable path, write allowlist, gate.
5. Assembly: a child reads the brief first, restates the goal in one line, then works from brief plus delta and reads nothing the author did not name. On conflict the brief wins on goal, the delta wins on paths.
6. Amendment: only the author rewrites the brief, at a stage boundary, then reissues the reference. A running child keeps the version it started with; a child that finds the brief insufficient reports the gap instead of patching it.

## Where it lives
- PROPOSED `.agents/skills/task-delegation/SKILL.md` — the dispatch section gains the brief-reference form beside the inline form.
- PROPOSED `.agents/skills/serena-memory/references/typing.md` — the cache-scope entry names the short-lived brief case.
- PROPOSED `.agents/skills/subagent-protocol/SKILL.md` — the child skill gains the assembly step: read the brief, restate the goal, apply the delta.

## Grounding
- 6,696 parent-to-child prompts totalling 27.3M characters, median 2,550 (opencode.db, to 2026-09-21).
- Inlined skill bodies account for about 3.6M of that repeated text.
- Shorthanding the parent's own slots recovers only about 2 percent, so compression is not the lever.
- UNVERIFIED: what share of those prompts would fit one shared brief; the 3.6M and 2 percent figures rest on that same corpus alone.

## Related memories
- mem:researches/parent-child-subagent-protocol — the token protocol this extends; its step 7 names the write-once brief without the mechanism.
- mem:researches/labelled-subagent-sessions — a session-scoped label can name the child that owns the brief, so the author reissues it by label rather than by session id.

## Open questions
1. Who owns the brief, and which event forces a rewrite: a stage boundary, a new deliverable, or a child's insufficiency report?
2. How does a child signal insufficiency without the author reading its whole transcript?
3. Does a brief hash belong in the dispatch, so a child can detect drift under it?
4. What happens when two children read different versions and their outputs must agree?
5. Does the brief replace part of the orchestrator session, or duplicate it?

## Risks
1. Drift: the author rewrites while a child runs, and that child answers an older goal.
2. Invisible coupling: one child's edit to the brief changes what every later child reads, with no diff visible.
3. Second source of truth: brief and request diverge, and no rule says which wins.
4. Churn: rewriting per stage turns a read-many artifact into a write-many one.
5. Stale promotion: a cache-scoped brief outlives its task and a later task reads a dead goal.

## First step
On the next task dispatching three or more children, write its brief into `cache/` first, and record each child's prompt characters against the 2,550 median.
