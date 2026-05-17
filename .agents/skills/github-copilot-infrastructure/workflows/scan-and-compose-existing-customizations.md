# Workflow: Scan and Compose Existing Customizations

Use this workflow first when you need an inventory of the current
customizations before creating or changing anything.

This workflow is about discovery and classification: find what already exists,
decide what each file currently owns, and map one clean execution path instead
of adding overlapping guidance. It is not the scoring step; use the audit
workflow after the inventory exists.

## Outcome

Produce three things:

1. An inventory of existing customization artifacts.
2. A boundary decision for each artifact.
3. A recommended execution path that keeps launch, orchestration, guidance, and
   enforcement separate.

## Step 1: Inventory by folder first

Scan the canonical locations before reading file bodies in depth.

| What to scan | Why |
|---|---|
| `.github/copilot-instructions.md`, `AGENTS.md` | Broad repo-wide guidance |
| `.github/instructions/*.instructions.md` | Repo-surface rules that auto-apply by path, directory, file type, or file pattern |
| `.github/prompts/*.prompt.md` | Task launchers |
| `.github/agents/*.agent.md` | Orchestration layers |
| `.agents/skills/*/SKILL.md` and each skill's `workflows/` and `references/` | Reusable workflows and reference material |
| `.github/hooks/*.json` and hook config embedded in agents | Deterministic enforcement |

For each artifact, record:

- Path
- Primitive type
- Trigger sentence from `description` or title
- Scope: repo-wide auto-apply, surface-scoped auto-apply, launch-only, orchestration, reusable reference, or deterministic enforcement
- For prompts, the `agent:` frontmatter value if one exists
- For prompts, whether the body text or workflow dependency implies a specific agent
- Any obvious overlap with another artifact

## Step 2: Classify before editing

Assign every artifact one primary job.

| If the artifact mainly... | Primary owner |
|---|---|
| Auto-applies stable guidance when the repo or a matching surface is touched | Instruction |
| Starts one focused task | Prompt |
| Chooses sequence, context, or tools | Agent |
| Teaches or checks reusable domain nuance | Skill |
| Must run or block automatically | Hook |

If an artifact appears to have two jobs, do not patch around it. Split the jobs
across the right primitives.

## Step 3: Find overlap and missing links

Look for these failure modes:

- A prompt repeats repo policy that should live in instructions.
- A skill carries stable local guidance that should auto-apply through a scoped instruction.
- A prompt requires one specific agent, but that binding appears only in body
   prose and not in prompt frontmatter.
- An agent carries reference prose that belongs in a skill.
- A skill root is bloated because it is acting like both a router and a manual.
- A hook is compensating for unclear ownership instead of enforcing one narrow rule.
- A useful skill or prompt exists but nothing routes to it effectively.

Then look for missing links:

- The prompt launches work, but no agent or skill handles the deeper workflow.
- The prompt depends on a named agent, but the `.prompt.md` file lacks
   `agent: "<agent-name>"` or points at the wrong agent.
- The agent orchestrates, but there is no reusable skill backing its decisions.
- Instructions describe a repo rule, but no hook enforces the part that must be deterministic.

## Step 4: Compose one reliable execution path

Use this composition order when the stack needs multiple primitives.

1. Instructions define stable repo rules and concise scoped rules that should auto-apply.
2. A prompt launches the specific task when a reusable entry point is useful.
3. An agent orchestrates the run and decides what context or skills to load.
4. Skills provide reusable workflow detail, checklists, and references.
5. Hooks enforce deterministic behavior that should not depend on model judgment.

This order keeps each primitive narrow and makes failures easier to diagnose.

## Step 5: Decide whether to reuse, tighten, or add

Prefer these actions in order:

1. Reuse an existing asset if its ownership is already correct.
2. Tighten an existing asset if the problem is naming, description, scope, routing, or `applyTo` precision.
3. Split an overloaded asset if it mixes two responsibilities.
4. Add a new asset only when no current file can own the behavior cleanly.

Before adding or expanding a skill, ask whether the guidance should instead auto-apply on a specific surface. If yes, prefer an instruction for the concise rule and keep the skill only for deeper optional material.

When tightening a prompt that is coupled to a specific agent, fix the
frontmatter binding before editing the body text. Do not rely on prose such as
"use the X agent" as the only connection.

## Step 6: Write the recommendation in a flat format

For each relevant artifact, produce:

- Asset
- Current role
- Correct role
- Keep, tighten, split, merge, move, add, or remove
- Reason in one sentence

## Composition Heuristics

- If the same paragraph is needed in two primitives, move it to the one that truly owns it.
- If the guidance should trigger whenever matching files are read or edited, that is instruction territory even when the scope is narrow.
- If the user needs a reusable slash-command-style entry point, that is prompt territory.
- If the runtime needs branching or tool restrictions, that is agent territory.
- If the material is useful across multiple tasks but should not stay always loaded, that is skill territory.
- If failure to run the behavior would be unacceptable, that is hook territory.
- If a prompt depends on one named custom agent, record that dependency during
   the scan and require `agent:` frontmatter before treating the execution path
   as valid.

## Stop Conditions

You are done when:

- Every relevant artifact has one clear owner.
- The launch path, orchestration path, reusable guidance, and deterministic enforcement are all explicit.
- The recommendation says exactly which existing files should change before any new file is created.