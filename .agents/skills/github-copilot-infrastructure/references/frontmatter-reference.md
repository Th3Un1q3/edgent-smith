# Reference: Frontmatter Reference

## Frontmatter Expectations

### Skill frontmatter

Common fields used in this repo's skill examples:

```yaml
---
name: github-copilot-infrastructure
description: >
  Concrete summary of what the skill does and when to use it.
license: MIT
compatibility: Universal  # only when no file in the skill has harness-specific content; else `Requires <canonical harness>`
metadata:
  version: "1.0.0"
  author: GitHub Copilot
---
```

`compatibility` is `Universal` only when no file in the skill contains harness-specific content; otherwise name the required harness in `Requires ...` form. See [building-modular-skills anti-patterns](../../building-modular-skills/references/anti-patterns.md) section 11.

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
