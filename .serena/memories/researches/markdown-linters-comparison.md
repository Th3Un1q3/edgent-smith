# Markdown Linter Comparison & Recommendation (edgent-smith)

Research task (2026-08-07): find + configure a markdown linter for a Python 3.13 devcontainer-first repo with just + GitHub Actions. Research only; no files modified.

## Recommendation: markdownlint-cli2
Node >=22 (devcontainer has Node 24/26 + Bun per .tool-versions and devcontainer.json node:24 feature, so requirement met). Standard choice for repos with a Node toolchain; the MD0xx rule set is the lingua franca (PyMarkdown mirrors ~44 of 46 rules). PyMarkdown is the fallback for a strictly Python-only toolchain.

## Candidate matrix (key facts)
| Tool | Runtime | Install | Config | Default rules | Fix | Maintenance |
|---|---|---|---|---|---|---|
| markdownlint-cli2 v0.23.2 | Node >=22 | npm -g/-D, brew, docker davidanson/markdownlint-cli2, GitHub Action markdownlint-cli2-action | .markdownlint-cli2.jsonc/.yaml/.cjs/.mjs; falls back to .markdownlint.{json,jsonc,yaml,yml,cjs,mjs} | all markdownlint rules on (strict; MD013 line-length 80 noisy) | --fix (fixable rules) + --format stdin/stdout | very active (DavidAnson, markdownlint author) |
| markdownlint-cli v0.49.1 (legacy) | Node >=22 | npm -g/-D, brew | .markdownlint.json/.jsonc/.yaml/.yml + CLI -c/-i/-f | same all-on | --fix | maintained but superseded; README points to cli2 |
| pymarkdownlnt v0.9.39 (2026-07-11) | Python >=3.10 | pip/uv install pymarkdownlnt | .pymarkdown or pyproject.toml [tool.pymarkdown]; pymarkdown scan <path> | ~46 built-in rules, ~44 shared with markdownlint; plugin-based | partial: pymarkdown fix (autofix-capable rules only, strict mechanical criteria) | very active, approaching 1.0.0 |
| vale v3.17.1 | Go single binary | brew, GH releases, docker jdkato/vale | .vale.ini + Styles/ packages (BasedOnStyles: Google/Microsoft/proselint) | NONE out of box (prose/style only, not structure) | no general autofix; rule actions (suggest/replace/remove) | very active; complementary, not a structural linter |
| textlint v15.8.0 | Node | npm textlint + textlint-rule-* | .textlintrc JSON | none (plugin-based; preset-ja-technical-writing strong, EN weaker) | some rules fixable | active |
| remark-lint (unified) | Node | npm remark-cli + remark-lint + granular remark-lint-* plugins | .remarkrc or package.json remarkConfig | ALL opt-in (zero defaults, quiet) | some fixers + remark-stringify | active |

## Config format example (.markdownlint-cli2.jsonc) - minimal for this repo
{ "globs": ["**/*.{md,markdown}"], "ignores": ["node_modules/**"], "config": { "default": true, "MD013": false, "MD024": { "siblings_only": true }, "MD033": false } }
Note: docs/ + AGENTS.md + README.md are the main lint targets; .opencode/ TS tooling already has its own justfile (bun) - markdown files there optionally ignored.

## justfile recipe (root, follows repo UV/bash conventions)
MARKDOWNLINT := "npm exec --yes --package=markdownlint-cli2@0.23.2 -- markdownlint-cli2"
md-lint:
    {{ MARKDOWNLINT }} "**/*.{md,markdown}"

## CI (repo pattern: scripts/ci.sh run_check lines, executed by ci.yml via devcontainers/ci just ci)
Add to scripts/ci.sh: run_check markdownlint just md-lint
Alternative: davidanson/markdownlint-cli2-action GitHub Action with config input.

## Gotchas
- MD013 line-length (80) is noisy - disable or set line_length. MD024 duplicate headings and MD033 inline HTML commonly need config.
- markdownlint-cli2 default has no implicit globs; pass globs or rely on config globs.
- Node >=22 required (met here). For Python-only teams, pymarkdownlnt (pyproject.toml integration, partial fix) is the fit.
- VS Code extension DavidAnson.vscode-markdownlint uses the same rules/config.

## Cached sources
- mem:cache/fetch/raw-githubusercontent-com-DavidAnson-markdownlint-cli2-main-README-md
- mem:cache/fetch/raw-githubusercontent-com-jackdewinter-pymarkdown-main-README-md
- mem:cache/fetch/raw-githubusercontent-com-errata-ai-vale-master-README-md
- mem:cache/fetch/registry-npmjs-org-markdownlint-cli2-latest
- mem:cache/fetch/registry-npmjs-org-markdownlint-cli-latest
- mem:cache/fetch/raw-githubusercontent-com-DavidAnson-markdownlint-cli2-action-main-README-md
