# reveal.js + bun static setup (research 2026-08-20)

**Version:** reveal.js 6.0.1 (npm, latest; ESM-first "type": "module", exports map . -> dist/reveal.mjs). npm package ships dist/ (reveal.css, reset.css, reveal.js UMD + reveal.mjs, theme/ (14 themes incl. black, white, dracula), plugin/ (highlight, markdown, math, notes, search, zoom as .js + .mjs + .d.ts; highlight/monokai.css, zenburn.css)).

**Install (bun 1.3.14):** docs/package.json {"dependencies":{"reveal.js":"^6.0.1"}} then "bun install" -> creates text bun.lock (not bun.lockb). Verified in /tmp.

**Serve (simplest):** "start": "bunx serve . -l 8000" (serve auto-installs to bun global cache on first bunx run; port 8000 matches reveal.js convention). No build step needed for static approach; official full setup uses vite (repo start script = "vite", port 8000) but that is heavy.

**index.html:** official starter uses classic script tags: dist/reveal.js (global Reveal) + dist/plugin/{notes,markdown,highlight}.js exposing RevealNotes/RevealMarkdown/RevealHighlight globals; Reveal.initialize({hash:true, plugins:[RevealMarkdown, RevealHighlight, RevealNotes]}). For bun-managed docs/: reference node_modules/reveal.js/dist/... relative paths.

**Config:** Reveal.initialize({hash, controls, progress, slideNumber, center, transition, plugins}).

**Gotchas:** workspace .gitignore has NO node_modules entry (add docs/node_modules/); root gitignore "dist/" would ignore a copied docs/dist/. bun init -y is non-interactive; bun add saves to package.json by default.