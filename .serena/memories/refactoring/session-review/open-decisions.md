# Open Decisions (session-review)

Resolved decisions (user-confirmed; source: operator):

- R1 — skill-usage-tracker promotion: user chose **supporting evidence only**. Tracker stays corroboration; the dual-signal "loaded" definition (native `skill` tool call OR a `<skill>` tag inside a `<task_skills>` payload; bare prose tags excluded) remains authoritative (see mem:refactoring/session-review/skill-loading-conventions).
- R2 — duration heuristic: user chose to keep the existing computation. "Session took too long" is determined by the number of steps/tool calls per session, implemented in the tool-limit reminder (plugin). No change to the heuristic.
- R5 — customize-opencode: user overrode plan D2. `customize-opencode` is re-added to the session-analysis loads list (3rd entry); Step 7 gained one conditional sentence — load customize-opencode by name when an action touches opencode config mechanics (opencode.json/opencode.jsonc, config under .opencode/ — agents, skills, plugins, MCP servers, permission rules — or ~/.config/opencode/).

Related: mem:refactoring/session-review/command-evidence-spine, mem:refactoring/session-review/skill-loading-conventions.