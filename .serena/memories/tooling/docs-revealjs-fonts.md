# Blueprint theme fonts upgraded (2026-08-21)

User chose the Oswald / Inter / JetBrains Mono pairing from 3 curated options (research verified all OFL-1.1 via Fontsource npm). Applied to the blueprint theme (see `mem:tooling/docs-revealjs-blueprint-theme`).

## Installation

- Installed in docs/ via `bun add`: `@fontsource-variable/oswald@^5.3.0`, `@fontsource-variable/inter@^5.3.0`, `@fontsource-variable/jetbrains-mono@^5.3.0`.
- Variable fonts — single woff2 per family (~28-40 KB), self-hosted in node_modules, pinned in bun.lock. NO CDN.

## Wiring

- docs/index.html: 3 link tags after theme link, before plugin CSS: `node_modules/@fontsource-variable/{oswald,inter,jetbrains-mono}/index.css`.
- docs/theme/blueprint.css :root vars: `--r-main-font: 'Inter Variable', Inter, ...`; `--r-heading-font: 'Oswald Variable', Oswald, 'Arial Narrow', ...`; `--r-code-font: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, ...`. Heading weight 700 + letter-spacing 0.04em kept. No hardcoded font-family outside :root (all via vars).

## Gotcha

- Font-family names MUST match Fontsource index.css declarations exactly ('Oswald Variable' etc.) or browsers silently fall back to system stacks. Verified family names from installed packages before wiring.

## Pattern

- Variable Fontsource packages are the lean fit for the repo's no-build node_modules convention.
