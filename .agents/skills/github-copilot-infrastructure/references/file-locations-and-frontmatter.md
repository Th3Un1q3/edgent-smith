# Reference: Where Files Go and What Frontmatter They Need

Use this reference after you know what kind of customization file you are
making. It answers two practical questions: where should that file live, and
what name or header fields does it need so Copilot can find it reliably?

If you are still deciding whether something should be an instruction, prompt,
agent, skill, or hook, read [responsibility-split.md](./responsibility-split.md)
first.

In the examples below, placeholders such as `<skill-name>` mean "replace this
with your own name." The user prompt folder is shown as a variable because that
path depends on the editor and machine.

## Placement and Naming Rules

Start with the workspace locations when the file should be shared with the
repo. Use the personal prompt folder only when the customization is meant for
one user's own setup.

## Canonical Locations

| Customization type | Workspace location | User location | File pattern | Notes |
|---|---|---|---|---|
| Repo-wide instructions | `.github/copilot-instructions.md`, `AGENTS.md` when applicable | not typical | fixed filenames | Use for broad project constraints and navigation guidance |
| File-targeted instructions | `.github/instructions/` | `{{VSCODE_USER_PROMPTS_FOLDER}}/` when personal | `*.instructions.md` | Use `applyTo` to scope stable rules by path, directory, file type, or file pattern so they auto-apply on matching surfaces |
| Prompts | `.github/prompts/` | `{{VSCODE_USER_PROMPTS_FOLDER}}/` | `*.prompt.md` | Use for task launchers with narrow intent |
| Agents | `.github/agents/` | `{{VSCODE_USER_PROMPTS_FOLDER}}/` | `*.agent.md` | Use for orchestration and context-loading decisions |
| Hooks | `.github/hooks/` | not typical | `*.json` | Use standalone hook definitions when the workflow needs deterministic shell-backed enforcement |
| Skills | `.agents/skills/<name>/` | no common user-level equivalent | `SKILL.md` plus optional `workflows/` and `references/` | Root file should remain a router for non-trivial skills |

## Filename and Folder Requirements

Apply these rules literally when naming files so the asset is discoverable and
does not blur into another primitive.

| Customization type | Required pattern | Practical rule |
|---|---|---|
| Repo-wide instruction | `copilot-instructions.md` or `AGENTS.md` | Use only for broad guidance that deserves always-on weight |
| Targeted instruction | `<topic>.instructions.md` | Name by scope or surface, not by implementation detail; prefer it when concise guidance should auto-apply on that surface |
| Prompt | `<task>.prompt.md` | Name by the user-facing task you want someone to launch |
| Agent | `<role>.agent.md` | Name by orchestration role, not by a generic action like `helper` |
| Hook | `<event-or-policy>.json` | Name by lifecycle event or enforcement purpose |
| Skill folder | `<skill-name>/SKILL.md` | Folder name should be kebab-case and align with the `name` field in `SKILL.md` |
| Skill workflow | `workflows/<workflow>.md` | One focused step-by-step workflow per file |
| Skill reference | `references/<topic>.md` | One lookup or comparison topic per file |

## Root Skill Structure

Preferred layout for a non-trivial skill:

```text
.agents/skills/<skill-name>/
├── SKILL.md
├── workflows/
│   ├── <workflow>.md
│   └── ...
└── references/
    ├── <reference>.md
    └── ...
```

Keep `SKILL.md` short. Put step-by-step process in `workflows/` and factual
lookup material in `references/`.

## Frontmatter Expectations

### Skill frontmatter

Common fields used in this repo's skill examples:

```yaml
---
name: github-copilot-infrastructure
description: >
  Concrete summary of what the skill does and when to use it.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: GitHub Copilot
---
```

### Instruction frontmatter

Targeted instruction files typically need at least:

```yaml
---
applyTo: path/glob/**
description: Project-specific rule or navigation hint
---
```

Use `applyTo` only when the rule truly maps to a path pattern. Broad globs are
effectively always-on behavior.

Instructions are not limited to repo-wide policy. Use them when guidance should
auto-apply on stable local surfaces, including by directory, file type, or file
pattern.

### Agent and prompt frontmatter

Agent and prompt files should include a `description` that names realistic user
intents and keywords. Quote values when they contain colons or long structured
phrases.

For prompts, treat agent binding as part of the frontmatter contract, not as a
body-only convention.

```yaml
---
description: "Create one experiment from repo ideas"
agent: "edge-architect"
---
```

Use `agent:` in the prompt frontmatter when the prompt depends on a specific
agent's orchestration, tool policy, handoffs, or supporting skill-loading
behavior. Put that mapping at the top of the `.prompt.md` file, in the same
frontmatter block as `description`, not only in the prompt body.

Do not hard-bind a prompt to a custom agent when the prompt is only a generic
task launcher that can run correctly in the default chat experience or with a
built-in agent. In that case, keep the prompt portable and do not add agent
coupling unless the behavior would be wrong without it.

### Prompt-to-agent coupling rule

Treat this as a first-class failure mode:

- The prompt body says to use a specific agent, or relies on that agent's
  orchestration, but the prompt frontmatter has no `agent:` field.

That is a structural defect, not a wording nit. A reviewer should assume the
prompt can launch against the wrong runtime if the binding is missing.

Use this decision rule:

- Add `agent: "<agent-name>"` when the prompt must run through one named custom
  agent to work as intended.
- Do not add custom-agent binding when the prompt remains correct without that
  agent.
- If the prompt only needs a general agent-style runtime and not one specific
  custom agent, say so explicitly and avoid body text that names a custom agent.

Before relying on a prompt-agent pairing, verify both sides:

- The prompt frontmatter contains `agent: "<agent-name>"`.
- The named agent exists as a matching `.agent.md` file or is an intended
  built-in agent identifier.
- The prompt body does not contradict the frontmatter by naming a different
  agent.

### Hook files

Hook files are JSON rather than markdown frontmatter documents. Keep them small,
event-specific, and deterministic. If the hook is defined inline inside agent
frontmatter instead of a standalone file, keep the same rule: the hook should
enforce, not explain.

## Frontmatter Safety Checks

- Use spaces, not tabs.
- Quote complex `description` values.
- Keep `name` aligned with the skill folder name when applicable.
- Do not leave required discovery information only in headings.
- Treat malformed YAML as a first-class failure mode.

## Placement Decisions

Use this quick map when deciding where a new asset belongs:

| Need | Put it here |
|---|---|
| Team-shared repo guidance | `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md` |
| Team-shared task launcher | `.github/prompts/*.prompt.md` |
| Team-shared orchestration mode | `.github/agents/*.agent.md` |
| Team-shared reusable know-how | `.agents/skills/<name>/` |
| Team-shared deterministic enforcement | `.github/hooks/*.json` or agent hook config |
| Personal prompt, instruction, or agent | `{{VSCODE_USER_PROMPTS_FOLDER}}/` |

## Placement Rules

- Put always-on repo rules in instructions, not in skill roots.
- Put concise scoped rules that should auto-apply in targeted instructions, not in skills.
- Put launchable tasks in prompts, not in instructions.
- Put reusable technical detail in skills, not in agents.
- Put orchestration in agents, not in prompts.
- Put deterministic enforcement in hooks, not in prose files.