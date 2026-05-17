# Reference: Patterns and Heuristics

Use these heuristics to keep a GitHub Copilot customization stack practical and
maintainable.

## Core Patterns

1. Start from the smallest primitive that fits.
   - Prefer adjusting an existing instruction, prompt, agent, or skill over
     adding a new one.
   - Add a new primitive only when the current owner would become misleading.

2. Keep durable policy separate from on-demand guidance.
  - Instructions should carry stable project constraints and concise guidance
    that should auto-apply on matching surfaces.
   - Skills should carry reusable nuance that is expensive to keep always-on.

3. Treat the root `SKILL.md` as a router.
   - Keep it short, keyword-rich, and explicit about applicability.
   - Move process detail into workflow files and lookup material into reference
     files.

4. Use descriptions as the discovery interface.
   - Write for how users actually ask.
   - Include trigger phrases, tool names, and task names that should match.
   - Remove generic wording that causes accidental overlap.

5. Prefer relocation over repetition.
   - If guidance appears in two primitives, choose the correct owner and move
     it.
   - Repetition hides ownership mistakes and makes maintenance harder.

## Boundary Heuristics

| If the content is... | Put it in... | Because... |
|---|---|---|
| A repo rule, navigation constraint, or concise surface-specific rule that should auto-apply | Instruction | It should apply automatically and consistently when the matching work is touched |
| A one-shot entry point for a user task | Prompt | It launches work rather than storing durable guidance |
| A reusable playbook or lookup table | Skill | It should load only when relevant |
| A decision about which guidance to load next | Agent | It is orchestration logic |

## Heuristics for Keeping Boundaries Clean

- If the same text is copied into a prompt and an instruction, the split is
  wrong.
- If a skill contains stable file-surface guidance that should fire whenever
  those files are touched, the split is wrong.
- If a skill has no reusable content beyond a single launch action, it may
  actually be a prompt.
- If an agent has no branching or selection responsibility, it may not need to
  exist.
- If an instruction needs many examples and long procedures, the deeper material
  likely belongs in a skill.
- If an `applyTo` pattern effectively targets the whole repo, confirm that the
  content truly deserves always-on status.

## Decision Shortcut

- If guidance should auto-apply whenever a specific surface is touched, prefer an instruction.
- If guidance is richer optional workflow or reference material, prefer a skill.
- If both are true, keep the concise rule in an instruction and the deeper execution guidance in a skill.

## Repo-Aligned Working Rules

- Prefer minimal, local changes over introducing new customization layers.
- Keep folder and file names intent-revealing.
- Use workflow files for step-by-step playbooks and reference files for lookup
  material.
- Make "when not to use this" explicit to reduce accidental loading.