---
name: shaping
description: "Enforce modular-skill shaping budgets and audits. Use when editing any SKILL.md, workflow, or reference file."
applyTo: ".agents/skills/**/SKILL.md,.agents/skills/**/workflows/**/*.md,.agents/skills/**/references/**/*.md,.agents/skills/**/recipes/**/*.md"
---

# Shaping Gate

Keep skills lean and audited before you ship.

## Guidelines

- Keep root `SKILL.md` ≤160 lines (budget) and ≤90 lines per building-modular-skills Rule 1; push detail to `references/` and `workflows/`.
- Keep each `references/*.md` ≤120 lines; split a reference over 250 lines unless it is the rules reference.
- List every file in the root Task Routing Table; an unrouted file is dead weight.
- Verify every link and fence after edits; run audits before declaring the skill complete.

## Step-by-Step Workflow

1. Draft or edit the skill; check line budgets:
   ```bash
   wc -l .agents/skills/<name>/SKILL.md .agents/skills/<name>/references/*.md .agents/skills/<name>/workflows/*.md
   ```
   Expect `SKILL.md` ≤160, each reference ≤120; reference >250 flagged for split.
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

- Root `SKILL.md`: frontmatter `name`, `description`, `license: MIT`, `compatibility: Universal`, `metadata.version` bumped with delta note.
- Workflows and references: Markdown with descriptive headings; code fences include language tag and parse.

## Verify

- Confirm `wc -l` budgets hold for the edited skill.
- Confirm `agent_utils/scripts/validate_md_links.py` and `agent_utils/scripts/audit_fences.py` exit 0.
- Confirm `workflows/shaping-checklist.md` 24 checks all pass.
