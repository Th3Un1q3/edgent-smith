---
name: command-design
description: "Best practices for designing OpenCode commands. Use when creating, editing, or reviewing command markdown files."
applyTo: ".opencode/commands/**/*.md"
---

# OpenCode Command Design

Commands automate discovery, data extraction, and state management so the agent focuses on qualitative reasoning. A well-designed command runs all mechanical work via bash before the agent reads its first message.

## Principle 1: Automate Mechanical Work, Leave Reasoning to the Agent

Commands maximize bash automation. The agent handles qualitative assessment, root cause analysis, and recommendations — not file discovery, data plumbing, or placeholder replacement.

- **Use `<output command="...">!`...`</output>` blocks** for discovery or scans that do not depend on `$ARGUMENTS`. These render before the agent starts — the data is already in context.
- **Use `!`...`` shell injection blocks** for data extraction that depends on `$ARGUMENTS`. These execute and inject results into the command context.
- **Never make the agent run `find`, `cp`, `sed`, `grep`, or `mkdir`** — these are the command's job. Save agent tokens for reasoning.

Example (correct):
```markdown
## Phase 1: Discovery
<output command="find .tmp/review -type d -name 'ses_*' | sort">
!`find .tmp/review -type d -name 'ses_*' | sort`
</output>
```

Example (wrong):
```markdown
## Phase 1: Discovery
Please run `find .tmp/review -type d` to discover sessions, then list them...
```

- **Pre-fill template fields** via `sed` or `jq` before handing off to the agent. The agent never does placeholder replacement.
- **Output machine-parseable status indicators** (`STATUS=new`, `STATUS=resumed`, `STATUS=error`) so the command can branch without fuzzy matching.

## Principle 2: Reference Skills, Do Not Duplicate Them

Commands stay lean. Schema documentation, question lists, improvement patterns, and workflow steps live in skills. Commands reference them — never inline their full content.

- **Use `<skill name="..." location="..." />`** to inject skill content into the agent's context.
- **Reference skill files by name** in instructions: "Consult `references/schema.md` for field paths."
- **Never inline the full content** of schema.md, audit question lists, or improvement patterns into the command.
- **Inline jq queries sparingly**. If a query is complex and used once, inline it. If used across multiple commands, place it in the skill's reference docs or a just recipe.

Example (correct):
```markdown
<skill name="session-insights" location=".agents/skills/session-insights/SKILL.md" />

Extract skills loaded (Q4). Consult `references/schema.md` for field paths:
`!`jq '[.messages[].parts[] | select(.type=="tool" and .tool=="skill") | .state.input.name] | unique' "$SESSION_JSON"``
```

Example (wrong):
```markdown
Here are the 9 audit questions from the skill (full verbatim copy):
1. What was the session objective?
2. Was the session objective achieved?
... (all 9 questions copied verbatim)

Here are the 4 improvement patterns (full verbatim copy):
P1: Skill was loaded but objective not achieved...
... (all 4 patterns copied verbatim)
```

## Principle 3: Reusable Logic Goes in Justfile Recipes, Not Python Scripts

Shell logic the command needs lives as justfile recipes — not standalone Python scripts.

- **Put state-management bash recipes in the project's justfile** (e.g., `agent_utils/justfile`) as shebang recipes.
- **Prefer bash over Python** for command support scripts — simpler, fewer dependencies, faster startup.
- **A recipe does ONE thing** and outputs machine-parseable results (`KEY=VALUE` format).
- **Use `!`just recipe-name args``** to call recipes from the command.
- **Never create standalone Python scripts** for tasks a bash one-liner or jq pipeline handles.

Example (correct) — recipe in `agent_utils/justfile`:
```justfile
# Start or resume a session review
review-start session_id="":
    #!/usr/bin/env bash
    set -euo pipefail
    cd /workspace
    # ... logic ...
    echo "STATUS=new"
    echo "SESSION_ID=$SID"
```

Called from command:
```markdown
!`just agent_utils/review-start "$ARGUMENTS"`
```

Example (wrong):
```python
# agent_utils/session_review.py — 259 lines of Python with subprocess, jq wrappers, classes...
# Do not do this. A 30-line bash shebang recipe in the justfile is clearer and faster.
```

## Principle 4: Handle State Explicitly

Commands that modify files or track progress manage their own state. Do not rely on the agent to remember.

- **The command (via its just recipes) creates and manages review documents**, not the agent.
- **Check for existing state** before taking action: does `review.md` already exist? Is the session already reviewed?
- **Output clear status indicators** (`STATUS=new`, `STATUS=resumed`, `STATUS=error`) so the command branches deterministically.
- **Pre-fill template fields** via `sed` or `jq` before handing off to the agent — the agent never does placeholder replacement.
- **Mark completed work in the frontmatter** (e.g., `status: "completed"`) so resumed sessions pick up where they left off.

Example (correct — recipe checks state, emits status):
```justfile
review-start session_id="":
    #!/usr/bin/env bash
    set -euo pipefail
    cd /workspace
    REVIEW_MD=".tmp/session-review/$1/review.md"
    if [ -f "$REVIEW_MD" ]; then
        echo "STATUS=resumed"
        echo "REVIEW_MD=$REVIEW_MD"
    else
        cp .agents/skills/.../templates/review-document.md "$REVIEW_MD"
        echo "STATUS=new"
        echo "REVIEW_MD=$REVIEW_MD"
    fi
```

Example (wrong — assumes clean slate, no state check):
```justfile
review-start session_id="":
    #!/usr/bin/env bash
    # WRONG: blindly overwrites existing review document
    cp template.md ".tmp/session-review/$1/review.md"
    echo "STATUS=new"
```

## Principle 5: Keep the Command Focused — One Thing per Invocation

- **Review ONE session per command invocation.** To review more, run the command again.
- **The command completes in a single focused session.** If the work is too large, split it into multiple commands.
- **Use `$ARGUMENTS` for required input** (session ID, file path, etc.). When absent, auto-discover a sensible default via the just recipe.
- **Never chain independent operations** into one command — each command invocation should have a single, clear outcome.

Example (correct — reviews ONE session, auto-discovers if needed):
```markdown
# Command reviews ONE session:
!`just agent_utils/review-start "$ARGUMENTS"`
# If $ARGUMENTS is empty, auto-discovers first unreviewed session
# To review another session, run the command again
```

Example (wrong — tries to review all sessions in one invocation):
```markdown
# WRONG: tries to review all sessions in one invocation
for dir in .tmp/session-review/*/; do
  review-session "$dir"
done
# This creates an unbounded amount of work for one agent session
```

## Anti-Patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Inlining full skill content into the command | Duplicates maintenance burden; skill updates do not propagate to the command | Reference skill files by name; use `<skill>` block |
| Telling the agent to run find/cp/sed/mkdir | Agent struggles with exact shell syntax; burns tokens on plumbing | Use `<output>` and `!` blocks in the command |
| Creating complex Python scripts for simple shell tasks | Adds dependencies, test burden, and maintenance overhead | Bash shebang recipe in the justfile |
| jq field name mismatch with actual schema | Silent failures — sed or jq operates on non-existent paths | Verify every field path against schema.md; test with real session data |
| Not handling working directory context in recipes | Recipe runs from the justfile's directory, not workspace root | Always `cd /workspace` at the start of recipes |
| Leaving blank review documents for the agent to fill from scratch | Agent wastes tokens on placeholder replacement and template formatting | Pre-fill all accessible fields with bash before handing off |
| Duplicating jq queries across command and skill | Schema changes break one but not the other; diverging queries produce inconsistent results | Quote from skill docs; put reusable queries in just recipes |
| Having the agent discover what to review | Agent runs `ls` and guesses; fragile and non-deterministic | Discovery logic in just recipe with `find` and status checks |

## Command Checklist

When creating or modifying a command:

1. [ ] Does all mechanical work run via `<output>` or `!` blocks? (Agent must not do plumbing.)
2. [ ] Does the command reference skill files instead of duplicating their content?
3. [ ] Is reusable logic in a justfile as bash recipes, not Python scripts?
4. [ ] Does the recipe handle state (exist checks, resume detection, template pre-filling)?
5. [ ] Are all jq field names verified against the schema reference? (Test with real data.)
6. [ ] Does the recipe `cd /workspace` (or use absolute paths)?
7. [ ] Do sed patterns exactly match template placeholders? (Test with real template files.)
8. [ ] Is the command scoped to ONE thing per invocation?
9. [ ] Are `$ARGUMENTS` handled gracefully — auto-discovering a sensible default when absent?
10. [ ] Does the recipe output machine-parseable status lines (`KEY=VALUE`) for the command to branch on?

---

**Last updated:** July 2026
**Scope:** OpenCode command file design and supporting justfile recipes
**Applies to:** All `.md` files under `.opencode/commands/`
