# AI Adoption Deck (docs/new-deck.html)

The leadership pitch deck for AI adoption at [Company] lives at `docs/new-deck.html`: reveal.js 6.0.1 with the blueprint theme, aimed at company leadership. Serve with `just docs-deps` / `just docs-serve` (port 8082).

## Invariants

- The `<head>` must stay byte-identical to `docs/index.html` except for `<title>`.
- Do NOT modify `docs/index.html` or `docs/theme/blueprint.css` (shared theme).

Setup/serving details: `mem:tooling/docs-revealjs-setup`. Theme: `mem:tooling/docs-revealjs-blueprint-theme`. Deck structure: `mem:tooling/docs-revealjs-deck-structure`.