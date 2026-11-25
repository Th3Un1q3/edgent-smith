---
description: "Run a session retrospective that writes evidence-backed lessons to .tmp/retrospectives/{alias}.md and turns them into prioritized harness action items."
---

# Retrospective

It's been a long session. Reflect on the process, not just the output: what happened, what it means, and what changes next time.

## Step 1: Prepare the retrospective file

Resolve the alias (from the first argument `$1`, or a timestamp default) and make sure the output directory exists:

!`ALIAS="$1"; [ -z "$ALIAS" ] && ALIAS="$(date +%Y%m%d-%H%M%S)"; mkdir -p .tmp/retrospectives; FILE=".tmp/retrospectives/$ALIAS.md"; STATUS=new; [ -f "$FILE" ] && STATUS=resumed; echo "STATUS=$STATUS"; echo "ALIAS=$ALIAS"; echo "FILE=$FILE"`

The output contains KEY=VALUE lines:

- `STATUS` — `new` or `resumed`
- `ALIAS` — the retrospective identifier
- `FILE` — path to the retrospective document

- `STATUS=new` — create `$FILE` and fill it in.
- `STATUS=resumed` — read the existing `$FILE` and update it in place; do not overwrite it.

## Step 2: Answer the probes — evidence first

Anchor: state the session's objective, what you actually shipped or decided, and what you left undone. Then answer each probe in `$FILE` with concrete evidence — names, file paths, commands, tool calls, or counts — never adjectives.

1. What worked well, and which specific tool, command, or behavior made it work?
2. Where did you stall or go down the wrong path, and what was the earliest point where you could have noticed?
3. What did you assume early that turned out to be wrong or expensive?
4. Where did you lose or re-derive context — re-reading files, re-running commands, re-explaining a subtask to a subagent — and what would have prevented each occurrence?
5. Which tools, commands, or skill loads were most and least useful this session, and why?
6. What did you learn about this codebase, workflow, or process that was not obvious when you started?
7. What is the single highest-leverage change for next time — one concrete behavior to start, stop, or keep — and where should it live (an instruction, a skill, `AGENTS.md`, or an agent definition)?

## Step 3: Interview the subagents

Only the orchestrator — the session that dispatched the children — can interview them, because a session cannot resume a child it did not dispatch. Resume two to four of your own children, chosen among those that struggled, exceeded a budget, contradicted the brief, or had to guess, and ask each of the things: what went well in in its task, what difficulties it experienced during their task, what it would do differently, and what led to those difficulties.

Record the answers in `$FILE` as given and never invent one. If you have no answers to record, the section says so in one line. Use the answers, do not file them: an action item that fixes a briefing defect quotes the child's own words from its answer in the action item's **Change** field from Step 4.

## Step 4: Turn answers into action items

Prioritize the action items per the harness-management skill's Prioritization policy — the harness-management skill is already active in this session, so follow its Prioritization section. Each action item has five fields:

- **Domain match** — for each action item, name the skill/domain where the failure occurred and place the change in THAT domain's skill, per the loaded harness-management skill's Domain Match rule.
- **Change** — the modification, stated so a reader who was not in this session can act on it and check it: name who acts, in plain words a reader already understands rather than a role invented for this session, and state the observable that shows the change took effect, including what makes it pass or fail. Do not carry over detail that only makes sense to this session's reader — repository-specific paths, sizes, run counts, or a named binary.
- **Where** — the target artifact: the domain's skill (`.agents/skills/`), else `.opencode/instructions/`, `AGENTS.md`, or `.opencode/agents/`.
- **Trigger** — the condition that should have invoked this behavior.
- **Next step** — the single smallest first action.

Record the items in `$FILE`.

## Step 5: Implement

Implement the top 1–3 action items using the harness-management skill:

The harness-management skill is already active in this session. Follow its Change Type Reference and matching workflow.

Select the change type (scoped instructions, skill, `AGENTS.md`, or agent definition), read the matching workflow, and execute the changes.

OpenCode v2 hot-reloads plugins, instructions, commands, and config automatically — no manual restart is required (restart only for unwatched local plugin dependencies or nested instruction edits). Recall the project lesson in memory `troubleshooting/opencode-plugin-live-diagnosis`: unit tests cannot prove live hook wiring.
