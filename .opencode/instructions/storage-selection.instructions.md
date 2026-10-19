---
name: storage-selection
description: "Repository-specific storage mapping for this project."
applyTo: "{.tmp/**/*,.serena/memories/**/*.md,.opencode/agents/**/*.md,.agents/skills/serena-memory/**/*.md,AGENTS.md}"
---

# Storage Selection

`AGENTS.md` -> [`## STORAGE SELECTION`](../../AGENTS.md#storage-selection) is the canonical rule.

## Store mapping

| Content | Store | Location |
|---|---|---|
| Decisions and rationale, including ADRs | memory | `architecture/adr` |
| Verified research and provenance | memory | `researches/<topic>` |
| Product docs, code, tests and config | repository file | normal paths |
| Experiment run state | repository file | `experiments/` |
| Drafts, intermediates and regenerable output | scratch | `/workspace/.tmp/` |

## Examples

- A new ADR goes to memory under `architecture/adr`, matching the ADR records already stored there and the ADR rules kept with them.
- An audit report attached to a pull request is a repository file because a reviewer reads it.
- A one-off analysis script is `.tmp/` and is deleted when done.

## Anti-patterns

- Writing unverified research into memory.
