# Visualization Libraries Shortlist (2026-08-21)

Validated research outcome (GitHub data verified 2026-08-21): shortlist of 20 candidates for visualizing processes and relations across web slides, static PDFs, and videos. Selection criteria: ease of use, maintenance, feature reach/customizability, extensibility.

## Top picks

- **Cytoscape.js** — graph/relations, #1 overall. MIT, native SVG export + headless mode.
- **Remotion** — video; custom license.
- **Slidev** — slides; only framework with built-in MP4 export.
- **Apache ECharts** — charts; Apache-2.0, SSR export.
- **Mermaid** — diagram-as-code; MIT.
- **Plotly Python** — Python-native; Kaleido static export.
- **Playwright Python** — universal PDF/video bridge; Apache-2.0.

## Recommended stacks

- **Web slides**: reveal.js + Cytoscape.js + ECharts (CDN, embedded JSON, no-build).
- **PDF**: reveal.js print CSS + Playwright Python + Matplotlib (+ Graphviz WASM).
- **Video**: ManimCommunity (+ Playwright frame capture; Remotion escalation).

Licensing flags and candidates to avoid: mem:researches/visualization-libraries-lessons-learned. vis-network context: mem:troubleshooting/web/no-build-graph-visualization. reveal.js already wired in repo: mem:researches/revealjs-bun-setup.

## Sources

- Validated research run 2026-08-21; GitHub data verified on that date.