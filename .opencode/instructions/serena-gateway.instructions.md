---
name: serena-gateway
description: "Load when editing the gateway-using skills: load the serena-memory skill first, then follow its protocol instead of inlining call shapes."
applyTo: "{.agents/skills/serena-memory/**/*.md,.agents/skills/context-gathering/**/*.md}"
---

# Serena Gateway

Load the `serena-memory` skill before editing any file this instruction matches, then follow `.agents/skills/serena-memory/references/gateway-protocol.md`; do not inline gateway call shapes.

- Cite memory locations as `mem:` references; never read `.serena/memories` from the filesystem.
- A permission denial is final for that action: follow `.opencode/instructions/no-permission-workarounds.instructions.md`.
- For a gateway call outside an edit, load `serena-memory` and follow its protocol.
