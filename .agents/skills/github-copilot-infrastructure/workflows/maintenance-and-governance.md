# Workflow: Maintenance and Governance

Use this workflow for ongoing upkeep after the customization stack already
exists.

This is the lightweight routine for keeping the stack small, accurate, and easy
to understand as the repo changes. It is different from the initial scan, which
builds the inventory, and from the audit, which evaluates the current stack in
depth.

## Maintenance Cadence

Run this workflow when a new customization is proposed, after a recurring agent
failure, or during regular cleanup.

## Steps

1. Reconfirm ownership before editing.
   - Ask which primitive should own the change.
  - Ask first whether the guidance should auto-apply on a repo-wide or scoped
    surface before placing it in a skill.
   - Move content instead of duplicating it when the answer changes.
   - Default to the smallest existing primitive that can express the behavior.

2. Review the discovery surfaces.
   - Check `description` fields for current trigger phrases.
   - Remove stale examples or tool names that no longer match actual usage.
   - Tighten broad wording that causes over-matching.

3. Prune overlap.
   - Keep instructions focused on project constraints, navigation, and concise
     scoped rules that should auto-apply.
   - Keep prompts focused on launching a specific task.
   - Keep skills focused on reusable implementation nuance, checklists, and
     references.
   - Keep agents focused on orchestration, delegation, and loading decisions.

4. Keep file placement stable.
   - Avoid moving assets unless the current location is incorrect or actively
     confusing.
   - If a skill grows, split it into workflow or reference files rather than
     expanding the root `SKILL.md`.
   - If file-targeted rules keep spreading, tighten `applyTo` patterns before
     adding more instruction files.

5. Validate changes at the boundary they affect.
   - For instructions, check applicability, scope, and whether they are the
     correct owner for stable local guidance.
   - For skills, confirm the root file remains a router and linked files are
     specific.
   - For prompts, verify the task is still singular and parameter-friendly.
   - For agents, verify the orchestration path still needs a distinct agent.

6. Record practical governance decisions in the content itself.
   - Prefer explicit guardrails over tribal knowledge.
   - State what a file is not for, not only what it is for.
   - Keep examples tied to recurring repo needs.

## Lightweight Governance Rules

- One durable concept, one owning primitive.
- Prefer editing existing assets over adding new ones.
- Do not broaden always-on instructions to avoid updating a skill.
- Do not expand a skill when a targeted instruction should own the concise
  auto-apply rule.
- Do not create a custom agent when a prompt plus existing instructions is
  enough.
- Treat root `SKILL.md` bloat as a maintenance smell.

## Review Questions

Use these questions during maintenance:
- If this file disappeared, what behavior would be lost?
- Is that behavior repo-wide auto-apply, surface-scoped auto-apply, reusable, or task-launched?
- Could the same outcome be achieved by tightening an existing asset?
- Does the current description help the right file load and the wrong files stay
  unloaded?