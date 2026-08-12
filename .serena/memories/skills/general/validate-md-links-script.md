# Skill Link Validation: validate_md_links.py

building-modular-skills/scripts/validate_md_links.py (stdlib-only, ~80 lines) validates all relative Markdown links across the whole skills tree. Skips fenced code blocks (both ``` and ~~~) and inline code spans. Wired into the building-modular-skills SKILL.md routing table (v3.4.0). Source: 2026-08-12 building-modular-skills cleanup session.

## Known broken links (pre-existing defects, NOT yet fixed)

Running the script found 4 real broken links in the test-driven-development skill:

- SKILL.md:58 -> .github/instructions/zombie-test-driven.instructions.md (target does not exist)
- workflows/scaffold.md:3, :11, :58 -> ./workflows/* links that resolve to workflows/workflows/*

Fix these in the tdd skill, or re-run the script to re-verify. Once the defects are fixed, update/remove this section.