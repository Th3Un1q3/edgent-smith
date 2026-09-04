# Finding Known GitHub Issues & Docs Analysis

**Use when:** researching behavior via GitHub issues, docs pages, or release notes; auditing docs after renames.

## Pitfalls

- Treating an open bug as designed behavior (or vice versa).
- Assuming the user's version is unaffected by a reported bug.
- Stale references in docs after renames.

## Rules

1. Categorize findings: by-design / open-bug / feature-request, with issue numbers + URLs.
2. Note the version window each finding applies to; check whether the user's version falls inside it.
3. After renaming anything user-facing (recipes, commands, env vars), grep the repo and docs for the old name — stale references must be gone; make docs-match-code a validation criterion.