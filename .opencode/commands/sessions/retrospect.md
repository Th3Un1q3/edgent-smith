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

## Step 3: Turn answers into action items

Prioritize by recurrence × cost per occurrence: a one-off is a note in `$FILE`; a repeated or expensive failure is a harness change. Cap the action-item list at 1–3, each with four fields:

- **Change** — the exact modification, specific enough that a fresh-context agent could act on it alone.
- **Where** — the target artifact: `.opencode/instructions/`, `.agents/skills/`, `AGENTS.md`, or `.opencode/agents/`.
- **Trigger** — the condition that should have invoked this behavior.
- **Next step** — the single smallest first action.

Record the items in `$FILE`.

## Step 4: Implement and restart

Implement the top 1–3 action items using the harness-management skill:

<skill name="harness-management" location=".agents/skills/harness-management/SKILL.md" />

Select the change type (scoped instructions, skill, `AGENTS.md`, or agent definition), read the matching workflow, and execute the changes.

Then ask for an opencode restart to apply them. Recall the project lesson in memory `troubleshooting/opencode-plugin-live-diagnosis`: plugin and instruction changes load at server start, and unit tests cannot prove live hook wiring — the changes take effect only after an opencode restart.
