---
name: shaping
description: "Enforce modular-skill shaping budgets and audits. Use when editing any SKILL.md, workflow, or reference file."
applyTo: "{.agents/skills/**/SKILL.md,.agents/skills/**/workflows/**/*.md,.agents/skills/**/references/**/*.md,.agents/skills/**/recipes/**/*.md}"
---

# Shaping Gate

Keep skills lean and audited before you ship.

## Guidelines

- Keep root `SKILL.md` <=160 lines (hard gate); aim for ~90 lines per building-modular-skills Rule 1.
- Keep each `references/*.md` <=120 lines (hard gate - the validate-skill recipe exits non-zero above it); split a reference before it exceeds 120 lines.
- List every file in the root Task Routing Table; an unrouted file is dead weight.
- Verify every link and fence after edits; run audits before declaring the skill complete.

## Step-by-Step Workflow

1. Draft or edit the skill; check line budgets:
   ```bash
   wc -l .agents/skills/<name>/SKILL.md .agents/skills/<name>/references/*.md .agents/skills/<name>/workflows/*.md
   ```
   Expect `SKILL.md` <=160, each reference <=120; validate-skill exits non-zero above either gate.
2. Route every file in `SKILL.md` Task Routing Table; add recipes, domain scripts, templates. Do not route shared audit tooling — `agent_utils/scripts/audit_fences.py` and `validate_md_links.py` are single source per Rule 24 (Rule 8 exception).
3. Run the 3-script gate (single source in `agent_utils/scripts/`; do not copy into per-skill `scripts/`):
    ```bash
    python3 agent_utils/scripts/validate_md_links.py .agents/skills/<name>
    python3 agent_utils/scripts/audit_fences.py .agents/skills/<name>
    python3 agent_utils/scripts/validate_memory_frontmatter.py --path .agents/skills/<name>
    ```
    Or `just agent_utils::validate-skill <name>`; for serena-memory `just agent_utils::validate-memories`.
4. Run the shaping checklist `workflows/shaping-checklist.md` 24 checks; one unchecked box means NOT complete.
5. Fix every failing check; re-run until all audits exit 0 and budgets pass.

## Output Format

- Root `SKILL.md`: frontmatter `name`, `description`, `license: MIT`, `compatibility`, `metadata.version` bumped with delta note.
  - `compatibility` declares the skill scope. Use `Universal` only when NO file in the skill contains harness-specific content - no harness paths (.opencode/, .dsh/, .github/agents/), no harness tools or mechanisms described as part of what the skill does, and no dependency beyond a skill-capable environment. If anything in the skill is harness-specific, state it instead, naming canonical names from AGENTS.md in `Requires ...` form: `Requires OpenCode`, `Requires DSH`, `Requires GitHub Copilot`, `Requires OpenCode + DSH`, and for toolchain-only constraints `Requires Python 3.10+`. Never invent variants; never write a value that names nothing. A cross-reference to a repository instruction file is not by itself harness-specific.
  - `license: MIT` - the repository license; copy it verbatim.
  - `metadata.version` + delta - bump on every content change; the delta states in one line what changed and why.
- Skill content must not assert environment-specific capabilities (which harness loads skills, which model tiers exist, which plugins run) unless a repo file supports it; express such mechanisms as the outcome plus a generic fallback.
- Workflows and references: Markdown with descriptive headings; code fences include language tag and parse.

## Verify

- Confirm `wc -l` budgets hold for the edited skill.
- Confirm `agent_utils/scripts/validate_md_links.py` and `agent_utils/scripts/audit_fences.py` exit 0.
- Confirm `workflows/shaping-checklist.md` 24 checks all pass.
