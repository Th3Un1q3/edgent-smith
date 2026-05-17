# Workflow: Initial Setup

Use this workflow to create a maintainable GitHub Copilot customization stack
for a repository.

## Goal

Set up only the customization primitives the repository actually needs, with
clear ownership boundaries and predictable file locations.

## Steps

1. Define the operating surfaces.
   - Separate project-wide constraints from task-specific workflows.
   - Decide which guidance should auto-apply when a repo or scoped surface is
     touched and which guidance should load only on demand.
   - Treat instructions as available at two levels: repo-wide or narrowly
     scoped by path, directory, file type, or file pattern.
   - Keep the mental model explicit from the start:
     - Prompt = task-specific workflow launcher.
     - Agent = orchestration and deciding which skill or context to load.
     - Skill = reusable technical nuance, checklists, and references.
     - Instruction = stable repo or surface-scoped guidance that auto-applies.

2. Start with the smallest viable infrastructure.
   - Add an instruction when the guidance should auto-apply whenever a matching
     repo surface is touched.
   - Use targeted instructions for concise rules tied to a path, directory,
     file type, or file pattern.
   - Add a skill when the repo needs reusable workflow or reference material
     that should not live in always-on instructions.
   - Use both when a concise scoped rule should auto-apply but deeper execution
     guidance or references are still useful on demand.
   - Add prompts only for repeatable entry points with a narrow goal.
   - Add agents only when orchestration, tool restrictions, or staged loading
     decisions are required.

3. Place files in their canonical locations.
   - Repository-wide instructions: `.github/copilot-instructions.md` or
     `AGENTS.md` when needed by the platform.
   - File-targeted instructions: `.github/instructions/*.instructions.md`.
   - Prompts: `.github/prompts/*.prompt.md`.
   - Agents: `.github/agents/*.agent.md`.
   - Skills: `.agents/skills/<name>/` for repo-local modular skills, with a
     short root `SKILL.md` plus `workflows/` and `references/` when the skill is
     non-trivial.

4. Write discovery-friendly descriptions.
   - Put the real trigger phrases in `description`, not only in headings.
   - Include the user intents and keywords that should cause the file to load.
   - Keep descriptions concrete enough to disambiguate overlapping assets.

5. Keep the first version thin.
   - Root skill files should route, not teach everything.
   - Instructions should point to the correct area of the repo and constrain
     behavior, not duplicate workflow detail from skills.
   - Prompts should launch one focused job, not restate global policy.
   - Agents should load or delegate, not become a dumping ground for durable
     reference content.

6. Validate the setup immediately.
   - Check file placement and naming.
   - Verify YAML frontmatter parses cleanly.
   - Confirm each primitive has one clear reason to exist.
   - Review for overlap before adding more assets.

## Setup Sequence

Use this order unless a repository already has strong conventions:

1. Add repo-level instructions for shared constraints.
2. Add file-targeted instructions for slices that need concise guidance to
  auto-apply whenever those surfaces are touched.
3. Add one modular skill for reusable workflows and references.
4. Add prompts for high-frequency entry points.
5. Add an agent only if you need orchestration or context isolation.

## Stop Conditions

Stop and reconsider the setup if:
- The same rule appears in an instruction, prompt, and skill.
- A stable path-scoped rule is being placed in a skill only because it has
  examples or nuance.
- A prompt is trying to encode durable reference content.
- An agent exists only to restate instructions.
- A skill has become a generic knowledge dump instead of a reusable playbook.