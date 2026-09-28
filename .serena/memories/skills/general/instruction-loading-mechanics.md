---
id: skills/general/instruction-loading-mechanics
type: experiences
L0: "OpenCode loads instructions by applyTo glob match on touched files; descriptions stay display-only; root AGENTS.md and steering messages load unconditionally; skills load by name; AFK emits denial-time steering."
hotness: 0.8
ttl: 180d
freshness: 2026-09-27
directory: skills/general
provenance: session audit of OpenCode loading behavior
---

# Instruction and Skill Loading Mechanics

Observed OpenCode harness behavior:

- An instruction file loads when an edited file matches its applyTo glob; the glob is the only matcher.
- A description is display-only; matching never reads it.
- The root AGENTS.md and steering messages load in every session, regardless of scope.
- A skill loads only when referenced by name (native skill tool or a <task_skills> envelope); a bare <skill> prose tag loads nothing.
- The AFK plugin emits a steering message at denial time, so a permission denial reaches the agent as harness input.

Load order and scope decide which instruction lane a change rides; a rule belongs in the file whose glob covers the files it governs.

Related: mem:refactoring/session-review/skill-loading-conventions, mem:refactoring/skills-loader-envelope-mechanism.
