# Reference: Where Files Go and What Frontmatter They Need

Use this reference after you know what kind of customization file you are
making. It answers two practical questions: where should that file live, and
what name or header fields does it need so Copilot can find it reliably?

If you are still deciding whether something should be an instruction, prompt,
agent, skill, or hook, read [responsibility-split.md](./responsibility-split.md)
first. For the frontmatter fields each file type needs, see [frontmatter-reference.md](./frontmatter-reference.md).

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
