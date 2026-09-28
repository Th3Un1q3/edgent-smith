---
name: no-permission-workarounds
description: "Scoped reference for permission-gate handling, loaded when an edit touches a matched file path. A fuzzy/format denial expects the sanctioned canonical form (plain git reads, MCP `fetch` per the context-gathering skill, `just` targets, one command per call); a gated action is final — report it, never reproduce it through another mechanism, continue the rest of the task with permitted actions, and ask the user when it is essential. When an AFK denial message carries a hint, follow it; this file holds the full rules."
applyTo: "**/*.{py,ts,js,tsx,md,yml,yaml,json,sh}"
excludePaths: "**/node_modules/**"
---

# No Permission Workarounds

A fuzzy/format denial expects the sanctioned canonical form and is not final. A gated action is final for that action. Report the denial, continue the rest of the task with permitted actions, and never route a gated action around the gate.

## Guidelines

- **Split fuzzy from gated.** A fuzzy/format denial is not final: resubmit once in the sanctioned canonical form and report the substitution. A gated action — every git command other than the canonical read forms, plus any write, commit, or push — is final: report the exact command, the denial, and what you were trying to accomplish, and continue the rest of the task with permitted actions.
- **Canonical forms.** Fuzzy/format denials expect plain `git status`/`git diff`/`git show`/`git ls`/`git log` (no `-C`, no leading flags, no pipes, `&&`, or heredocs; directory via the tool's `workdir`), the MCP `fetch` server for web fetching (procedure owned by the `context-gathering` skill), `just` targets instead of raw runners (procedure owned by `.opencode/instructions/test-run-commands.instructions.md`), and one simple command per call.
- **Follow the denial hint.** When the AFK denial message carries a hint, follow it. The AFK denial message shows a short denial-time hint and points here for the full rules.
- **Never reproduce a gated action.** No wrapper, subprocess indirection, alternate tool, different invocation path, or any other mechanism. Stop and ask the user when the gated action is essential.
- **No gated writes without authorization.** Never `git add`, `git commit`, `git push`, or perform any other gated write without explicit user authorization in the current session. A gated write needs a clear instruction; an inferred goal is not authorization.
- **Report, do not normalize.** A denial is a signal to surface, not an obstacle to work around. Never record a bypass recipe for a gated action in a guidance file, a prompt, or a memory. If you are a subagent, return the denial to the orchestrator and continue the rest of the task with permitted actions.

## Output Format

On denial, report the exact command, the denial message, and the intended outcome. On a fuzzy/format denial, also report the canonical substitution applied. Continue with permitted actions, and ask the user when the gated action is essential.
