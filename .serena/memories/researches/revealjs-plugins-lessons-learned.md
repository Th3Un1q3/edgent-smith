# Lessons Learned — reveal.js Plugin Research (2026-08-21)

From the 10-plugin shortlist (GitHub data verified 2026-08-21): mem:researches/revealjs-plugins-shortlist.

- **reveal.js 6.x bundles ONLY** markdown/highlight/math/notes/search/zoom (pointer removed); print/PDF CSS no longer shipped in dist/ -> PDF export needs DeckTape/Puppeteer/Playwright.
- **Dead/moved plugins (verified 2026-08-21)**: `gcalmettes/reveal.js-mermaid-plugin` (404); `martinomagnifico` title/elapsed-time-bar/jump/typed (all 404); jump is native now.
- **`rajgoel/reveal.js-plugins` collection**: only 11 plugins (menu/verticator/quiz/spreadsheets NOT in it), single maintainer, 4.6.0 release -> 6.x unverified.
- **Healthy in 2026**: `zjffun` mermaid, Martinomagnifico suite (copycode/appearance/simplemenu/verticator), DeckTape (v3.16.1).
- **Pattern**: healthy plugins ship ESM+UMD, script-tag friendly, jsdelivr CDN — fits the no-build setup.