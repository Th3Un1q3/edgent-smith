# Workflow: Audit an Existing Customization Stack

Use this workflow after you have an inventory of the current customization
stack.

This workflow is for evaluation, not first-pass discovery. Audit the existing
stack for clarity, coverage, boundary discipline, and discovery quality after
you already know what files are present. If you do not yet have that inventory,
start with [scan-and-compose-existing-customizations.md](./scan-and-compose-existing-customizations.md).

## Audit Goal

Determine whether the current stack is easy to discover, correctly split across
primitives, and lean enough to maintain.

## Steps

1. Inventory the primitives.
   - List instructions, agents, skills, prompts, hooks, and any supporting
     assets they rely on.
   - Note file locations, naming, and whether descriptions clearly advertise the
     intended trigger conditions.
   - If the repo is large or messy, start with
     [scan-and-compose-existing-customizations.md](./scan-and-compose-existing-customizations.md)
     to build the inventory before scoring quality.

2. Map each asset to an ownership category.
   - Project-specific constraints and concise guidance that should auto-apply
     on repo-wide or scoped surfaces belong in instructions.
   - Task-specific workflow launchers belong in prompts.
   - Reusable technical nuance, checklists, and references belong in skills.
   - Orchestration and deciding which skill or context to load belong in
     agents.
   - Ask explicitly whether a rule should auto-apply by path, directory, file
     type, or file pattern before placing it in a skill.

3. Look for overlap and drift.
   - Find repeated guidance across instructions, prompts, skills, and agents.
   - Check whether prompts are encoding policy that should live in instructions.
   - Check whether skills are carrying stable local guidance that should be a
     scoped instruction.
   - Check whether agents contain reference material that should live in skills.
   - Check whether instructions are carrying workflow detail that should be
     on-demand.

4. Check discovery quality.
   - Review whether `description` fields include realistic user intents.
   - Check whether filenames and folder names reflect the actual behavior.
   - Verify that root skill files are short enough to route quickly.

5. Check structural correctness.
   - Confirm expected locations and file suffixes.
   - Confirm skill folders, `SKILL.md`, workflow files, reference files, and
     hook files follow the expected naming pattern.
   - Verify frontmatter exists where required and is syntactically safe.
   - For prompts, compare the body text with frontmatter: if the prompt names
     one agent or depends on one agent-specific workflow, require a matching
     `agent:` binding in frontmatter instead of relying on prose alone.
   - Confirm `applyTo` patterns are neither too narrow nor effectively global
     without reason, and that stable local rules are not hidden in skills
     instead of targeted instructions.

6. Produce a boundary-focused outcome.
   - Keep findings concrete.
   - Prefer recommendations such as move, merge, tighten, split, or delete.
   - Avoid vague suggestions like "clean up" without naming the owning
     primitive.

## Audit Findings Template

Use a flat structure so the result is actionable:

- Asset: what it is and where it lives.
- Intended role: instruction, prompt, skill, or agent.
- Observed problem: overlap, wrong location, discovery issue, bloated scope, or
  no issue.
- Recommended action: keep, tighten, move, split, merge, or remove.

## High-Value Audit Signals

- A prompt and a skill both describe the same full workflow.
- A skill is being used as the home for concise file-surface guidance that
  should auto-apply.
- A prompt says to use a specific agent, but the `.prompt.md` file has no
  matching `agent:` frontmatter.
- An agent exists, but its only job is to carry instructions.
- `applyTo` patterns are broad enough to make targeted instructions behave like
  global policy.
- Skills do not have a clear routing table or load too much detail at the root.
- Descriptions are too generic to be discoverable.