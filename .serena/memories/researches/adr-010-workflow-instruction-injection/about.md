---
title: "ADR-010 workflow instruction injection — research index"
description: "Index of the verified research corpus behind ADR-010: repository instruction surfaces, OpenCode plugin API facts, ADR house conventions, best practices, and design options; supersedes four unverified reports."
tags:
  - adr-010
  - workflow-tool
  - instruction-injection
  - index
---

# ADR-010 Workflow Instruction Injection — Research Index

Corpus behind `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection`: what the repository's instruction surfaces are, what the OpenCode plugin API verifiably supports, how the house writes ADRs, and which injection mechanisms were weighed.

## Entries

- `mem:researches/adr-010-workflow-instruction-injection/repo-facts` — ADR namespace, file naming, numbering, and the workflow tool's current instruction surfaces; every claim traced to file reads, git, or gateway reads.
- `mem:researches/adr-010-workflow-instruction-injection/opencode-api-facts` — file-verified OpenCode v2 Effect plugin and v1 SDK facts for conditional injection; read the errata below before citing.
- `mem:researches/adr-010-workflow-instruction-injection/adr-best-practices` — practitioner sources on ADR structure, status lifecycle, scoring, and review failure modes.
- `mem:researches/adr-010-workflow-instruction-injection/convention-snapshot` — verbatim house convention from mem:architecture/adr-rules, mem:architecture/adr-template, and mem:architecture/about, plus registry gaps.
- `mem:researches/adr-010-workflow-instruction-injection/design-notes` — option analysis A–F, scoring dimensions, and the verified-versus-premise boundary for tool-gated session injection.

## Supersedes

This corpus replaces the earlier unverified reports `memory.md`, `repo-surfaces.md`, `edr-conventions.md`, and `opencode-api.md`. Cite the entries above instead.

## Known errata (opencode-api-facts)

1. The helper idempotency key is at `instruction-context-helper.ts:62`.
2. The v1-hook claim means those hook names appear in comments only — not a verified v1 API surface.
