# Skill-Loading Conventions

Repo-wide convention for skill loading in commands/instructions: inert `<skill name=... location=.../>` prose tags are NOT a loading mechanism and were removed from all commands/instructions.

## Honored mechanisms

- Prose instruction: "load the X skill by name using your skill tool".
- The `skills` array task argument with `<task_skills>` envelopes.
- `!` shell injection.

## "Loaded" definition (for skill counting)

- Counts as loaded: native `skill` tool call OR a `<skill>` tag inside a `<task_skills>` payload. Bare prose tags are excluded.
- UNVERIFIED: whether inert `<skill>` tags are natively expanded by the opencode core binary (plan §9 ASSUMPTION, to be observed on first restart).

Related: mem:subagent-workflows/skill-envelope-session-retrospective.