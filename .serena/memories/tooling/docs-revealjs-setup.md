# docs/ reveal.js Setup

`docs/` serves a reveal.js 6.0.1 presentation managed by bun.

- `docs/package.json`: name "docs", `"private": true`, `"scripts": {"start": "bunx serve . -l 8000"}`, dependency `reveal.js ^6.0.1`.
- `docs/index.html` references assets straight from node_modules: `node_modules/reveal.js/dist/` for reset.css, reveal.css, theme/black.css, plugin/highlight/monokai.css, reveal.js, and plugin/{notes,markdown,highlight}.js.
- `Reveal.initialize({ hash, controls, progress, slideNumber: "c/t", center, transition: "slide", plugins: [RevealMarkdown, RevealHighlight, RevealNotes] })`.

Serve over HTTP — the markdown plugin does not load from `file://`. Add slides as `<section data-markdown>` blocks. Version/package details: mem:researches/revealjs-bun-setup.