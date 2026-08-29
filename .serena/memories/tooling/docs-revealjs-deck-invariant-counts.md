# AI Adoption Deck — Invariant Counts & Href Audit

Whole-file counts in `docs/new-deck.html`: `<section` 40/40, `<aside` 37/37, `<table` 26, `<tr` 85, `<th>` 85, `<td>` 85, `<div` 12, `class="mermaid"` 9.

## Hrefs

- `#/4/N` in the Ideas catalogue, N in 1..21.
- 8 `href="#/4"` Back-to-index links (slides 4, 6, 10, 13, 17, 19, 20, 21 — verify current positions).
- Index links break on reorder: recount nested sections for every href audit.

Structure: `mem:tooling/docs-revealjs-deck-structure`.