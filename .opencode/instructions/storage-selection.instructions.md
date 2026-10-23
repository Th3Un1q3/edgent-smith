---
name: storage-selection
description: "Store choice while editing agent definitions, gateway skills, memories, .tmp, or AGENTS.md."
applyTo: "{.tmp/**/*,.serena/memories/**/*.md,.opencode/agents/**/*.md,.agents/skills/serena-memory/**/*.md,AGENTS.md}"
---

# Storage Selection

Apply the ordered store test and the memory topic table in [`## STORAGE SELECTION`](../../AGENTS.md#storage-selection). For memory types, ADR frontmatter, and what may enter memory, follow `.agents/skills/serena-memory/references/frontmatter.md`.

- Experiment run state is a repository file under `experiments/`.
- A report a reviewer reads, such as an audit attached to a pull request, is a repository file.
- A one-off analysis script is `/workspace/.tmp/` and is deleted when done.
- Unverified research never enters memory; verification precedes the store choice.
