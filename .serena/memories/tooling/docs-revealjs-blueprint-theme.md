# Blueprint theme for docs deck (2026-08-21)

Custom reveal.js 6.0.1 theme created at `docs/theme/blueprint.css` (~7.9 KB, 381 lines) and applied to the docs deck. Independent validation PASSED 2026-08-21 (theme + z-index fix).

## Application

- `docs/index.html` line 14 theme link changed from `node_modules/reveal.js/dist/theme/black.css` to `theme/blueprint.css` (position kept after reveal.css, before plugin CSS).
- All 27 `--r-*` reveal.js CSS vars defined; 17/17 assets serve 200; validated contrast 8.6-13.1:1.

## Design

- Deep blueprint blue `#0d2b52` with a 4-layer repeating-linear-gradient grid in `--r-background` (major 100px rgba(255,255,255,.12), minor 20px .05, both axes).
- Near-white blue-tinted ink `#eaf2ff`; uppercase 700 headings with subtle cyan glow; system fonts only (self-contained, no external imports).
- Monokai override via `.reveal .hljs {background: transparent}`; code wells rgba(0,0,0,.35); copycode button recolored via `.reveal .codeblock button[data-cc]`.
- Drawing frame `.reveal-viewport::before` (fixed, inset 14px, pointer-events none, **z-index 9** — below controls z-11) + corner label `::after` "EDGENT-SMITH — SYSTEM DOCUMENTATION" (z-20).

## Gotchas

- reveal.js 6.0.1 real z-indexes: controls 11, progress 10, slide-number 31 (NOT 30 as some docs suggest).
- Normal print forces white/black (reveal.css `@media print`) — blue background prints only in print-pdf mode.

Setup: mem:tooling/docs-revealjs-setup. Plugins: mem:researches/revealjs-plugins-installed. Versions: mem:researches/revealjs-bun-setup.