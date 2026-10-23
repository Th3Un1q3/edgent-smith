---
id: preferences/rug_cross_session_handover
type: preferences
L0: "Decision (2026-10-23): rug.md carries strict cross-session handover guidance. The orchestrator is not a courier — never retype a child's output for the next child when a mechanism can carry it; a handover is one hop, child → child."
hotness: 0.85
ttl: 90d
version: 1
freshness: 2026-10-23
directory: preferences
---
# RUG cross-session handover
Decision (2026-10-23): .opencode/agents/rug.md now carries strict cross-session handover guidance. The orchestrator is not a courier — never read a child's output and retype it for the next child when a mechanism can carry it; a handover is one hop, child → child. Priority ladder, use the first that fits: (1) reuse the session with task_id — context, working state and injected skills persist, the prompt carries only the delta; (2) memory — one subtask stores through the serena gateway (skills: ['serena-memory']), later subtasks read by name; for multiple consumers or values that outlive the session, never for a single hand-off; (3) explicit output text — when the next step must be a fresh child, take outputText from the call result or from subtask_tail in a later execution, extract the needed span in code (split/match/slice), and interpolate the exact partials; (4) orchestrator-composed payload — last resort only, for a shape no output has, with the source child attributed and no re-summarising of what a child could have said itself. Live test evidence: session reuse recalled a generated token by task_id with no tools (match); a separate execution tailed the child, extracted the token with a regex and a fresh child echoed it (match); a memory write/read pair carried a token between two fresh children (match, 83-char read-back).