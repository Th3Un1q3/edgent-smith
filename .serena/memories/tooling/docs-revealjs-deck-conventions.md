# AI Adoption Deck — Conventions

- Notes: `<aside class="notes">` is the last child of every slide.
- No `<!-- TODO -->` HTML comments anywhere (zero remaining; TODO text lives in notes).
- No trailing periods in VISIBLE text (`.</p>` / `.</td>` / `.</li>` etc. = 0).
- Ampersands written as `&amp;` in HTML text.
- Plain `<section>`s only — no section-level styles; inline styles on content elements are OK.
- reveal.js supports only 2 nesting levels: horizontal chapter + vertical stack.
- Idea cards are 3-row tables (Addresses / Implementation / Outcome) at `font-size:0.65em`, rows via `<tr>`; fragments were removed from Ideas — rows show immediately.
- The catalogue index slide is the sole index; group labels are plain `<strong>`, idea links use `#/4/N`.

Related: `mem:tooling/docs-revealjs-deck-structure`.