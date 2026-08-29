# Deck Build Conventions

A reveal.js deck must satisfy these build conventions on top of the deck-authoring invariants. Each one keeps the deck source readable and the rendered output clean.

## 1. Metacommentary lives only in speaker notes

All metacommentary (TODO/TBD/refine instructions) goes inside `<aside class="notes">`, placed as the LAST child of the slide `<section>`. Zero `<!-- TODO -->` HTML comments. Zero visible meta markers ("TODO", "TBD", "(optional)") in slide content.

## 2. Placeholder slides use "Placeholder"

A not-yet-filled slide shows the neutral text "Placeholder" and nothing else.

## 3. Fragments reveal per item

Reveal list items one at a time with `<li class="fragment">`. Never put `class="fragment"` on the `<ul>`/`<ol>` itself unless the whole list should appear at once.

## 4. Escape `&` as `&amp;`

Escape `&` as `&amp;` in all visible content and attribute values.

## 5. Mermaid diagrams are raw blocks

Use raw `<div class="mermaid"><pre>` blocks only, with plain text inside `<pre>`. Fenced ```mermaid blocks inside data-markdown are NOT rendered by the plugin.

## 6. Structural label comments

Label each section/chapter with a sequentially numbered comment, e.g. `<!-- 3 · Chapter: Name -->`, adding a parenthetical for vertical stacks.

## 7. Chapter/stack structure

A top-level `<section>` is a pure container holding only nested sections. Its first nested section is the chapter intro slide: an `<h2>` plus `<p class="fragment">` framing lines. Depth slides use `<h3>`.

## 8. Preserve external edits

If a slide or region contains text/edits you did not author (user-authored copy, suffixes, reformatted head), preserve them verbatim — do not rewrite, revert, or "clean up" user content. Flag anything externally modified in the final report.

## 9. `<head>` mirrors a sibling deck — same config, not byte equality

When a deck mirrors a sibling deck's `<head>` (config/plugins), do not reformat or rewrite the `<head>` beyond the permitted difference (e.g. `<title>`). The invariant is "same config", not byte equality — user reformatting is theirs to keep.
