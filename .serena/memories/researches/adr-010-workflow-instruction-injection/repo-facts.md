---
title: "Repo facts — ADR and workflow-tool instruction surfaces"
description: "Verified repository facts on the ADR namespace, file naming, numbering, and the workflow tool's current instruction surfaces; every claim came from direct file reads, git ls-files, git status, or Serena gateway reads."
tags:
  - adr
  - workflow-tool
  - opencode
  - instruction-injection
  - verified-facts
---

# Repo Facts — ADR + workflow-tool instruction surfaces

Session scope: facts gathered by direct file reads, `git ls-files`, `git status`, and Serena gateway reads only. Nothing in this file was inferred from `edr-conventions.md` or `repo-surfaces.md`.

## VERIFIED FACTS

### (A) Repository decision-record convention

- **Directory:** ADRs live in `.serena/memories/architecture/adr/` (Serena memory namespace, gateway-mediated; not a plain `docs/` folder).
- **Tracked status:** `git ls-files .serena/memories/architecture/adr/` lists ADR-001 through ADR-009 — all nine are git-tracked.
- **Existing records:** `ADR-001-envelope-tag-detection.md`, `ADR-002-memory-system-and-structure.md`, `ADR-003-tag-delimited-structured-output.md`, `ADR-004-workflow-timeout-units-minutes.md`, `ADR-005-multi-agent-orchestration-strategy.md`, `ADR-006-portable-agent-devkit.md`, `ADR-007-testing-and-cicd-contract-for-agent-devkit.md`, `ADR-008-goal-stack-continuation.md`, `ADR-009-skill-usage-heuristics.md`.
- **File naming:** `ADR-<three-digit id>-<kebab-case-slug>.md` (all nine observed names follow it).
- **Next number:** the highest existing id is 009, so a new record is **ADR-010**. (Direct numbering-rule text was truncated at "Ids are se…".)
- **Convention file:** memory `architecture/adr-rules` (exists; read via gateway).
- **Template file:** memory `architecture/adr-template` (exists per `list_memories`).
- **Verbatim `adr-rules` excerpt (start of memory):**

  > # ADR Rules
  >
  > Conventions for writing and maintaining Architecture Decision Records (domain: `mem:architecture/about`; skeleton: `mem:architecture/adr-template`).
  >
  > - Write an ADR when a non-trivial architecture/design decision has ≥2 viable options with trade-offs (one ADR per decision).
  > - Ids are se[…]   ← retrieval truncated here

- **Working copies:** `.tmp/adr/` holds temporary copies (`ADR-008-goal-stack-continuation.md`, `ADR-009-skill-usage-heuristics.md`). These are scratch artifacts, **not** the canonical records.
- **Working-tree state:** `git status --porcelain` reports exactly one entry: ` M .serena/memories/architecture/adr/ADR-008-goal-stack-continuation.md`.

### (B) Current instruction surfaces for the workflow tool

#### B1. Tool registration — `.opencode/plugins/workflow.ts` (tracked, live)

- Registration site: **L91–L115**. Plugin `id: 'opencode.workflow'`; OpenCode v2 Effect plugin API.
- Verbatim (L94–L98):

  ```ts
  yield* context.tool.transform((editor) => {
    editor.add({
      name: 'workflow',
      description: WORKFLOW_TOOL_DESCRIPTION,
      input: WORKFLOW_INPUT,
  ```
- Input schema: `WORKFLOW_INPUT` at **L54–L64** (`script` required; `timeout_minutes`, `max_concurrent`, `max_subtasks`; `additionalProperties: false`).

#### B2. Tool description — same file

- `WORKFLOW_TOOL_DESCRIPTION` spans **L16–L52** (36 array elements joined with `\n`) — not a short one-liner.
- Verbatim (L17–L19):

  ```
  'Execute a JavaScript workflow script that orchestrates subagents.',
  'The script runs with two helpers: subtask and log.',
  '',
  ```
- The description itself documents `subtask`/`log`, per-subtask timeout, result envelope, the script guard, and envelope statuses (`ok | error | timeout | aborted | budget_exceeded | invalid_script | forbidden_script`) at L46–L47.
- It contains **no** instruction-loading or skill-injection guidance beyond per-subtask `skills` (L29).

#### B3. Agent definitions and tool declaration

- **Not verified body-level.** `.opencode/agents/rug-workflow.md` and `.opencode/agents/rug-swe.md` were not read in this session.
- Verified indirectly: `.opencode/plugins/config/harness.config.ts` **L51–L57** declares goal-first enforcement for `agents: ['rug', 'rug-workflow']` (`enforceAll: false`, opt-in via that list).
- The mechanism by which an agent declares its tool set (frontmatter permissions) is **unverified**.

#### B4. Dynamic instruction-injection mechanisms

- **`.opencode/plugins/instructions-loader.ts` — live, tracked, NOT quarantined.**
  - Plugin id `opencode.instructions-loader` (L58–L59), OpenCode v2 Effect plugin.
  - Injection trigger: `context.tool.hook('execute.before', …)` at **L84**, for tools in `TARGETED_TOOLS` acting on a file path.
  - Registry: builds a per-agent index over `.opencode/instructions/*.instructions.md` (L66–L71), via `InstructionContextHelper` (L72–L77).
  - Dedupe/budget: `context.storage` token keys (`instruction_load:<path>:full|ref`, L93–L96, L117–L121) with `FULL_SLOT_BUDGET`.
  - Delivery: `context.session.prompt({ sessionID, text: <steering …>, resume: false })` at **L114**, then queued under `pendingKey` and flushed by `context.session.hook('context', …)` pushing `{ type: 'text', text: pending }` into `event.system` at **L124–L128**.
  - Message shape (L55–L56): `<steering priority="high" reason="relevant files touched" type="instructions">…</steering>`.
- **Test:** `.opencode/plugins/tests/instructions-loader.test.ts` — live, tracked (5,693 bytes).
- **No skills-loader or code-mode plugin exists in `.opencode/plugins/`.** Live entries: `AGENTS.md`, `config/`, `goal-continuation.ts`, `helpers/`, `instructions-loader.ts`, `quality-gate-enforcer.ts`, `sessions/`, `tests/`, `tool-limit-reminder.ts`, `types/`, `workflow.ts`. Per-subtask skill loading is handled inside the workflow runner, not by a separate loader plugin (as documented in B2).

#### B5. Presence of a quarantine directory

- `.opencode/plugins-quarantine/` **does not exist** (`ls` → no such directory).
- `git status --porcelain` shows **no deletions**, so no plugin/test was tracked and then removed.

## UNVERIFIED / OPEN

- `adr-rules` remainder: index/registry update requirement, allowed status vocabulary, front-matter requirements, section order (Decision-before-`## Considerations` claim), and numbering text were truncated; **not verified**.
- `adr-template` headings: not read verbatim; **no template headings can be quoted**.
- ADR bodies: no existing record body (ADR-005/009) was read; front-matter and section structure **unverified**.
- Lint/verification gates for ADRs: unverified. Candidate is `agent_utils/scripts/validate_memory_frontmatter.py` / `just agent_utils::validate-memories`; whether it applies to ADRs or enforces `{proposed, accepted, superseded}` was **not** checked this session.
- `.opencode/agents/rug-workflow.md` permissions, `.opencode/agents/rug-swe.md` L5–L15, and the agent tool-declaration mechanism: **unread**.
- `repo-surfaces.md` §6 row 1 (`.opencode/plugins/AGENTS.md` ordering content): the file exists (2,088 bytes) but its content was **not read**; claim neither confirmed nor refuted.
- `opencode-api.md` Finding 0 (v2 vs v1 hook surface): only `workflow.ts` and `instructions-loader.ts` were inspected and both use v2 Effect; the other three plugins were **not** inspected.
- `memory.md` rug-workflow permission list and `adr-best-practices.md` author name: **not verified**.

## CORRECTIONS

### Against `edr-conventions.md`

1. **Wrong path.** The report cites `config/harness.config.ts`. The actual file is **`.opencode/plugins/config/harness.config.ts`** (verified by `ls` and full read).
2. **Content was right.** `goalEnforcement.agents` is indeed `['rug', 'rug-workflow']` (L51–L57), so only the path needs correcting.

### Against `repo-surfaces.md`

3. **No claim in this report was independently verified this session.** Its §6 ordering claim and §3.2 `rug-swe.md` line range remain **unchecked**; treat both as open, not as fact. (Not a refutation — an absence of evidence.)

### Additional corrections observed (outside the two named reports)

4. **`memory.md`** cites `.opencode/plugins-quarantine/instructions-loader.ts` and `…/tests/instructions-loader.test.ts` as git-index evidence. **Refuted:** no `plugins-quarantine` directory exists, the loader and its test are live under `.opencode/plugins/`, and `git status` reports no deletion.
5. **`opencode-api.md`** §7.1 calls the tool description "short (as today)". **Refuted:** `WORKFLOW_TOOL_DESCRIPTION` is a 36-line block at L16–L52.