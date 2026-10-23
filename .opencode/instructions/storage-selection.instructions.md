---
name: storage-selection
description: "Store choice while editing agent definitions, gateway skills, memories, .tmp, or AGENTS.md."
applyTo: "{.tmp/**/*,.serena/memories/**/*.md,.opencode/agents/**/*.md,.agents/skills/serena-memory/**/*.md,AGENTS.md}"
---

# Storage Selection

The ordered store test and the memory topic table are owned by [`## STORAGE SELECTION`](../../AGENTS.md#storage-selection). Memory types, ADR frontmatter, and what may enter memory are owned by the `serena-memory` skill (`.agents/skills/serena-memory/references/frontmatter.md`).

- Experiment run state is a repository file under `experiments/`.
- A report a reviewer reads, such as an audit attached to a pull request, is a repository file.
- A one-off analysis script is `/workspace/.tmp/` and is deleted when done.
- Unverified research never enters memory; verification precedes the store choice.
