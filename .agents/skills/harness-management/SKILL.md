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
compatibility: Universal
metadata:
  version: "1.1.0"
  author: Th3Un1qu3
---

# Harness Management

The harness is the persistent guidance that shapes agent behavior: scoped instructions, skills, directory knowledge bases, and agent definitions. Use this skill to decide where a harness change belongs, then follow the matching workflow.

## Supported Harnesses (Overview)

| Scope | Homes | When it applies |
|---|---|---|
| **Universal** | `.agents/skills/<name>/`, `<directory>/AGENTS.md` | Applies to all harnesses; shared routing logic |
| **OpenCode-specific** | `.opencode/instructions/<name>.instructions.md`, `.opencode/agents/<name>.md` | OpenCode RUG only; requires `opencode` restart |
| **DeepSeek-specific** | `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, `.dsh/agent-presets/**`, `.dsh/settings.yaml` | DSH / Cordis RUG only; picked up next DSH session, no restart |

## When to Use (Universal)

Invoke this skill when:
- Deciding where a harness change belongs: instructions, skill, AGENTS.md, or agent definition.
- A repeated agent mistake or knowledge gap is best fixed by a persistent harness change.
- You need to create or update scoped instructions, a skill, a directory knowledge base, or an agent definition.
- You want to memorize a process or workflow so it is followed consistently.

## When Not to Use — scope per harness

- **Universal — not persistent guidance:**
  - One-off fixes that do not need to persist as guidance.
  - Storing transient knowledge — use `context-gathering` (memories).

- **OpenCode-specific — use dedicated tooling:**
  - opencode config mechanics — use `customize-opencode` (built-in).

- **DeepSeek-specific — handled outside harness guidance:**
  - DSH runtime secrets or model credentials — use environment or secret store, not harness files; DSH orchestration logic that belongs in runtime code, not config.

- **Out of scope:**
  - Legacy Copilot-stack customization (`.github/agents`, `.github/prompts`, `.github/instructions`) — out of scope; the harness is opencode-based and Copilot customization is no longer built.

## Change Type Reference (tagged)

| Your goal | Change type | Where it lives | Responsibility | Workflow |
|---|---|---|---|---|
| Improve quality or accuracy of editing a specific file type (markdown, code, config) | Scoped instructions | `.opencode/instructions/<name>.instructions.md` | OpenCode-specific | [workflows/scoped-instructions.md](./workflows/scoped-instructions.md) |
| Improve or memorize a process or workflow | Skill — find, modify, or create | `.agents/skills/<name>/` | Universal | [workflows/manage-skill.md](./workflows/manage-skill.md) |
| Provide scoped context for a directory and its subdirectories (key files, structure, commands, in/out of scope) | Directory knowledge base | `<directory>/AGENTS.md` | Universal | [workflows/directory-agents-md.md](./workflows/directory-agents-md.md) |
| Enhance orchestration process and principles to prevent repeated agent mistakes | Agent definition | `.opencode/agents/<name>.md` | OpenCode-specific | [workflows/agent-definition.md](./workflows/agent-definition.md) |
| Modify Cordis orchestration or RUG wiring (child runtime, agent presets) | Cordis config | `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, `.dsh/agent-presets/**` | DeepSeek-specific | [DSH Cordis docs](.dsh/README.md) — edit YAML, picked up next DSH session |
| Change DSH model, runtime, or harness settings | DSH settings | `.dsh/settings.yaml` | DeepSeek-specific | [DSH settings docs](.dsh/settings.yaml) — edit YAML, picked up next DSH session |

Starting from a diagnosis instead of a goal (e.g. a session audit finding)? Map the finding to a change type with [references/improvement-patterns.md](./references/improvement-patterns.md).

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

- DSH / Cordis changes (`.dsh/**`) require no restart — they are picked up at the next DSH session. Verify with `dsh validate` or next session run; do not request an opencode restart for DeepSeek-only changes.

## DeepSeek Harness Responsibilities (DeepSeek-specific)

DeepSeek-specific harness files govern DSH / Cordis RUG execution:

- `.dsh/cordis.patch.yml` — patches applied to the Cordis runtime at session start.
- `.dsh/child-runtime/cordis.yml` — child runtime orchestration config.
- `.dsh/agent-presets/**` — preset prompts and profiles for DSH agents.
- `.dsh/settings.yaml` — model, runtime, and harness settings for DSH.

Use these homes only for DSH / Cordis behavior. Do not place OpenCode or Universal guidance there. Keep Universal logic in `.agents/skills/` or `AGENTS.md` and reference it from DSH presets when needed.

## Prioritization — recurrence × cost, cap 1–3 (Universal)

- **Score by recurrence × cost per occurrence**: a one-off is a note in the flow's lesson record, not a harness change; a repeated or expensive failure is a harness change.
- **Cap the action-item list at 1–3** (default cap) in every flow before recording or implementing.

## Related Skills (grouped)

- **Universal:**
  - `building-modular-skills` — authoring workflow, multi-file layout, completion gate.
  - `find-skills` — discover existing skills before creating new ones.
  - `skill-creator` — create, modify, and benchmark skills.
  - `context-gathering` — store transient knowledge as memories.
  - `session-insights` — analyze session exports; its audit findings map to change types via [references/improvement-patterns.md](./references/improvement-patterns.md).

- **OpenCode-specific:**
  - `customize-opencode` (built-in) — opencode config, agents, and plugins mechanics.

- **DeepSeek-specific:**
  - DSH / Cordis — no dedicated skill; see `.dsh/README.md` and `.dsh/settings.yaml` for DSH-specific configuration. Route DSH failures through Universal skills above first (e.g., `context-gathering`, `test-design`).
