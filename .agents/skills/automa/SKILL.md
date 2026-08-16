---
name: automa
description: >
  Author, read, and troubleshoot Automa workflows — the browser extension that automates the web
  by connecting blocks into workflows: write workflow JSON, choose and connect blocks, analyze
  existing .automa.json files, fix failing automations. Trigger on: "build an automa workflow",
  "create an automa workflow", "automa workflow json", "automa block", "what does this automa
  workflow do", "my automa workflow is not working", "automa node", or any request to automate
  a browser with Automa — even if they don't say "Automa" explicitly. Not for plain browser
  automation without Automa (use context-gathering's devtools workflows), non-Automa workflow
  tools (conductor YAML workflows, n8n, Zapier), or writing browser extensions.
license: MIT
compatibility: Universal
metadata:
  version: "1.1.0"
  delta: "1.1.0 — added session lessons to design-patterns.md (rebind active tab after close-tab; JSON-LD-first extraction with bounded hydration polling; href normalization for relative/tracking URLs; verify selectors against the live page; URL filter params over UI clicks; 5 new anti-pattern rows), troubleshoot-workflow.md (close-tab tab-orphan row, fragment, step-4 checklist item) and create-workflow.md pre-flight selectors bullet (extractor markdown lies, JSON-LD pointer). 1.0.0 — initial draft from Automa docs + source research (AutomaApp/automa @ main); refined through validation-fix rounds (schema-corrected examples, consistency and vocabulary alignment); meta-commentary removed (Implements labels, provenance markers, source-anchor sections) per review; removed author-facing Completion Gate from reader path per review"
  author: Th3Un1qu3
---

# Automa

Automa automates the web through workflows built from connected blocks. This skill authors, reads, and troubleshoots those workflows — the .automa.json format and the block-based design behind it. Use it to create new workflows, analyze existing ones, and fix broken automations.

## When to Use This Skill

Invoke this skill when:
- You build an Automa workflow as JSON — blocks, edges, exports.
- You design workflows — choose blocks, connect nodes, manage state.
- You read or analyze an existing .automa.json file.
- You troubleshoot a failing or misbehaving workflow.

## When Not to Use This Skill

Do not use this skill for:
- Plain browser automation without Automa — use context-gathering's devtools workflows instead.
- Non-Automa workflow tools — conductor YAML workflows, n8n, Zapier.
- Writing browser extensions.

## Principles

- **Verify every workflow JSON against the schema before emitting it.** Rules: [references/workflow-json-schema.md](./references/workflow-json-schema.md).
- **Ground every block choice in the block catalog.** Catalog: [references/block-reference.md](./references/block-reference.md).
- **Treat connections as the contract:** every output handle must resolve to an existing input. Practice: [references/design-patterns.md](./references/design-patterns.md).
- **Prefer state through variables and global data; reserve the table for structured row data.** Details: [references/state-and-expressions.md](./references/state-and-expressions.md).
- **Diagnose from logs before guessing:** workflow logs and testing mode show the failure. Procedure: [workflows/troubleshoot-workflow.md](./workflows/troubleshoot-workflow.md).

## Vocabulary

- **block:** one automation step — trigger, action, or logic unit — in an Automa workflow.
- **handle:** a connection point on a block; output handles feed input handles of downstream blocks.
- **drawflow:** the visual canvas engine that renders and runs the block graph.

## Task Routing Table

| I want to... | File |
|---|---|
| Author a workflow as JSON, step by step | [workflows/create-workflow.md](./workflows/create-workflow.md) |
| Read and analyze an existing .automa.json workflow | [workflows/understand-workflow.md](./workflows/understand-workflow.md) |
| Diagnose and fix a failing workflow | [workflows/troubleshoot-workflow.md](./workflows/troubleshoot-workflow.md) |
| Look up the workflow JSON schema — top-level fields, nodes, edges, export/import | [references/workflow-json-schema.md](./references/workflow-json-schema.md) |
| Look up the block catalog — categories, labels, key options | [references/block-reference.md](./references/block-reference.md) |
| Look up state and expressions — variables, table, globalData, secrets, loopData, interpolation, functions | [references/state-and-expressions.md](./references/state-and-expressions.md) |
| Apply design best practices — node selection, connecting, state, error handling | [references/design-patterns.md](./references/design-patterns.md) |
| Run the eval test cases | [evals/evals.json](./evals/evals.json) |

## Scripts

| I want to... | Command |
|---|---|
| Validate a workflow's structure (nodes, edges, handles, loop pairs) | [scripts/validate_workflow.py](./scripts/validate_workflow.py) `<workflow.json>` |
| Syntax-check javascript-code blocks in a workflow | [scripts/check_workflow_code.py](./scripts/check_workflow_code.py) `<workflow.json>` |
| Hash a workflow / check integrity | [scripts/hash_workflow.py](./scripts/hash_workflow.py) `<workflow.json>` |
| Normalize conditions to the modern serialization | [scripts/conditions_normalize.py](./scripts/conditions_normalize.py) `<workflow.json>` |
| Summarize a workflow (envelope + counts) | [scripts/analyze_workflow.py](./scripts/analyze_workflow.py) `<workflow.json>` |
| Regenerate / validate the eval suite | [scripts/gen_evals.py](./scripts/gen_evals.py), [scripts/validate_evals.py](./scripts/validate_evals.py) |
| Check skill docs (json fences, links, residual patterns) | [scripts/check_docs.py](./scripts/check_docs.py) |

All scripts are stdlib-only (json, re, sys, argparse, hashlib, pathlib, subprocess, collections) and take workflow/document paths via argparse — nothing is hardcoded. One reusable validation technique worth remembering: verify javascript-code blocks by substituting `{{variables}}` interpolation with literals, wrapping in automa's non-async IIFE, and running `node --check`.

## Related Skills

- `context-gathering` — web research and devtools browser automation; the adjacent tool for plain browser automation without Automa.
- `skill-creator` — evals and benchmarking of skills.
- `building-modular-skills` — authoring and shaping skills.
