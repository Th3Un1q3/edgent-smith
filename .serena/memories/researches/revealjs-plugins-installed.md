# reveal.js plugins installed in docs deck (2026-08-21)

Final step of the shortlist install ("everything but 1, 7, 8"); all 6 validation checks PASSED 2026-08-21.

## Installed (docs/, `bun add`, exact pins)

- reveal.js-mermaid-plugin@11.15.0 (zjffun; Mermaid 11 bundled)
- reveal.js-copycode@1.4.2 (Martinomagnifico)
- reveal.js-appearance@1.4.1 (Martinomagnifico)
- reveal.js-plugins@4.6.0 (rajgoel collection, for the `anything` plugin)
- reveal.js stays 6.0.1 (not bumped).

## docs/index.html wiring (no-build script tags preserved)

- 2 CSS links: copycode.css, appearance.css.
- 6 script tags: official search.js/zoom.js from flat dist/plugin/, then mermaid/copycode/appearance/anything.
- plugins array now 9 entries: RevealMarkdown, RevealHighlight, RevealNotes, RevealSearch, RevealZoom, RevealMermaid, CopyCode, Appearance, RevealAnything.
- No per-plugin usage config added yet.

## Gotchas

- Mermaid plugin: use UMD `plugin/mermaid/mermaid.js`; sibling `plugin.js` is ESM and broken in no-build setup.
- Globals are `CopyCode` and `Appearance` (NOT RevealCopyCode/RevealAppearance).
- appearance.css bundles Animate.css keyframes - do not add Animate.css separately.
- reveal.js 6.x dist/plugin is FLAT (search.js, not search/search.js).
- reveal.js-plugins pulls a harmless-but-heavy `npm` runtime dep.

## Pending

- anything plugin (rajgoel 4.6.0) tested vs reveal.js 4.6 - 6.x SMOKE TEST still needed (add minimal `anything:` config, verify in browser); same for other rajgoel-sourced behaviors. DeckTape, audio-slideshow, RevealMath intentionally NOT installed (user excluded).

Context: mem:researches/revealjs-plugins-shortlist. Setup: mem:researches/revealjs-bun-setup.