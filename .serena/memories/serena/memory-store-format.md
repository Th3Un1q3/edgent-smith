# Memory Store Format

The store (`/workspace/.serena/memories/`) is a flat tree of `*.md` files (~286 as of 2026-08-16); a memory's name equals its path minus `.md`. Facts verified by direct store observation, 2026-08-16.

## Frontmatter & refs

- Frontmatter is optional and NOT strict YAML: ADR files use `title:`/`status:` shapes; cache entries use `source:`/`url:` and often start with `# fetched page`.
- `mem:` refs appear only in the body, backticked or bare. Canonical extraction regex: `/mem:([a-zA-Z0-9_\/.-]+)/g`.
- Refs commonly carry trailing punctuation (`mem:cache/about.`): strip trailing `.,;:)`, strip `.md`, drop `...` placeholders and `-reference` junk before lookup.

## Dangling refs are normal

~40/382 refs dangle; most are domain-prefix refs like `mem:refactoring/` that resolve as `<domain>/about`. Self-refs exist and are legitimate.