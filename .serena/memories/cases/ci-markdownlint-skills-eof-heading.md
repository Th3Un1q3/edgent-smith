---
id: cases/ci-markdownlint-skills-eof-heading
type: cases
L0: "markdownlint gate (just docs::lint, ci.sh gate #4) failed on 11 skill-doc defects: 10x MD012 trailing blank line at EOF, 1x MD001 H1 to H3 jump. Fix: strip EOF blank; normalize heading levels."
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-09-23
directory: cases
provenance: /workspace/.tmp/quality-gates/fix-1-markdownlint.md + rerun-1.json
---
# markdownlint gate failed on skill-doc formatting defects

Problem: `just ci` failed at gate #4 markdownlint (`just docs::lint`, scripts/ci.sh:69). markdownlint-cli2 v0.23.2 reported 11 issues in 11 files under `.agents/skills/`. Both were pre-existing formatting debt from skill add/update work, not a config or threshold problem; no gate rule changed.

## Root cause
- MD012 no-multiple-blanks (10 files): each file ended with content + an extra trailing blank line at EOF; markdownlint counts a file-final blank line as a consecutive blank.
- MD001 heading-increment (1 file, `.agents/skills/session-insights/references/schema-tool-and-content.md`): the H1 title was followed directly by an H3 (`### 8. ...`) with no H2, an H1 to H3 jump. Its sibling `schema-parts.md` sets the H1 to H2 to H3 convention.

## Fix pattern
- MD012: remove the single trailing blank line at EOF (net -1 line per file).
- MD001: normalize heading levels (`### 8.` to `## 8.`, `#### .parts[]...` to `### .parts[]...`, `###` section headings to `##`); text and anchors unchanged.
- `just docs::fix` (docs/justfile) is the auto-fix variant; the session applied the fixes directly and verified with `just docs::lint`.

## Verification
- `just docs::lint`: 0 issues in 0 files (340 markdown files linted), exit 0.
- Full `just ci`: exit 0 across all 13 gates with mutation ran (score 83.18 >= break 72).
- Net diff: 11 files changed, 6 insertions, 16 deletions.

## Reusable rule
Editing any markdown under `.agents/skills/**` can break CI gate #4: `just docs::lint` lints skills as well as `docs/`. Run `just docs::lint` before committing skill-file changes. markdownlint excludes `.serena/**`, `.tmp/**`, `.venv/**`, `.git/**`, `.pytest_cache/**`, `.cache/**`, and `**/node_modules/**`.

## Sources
- mem:researches/markdown-linters-comparison
- /workspace/.tmp/quality-gates/fix-1-markdownlint.md and rerun-1.json
- scripts/ci.sh:69 (gate #4); docs/justfile:11 (invocation)