---
name: harness-management
description: >-
  Route harness changes to the right place: scoped instructions in
  .opencode/instructions/, skills in .agents/skills/, directory knowledge bases
  in AGENTS.md, or agent definitions in .opencode/agents/. Use when a repeated
  agent mistake or knowledge gap is best fixed by a persistent harness change,
  when you need to create or update scoped instructions, a skill, a directory
  knowledge base, or an agent definition, or when you want to memorize a process
  or workflow so it is followed consistently. Not for one-off fixes that do not
  need to persist, opencode config mechanics, or transient knowledge.
license: MIT
compatibility: Requires OpenCode + DSH + GitHub Copilot
metadata:
  version: "1.4.1"
  delta: |
    1.4.1 — repointed manage-skill.md link validation from the removed per-skill building-modular-skills/scripts path to the shared agent_utils/scripts tooling and `just agent_utils::validate-skill`.
    1.4.0 — repointed Rule 25 citations to references/guidance-process.md; renamed references/portability-checklist.md to references/harness-change-checklist.md and cross-referenced the building-modular-skills Shaping Checklist.
    1.0.0 — initial harness management skill
    1.1.0 — routed session-audit findings via references/improvement-patterns.md; referenced session-insights
    1.1.1 — compatibility label: Requires OpenCode + DSH + GitHub Copilot.
    1.1.2 — pointer to the building-modular-skills reference-direction rule added after the Change Type Reference.
    1.2.0 — added the six-rule Placement Decision List (compact table in SKILL.md, expanded references/placement-rules.md); root AGENTS.md added to Supported Homes; reference-direction pointer keeps placement ownership; manage-skill creation routing and directory rule-6 framing fixed; memories route to serena-memory.
    1.3.0 — added workflows/dedupe-verification.md (consolidation/dedupe/move verification with an information-loss audit); routed it in the Task Routing Table.
  author: Th3Un1qu3
---

# Harness Management

The harness is the persistent guidance that shapes agent behavior: scoped instructions, skills, directory knowledge bases, and agent definitions. Use this skill to decide where a harness change belongs, then follow the matching workflow.

## Placement Decision List (first match wins)

Apply the first rule that matches; a domain-governing skill overrides (see Domain Match). Expanded triggers, counter-examples, and workflow links: [references/placement-rules.md](./references/placement-rules.md).

| # | Trigger | Home |
|---|---|---|
| 1 | Permanent behavior for the whole repo — every task, every agent | root `/workspace/AGENTS.md` |
| 2 | Permanent behavior for one agent (identity, workflow, tools, permissions, anti-patterns) | `.opencode/agents/<name>.md` |
| 3 | Guidance applied only while editing certain files or file types (`applyTo` / `excludePaths`) | `.opencode/instructions/<name>.instructions.md` |
| 4 | Knowledge, not behavior, about a directory and its contents | that directory's `AGENTS.md` |
| 5 | Behavior crossing several concerns, or situational but repeatable | `.agents/skills/<name>/` |
| 6 | A learning/knowledge that cannot yet become a solid, reusable skill | a Serena memory (`serena-memory`) |

## Supported Homes — Harnesses and Runtimes (Overview)

| Scope | Homes | When it applies |
|---|---|---|
| **Shared (with per-harness realization)** | `.agents/skills/<name>/`, `AGENTS.md (root / directory)` | `.agents/skills/` loads in OpenCode and DSH; GitHub Copilot has no skill loader — see per-harness-compile.md for details. Root `/workspace/AGENTS.md` is injected project-wide; `<directory>/AGENTS.md` is scoped to its subtree. |
| **OpenCode-specific** | `.opencode/instructions/<name>.instructions.md`, `.opencode/agents/<name>.md` | OpenCode RUG only; requires `opencode` restart |
| **DeepSeek-specific** | `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, `.dsh/.agent-presets/**`, `.dsh/settings.yaml` | DSH / Cordis RUG only; place only DSH / Cordis behavior here; picked up next DSH session, no restart |
| **GitHub Copilot-specific** | `.github/agents/*.agent.md`, `.github/prompts/*.md`, `.github/instructions/*.instructions.md`, `.github/copilot-instructions.md` | GitHub Copilot Chat only; read by the agent and prompt picker |

Conductor and System A are not harnesses. Conductor (`scripts/conductor/`) is a scaffold (YAML + CLI planned); System A (`agents/edge.py`, `config.py`) is a harness-free runtime that builds one `pydantic_ai.Agent` with inline tools. Neither has a skill loader or hook layer: deliver guidance as plain files the workflow author reads, and name the verifier — a human or a CI job running the repo `just` gates.

## When to Use (Universal)

Invoke this skill when:
- Deciding where a harness change belongs: instructions, skill, AGENTS.md, or agent definition.
- A repeated agent mistake or knowledge gap is best fixed by a persistent harness change.
- You need to create or update scoped instructions, a skill, a directory knowledge base, or an agent definition.
- You want to memorize a process or workflow so it is followed consistently.

## When Not to Use — scope per harness

- **Universal — not persistent guidance:**
  - One-off fixes that do not need to persist as guidance.
  - Storing transient research — use `context-gathering`; a learning not yet a solid skill — use `serena-memory` (memories).

- **OpenCode-specific — use dedicated tooling:**
  - opencode config mechanics — use `customize-opencode` (built-in).

- **DeepSeek-specific — handled outside harness guidance:**
  - DSH runtime secrets or model credentials — use environment or secret store, not harness files; DSH orchestration logic that belongs in runtime code, not config.

- **GitHub Copilot-specific — driven from the repo files:**
  - GitHub Copilot customization is hand-authored under `.github/agents/`, `.github/prompts/`, `.github/instructions/`, and `.github/copilot-instructions.md`. New shared file-type instructions live in `.opencode/instructions/`; keep `.github/` for GitHub Copilot custom agents (`.github/agents/*.agent.md`), prompts, and instructions.

## Change Type Reference (tagged)

| Your goal | Change type | Where it lives | Responsibility | Workflow |
|---|---|---|---|---|
| Improve quality or accuracy of editing a specific file type (markdown, code, config) | Scoped instructions | `.opencode/instructions/<name>.instructions.md` | OpenCode-specific | [workflows/scoped-instructions.md](./workflows/scoped-instructions.md) |
| Improve or memorize a process or workflow | Skill — find, modify, or create | `.agents/skills/<name>/` | Universal | [workflows/manage-skill.md](./workflows/manage-skill.md) |
| Provide scoped context for a directory and its subdirectories (key files, structure, commands, in/out of scope) | Directory knowledge base | `<directory>/AGENTS.md` | Universal | [workflows/directory-agents-md.md](./workflows/directory-agents-md.md) |
| Enhance orchestration process and principles to prevent repeated agent mistakes | Agent definition | `.opencode/agents/<name>.md` | OpenCode-specific | [workflows/agent-definition.md](./workflows/agent-definition.md) |
| Modify Cordis orchestration or RUG wiring (child runtime, agent presets) | Cordis config | `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, `.dsh/.agent-presets/**` | DeepSeek-specific | [DSH Cordis docs](../../../.dsh/README.md) — edit YAML, picked up next DSH session |
| Change DSH model, runtime, or harness settings | DSH settings | `.dsh/settings.yaml` | DeepSeek-specific | [DSH settings docs](../../../.dsh/settings.yaml) — edit YAML, picked up next DSH session |
| Enforce a recurring rule on an event instead of agent recall | Passive hook | `.opencode/plugins/*.ts`, `.opencode/plugins/helpers/**` | OpenCode-specific | [workflows/passive-hooks.md](./workflows/passive-hooks.md) |
| Keep one skill source and generate harness variants without drift | Per-harness compile | `.agents/skills/<name>/` (source) to `.opencode/**`, `.dsh/**`, `.github/**` (variants) | Universal; variants for OpenCode, DSH, and GitHub Copilot | [workflows/per-harness-compile.md](./workflows/per-harness-compile.md) |

Enforcement: OpenCode plugin + CI runs the gates on edits and sessions. Every other home has no enforcement layer — name the verifier: a human who runs the command, or a CI job on the repo.

When a skill needs a rule at execution time, place the rule in the skill (skills self-contain and never depend on reading an instruction). Authoring detail: `building-modular-skills`, "Reference direction" in references/guidance-process.md Rule 25. Starting from a diagnosis instead of a goal (e.g. a session audit finding)? Map the finding to a change type with [references/improvement-patterns.md](./references/improvement-patterns.md).

## Task Routing Table

Every file in this skill appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Decide where a change belongs (six-rule decision list) | [references/placement-rules.md](./references/placement-rules.md) |
| Write or change a scoped file-type instruction | [workflows/scoped-instructions.md](./workflows/scoped-instructions.md) |
| Find, modify, or create a skill | [workflows/manage-skill.md](./workflows/manage-skill.md) |
| Write or update a directory AGENTS.md | [workflows/directory-agents-md.md](./workflows/directory-agents-md.md) |
| Modify an agent definition | [workflows/agent-definition.md](./workflows/agent-definition.md) |
| Verify a harness change before it lands | [workflows/harness-verify.md](./workflows/harness-verify.md) |
| Verify a consolidation/dedupe or move change | [workflows/dedupe-verification.md](./workflows/dedupe-verification.md) |
| Route a rule to a passive plugin hook | [workflows/passive-hooks.md](./workflows/passive-hooks.md) |
| Compile a skill to harness variants | [workflows/per-harness-compile.md](./workflows/per-harness-compile.md) |
| Map a session-audit finding to a change type | [references/improvement-patterns.md](./references/improvement-patterns.md) |
| Verify a harness change before shipping it | [references/harness-change-checklist.md](./references/harness-change-checklist.md) |

## Domain Match — route by where the failure occurred (Universal principle, harness-specific fallbacks)

For a recurring failure, the harness change belongs in the SKILL that governs the DOMAIN where the failure occurred: automa failures → the `automa` skill; research/investigation failures → `context-gathering`; test failures → `test-design`; delegation-prompt failures → `task-delegation`. Generic homes — scoped instructions, root `AGENTS.md`, agent definitions — are fallbacks, not defaults; use them only when no skill governs the domain.

- **Verify the domain before implementing.** Confirm the chosen home's domain matches the failing work's domain; if it doesn't, re-route to the skill that governs the failure.
- **On rejection, re-evaluate the domain match.** When a harness change is itself rejected or mis-scoped, re-examine which domain the failure belongs to and re-route there — do not just relocate the same content to another generic home.

## Workflow (split)

### Universal (steps 1–3)

1. Decide which change type(s) fit your case and objectives using the Change Type Reference table — for recurring failures, first apply [Domain Match — route by where the failure occurred (Universal principle, harness-specific fallbacks)](#domain-match--route-by-where-the-failure-occurred-universal-principle-harness-specific-fallbacks) above.
2. Read the workflow file(s) for the change type(s) you selected.
3. Execute the changes as the workflow describes.

### OpenCode-specific (step 4)

4. Ask for an opencode restart to apply the changes — agents, plugins, and skills load at server start.

### DeepSeek-specific

- DSH / Cordis changes (`.dsh/**`) require no restart — they are picked up at the next DSH session. Verify with `dsh --profile web --dump-config` or the next session run; do not request an opencode restart for DeepSeek-only changes.

### GitHub Copilot-specific

- GitHub Copilot reads its `.github/` files directly; no restart is needed.

## Prioritization — recurrence × cost, cap 1–3 (Universal)

- **Score by recurrence × cost per occurrence**: a one-off is a note in the flow's lesson record, not a harness change; a repeated or expensive failure is a harness change.
- **Cap the action-item list at 1–3** (default cap) in every flow before recording or implementing.

## Related Skills (grouped)

- **Universal:**
  - `building-modular-skills` — authoring workflow, multi-file layout, completion gate.
  - `find-skills` — discover existing skills before creating new ones.
  - `skill-creator` — create, modify, and benchmark skills.
  - `serena-memory` — typed persistent memory for learnings not yet ready to become a skill.
  - `context-gathering` — transient research cache.
  - `session-insights` — analyze session exports; its audit findings map to change types via [references/improvement-patterns.md](./references/improvement-patterns.md).

- **OpenCode-specific:**
  - `customize-opencode` (built-in) — opencode config, agents, and plugins mechanics.

- **DeepSeek-specific:**
  - DSH / Cordis — no dedicated skill; see `.dsh/README.md` and `.dsh/settings.yaml` for DSH-specific configuration. Route DSH failures through Universal skills above first (e.g., `context-gathering`, `test-design`).
