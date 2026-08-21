# reveal.js Plugins Shortlist (2026-08-21)

Validated research outcome (GitHub data verified 2026-08-21). Project ground truth: reveal.js 6.0.1 pinned in docs/, no-build script-tag setup, currently only markdown/highlight/notes plugins; served via `bunx serve . -l 8082`; **PDF export path missing** (reveal.js 6.x dist/ ships no print CSS).

## Shortlist outcome

- **Install**: DeckTape (`astefanutti/decktape`, Node CLI -> PDF via headless Chromium); `zjffun/reveal.js-mermaid-plugin` (Mermaid 11 bundled, self-contained UMD; `gcalmettes` plugin is DELETED); `Martinomagnifico/reveal.js-copycode`; RevealSearch + RevealZoom (bundled official).
- **Consider**: anything + audio-slideshow from `rajgoel/reveal.js-plugins` (collection last release 4.6.0, tested vs reveal.js 4.6 -> 6.x UNVERIFIED, smoke test needed).
- **Might-be-interested**: RevealMath (bundled), RevealAppearance.
- **Already native**: jump-to-slide (press G, since 4.5.0).

## Recommended first batch

DeckTape + mermaid plugin + copycode + search/zoom.

Setup context: mem:researches/revealjs-bun-setup. Plugin ecosystem health: mem:researches/revealjs-plugins-lessons-learned. Adjacent viz picks: mem:researches/visualization-libraries-shortlist.