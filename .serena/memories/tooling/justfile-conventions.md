# justfile Conventions for JS/bun Recipes

Root `/workspace/justfile` pattern for JS/bun recipes:

- `BUN := "bun"` declared in the UPPER-case variable block at the top of the file.
- Sentence-case comment above each recipe (shown in `just --list`).
- `{{ BUN }}` interpolation; recipe bodies start `cd docs && {{ BUN }} ...`.
- Precedent: `.opencode/justfile` `deps:` recipe runs bare `bun install`.

Existing recipes: `just docs-deps` -> `cd docs && bun install`; `just docs-serve` -> `cd docs && bun run start`.