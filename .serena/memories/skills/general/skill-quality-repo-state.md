# Repo-Wide Skill Quality State

Snapshot from the skill-quality audit campaign (2026-08-20) — context for future skill-hardening work.

- Two cultures: ~half the skills shaped (lean, routed); ~half self-contained monoliths — refactor 2,511w, skill-creator 5,205w, python-testing-patterns 1,706w.
- Most widespread gap: negation-heavy steering — tdd "Iron Law", context-gathering 13-bullet "Common Issues", docker-patterns "Anti-Patterns" BAD: lists.
- Structural duplication: two divergent copies of writing-style.instructions.md (.opencode/ vs .github/).
- Invented/unparseable code examples in refactor/: malformed Feature-Envy diff; abstract + concrete validate() duplicate.

Related: mem:skills/general/building-modular-skills-version-deltas; mem:skills/general/skill-quality-advisory-verdict.