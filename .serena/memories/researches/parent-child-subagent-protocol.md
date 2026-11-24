---
id: researches/parent-child-subagent-protocol
L0: "PROPOSAL: a parent/child token protocol (OUT=, IN=, HANDOFF=, GATE=) measured to save only ~2% of prompt characters; the larger lever is a brief written once into a memory and referenced by later children."
---

## Idea
Every dispatch restates scaffolding, so a parent skill extending `task-delegation` fixes tokens and a child skill unpacks them, recovering ~2%. Value: the child-side report contract and the write-once brief.

## Shape
1. Derivation: mine `part.data.state.input.prompt` over task parts, group blocks, rank by frequency × length; child sessions link by `session.parent_id`.
2. Slots (prompts/chars): do-not 4,716/4.98M; report-back 3,362/0.82M; acceptance heading 1,642/0.70M; verify line 1,106/0.32M; scope and allowlist labels 1,283/1.16M (labels only, paths inline); context 3,552/6.00M is per-dispatch.
3. Three core tokens, payload unchanged:

| Token | Expansion |
|---|---|
| `OUT=memory:<name>` | "Write your final deliverable into the memory <name> through the gateway, read it back to confirm it landed, and reply with only the memory name and a one-line summary." |
| `OUT=file:<path>` | "Write your final deliverable to <path> before you run any other tool, keep every edit inside the files you were given, and reply with that path plus the last thing you wrote there." |
| `HANDOFF=required\|forbidden` | "End your report with a `## Handoff` section naming who consumes the result next, where it was written, and the last identifier you touched; when handoff is forbidden, end on the sentinel line instead." |

4. Never shorthanded: context body, deliverable and target paths, acceptance-criterion text, scope file lists, numbered task steps — each is per-dispatch.
5. The table is canonical; `references/tokens.md` ships it and defines `OUT=report:<cap>`, `IN=memory:<name>`, `IN=file:<path>`, `GATE=<command>`.
6. Emit; fall back inline without the child skill; a token-carrying resume continues the same child, tokens re-issued only on a changed deliverable.
7. Larger lever: a brief written once into a memory, referenced by later children, so the parent sends only the delta.

## Where it lives
- PROPOSED `.agents/skills/task-delegation/SKILL.md` (emit, fallback); `.agents/skills/subagent-protocol/SKILL.md` (child skill; `references/tokens.md` ships the table).
- PROPOSED `scripts/conductor/` and `justfile` (mining script plus recipe); `.opencode/agents/rug.md`, `rug-swe.md` (token emission; owner edits).

## Grounding
- `/home/vscode/.local/share/opencode/opencode.db`: 6,696 prompts, 27,344,275 chars, median 2,550, mean 4,084, span to 2026-09-21.
- 5,800 exact-distinct, 5,773 normalised: repeats are duplicate or retry prompts.
- Harness-injected: 694 skill bodies 3.62M, 43 agent cards 1.36M, 4,058 `<user_request>` wrappers — a harness change, not a token.
- `subtask_run` fields: prompt, description, agent, skills, task_id, fork_from, timeout_minutes, schema — no label; a continuous child is reached by `task_id`.
- Resume by `task_id` preserves child context and working state.
- A closing PASS comes from a non-author; git writes are gated and need in-session authorization.
- Own slots yield ~0.5M of 27.3M, about 2%; totals overlap.

## Related memories
- mem:researches/about — index row.
- mem:researches/write-once-read-many-context — the larger lever.

## Open questions
- Which measured slot earns a token first?
- How is the child skill versioned so a redefined token misses an older copy?
- Should a `subtask_run` label land first so `CHILD=memory-manager`?

## Risks
- Tokens recover ~2%; the pair must justify itself on report quality.
- Harness-injected text inflates counts; tokenising it fixes the wrong layer.
- Definition copies drift; one authoritative file keeps it sound.
- Token emission into a user-owned card is gated; a child cannot make it.

## First step
Draft the brief-once memory and measure what it removes from a median prompt.