---
name: serena-gateway
description: "Load when editing the gateway-using skills; routes to the serena-memory skill that owns the gateway protocol instead of restating it."
applyTo: "{.agents/skills/serena-memory/**/*.md,.agents/skills/context-gathering/**/*.md}"
---

# Serena Gateway

The gateway protocol is owned by the `serena-memory` skill and must not be restated here.

- Editing these files means loading `serena-memory` first, then pointing at its protocol instead of inlining call shapes.
- Cite memory locations as `mem:` references; never read `.serena/memories` from the filesystem.
- A permission denial is final for that action: follow `.opencode/instructions/no-permission-workarounds.instructions.md`.
- A gateway call made outside an edit is the skill's job, not this instruction's.
