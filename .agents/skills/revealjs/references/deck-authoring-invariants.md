# Deck-Authoring Invariants

Every reveal.js deck and every validator pass over one must satisfy these invariants. Violating any of them produces the documented layout bug.

## 1. No box-affecting styles on a slide `<section>`

reveal.js sizes each `<section>` itself. Putting `border`, `padding`, or `margin` on a slide `<section>` overflows the slide. Put frames on an inner wrapper `<div>` instead.

```html
<!-- Correct: frame on an inner wrapper div -->
<section id="framed-slide">
  <div class="frame">
    <h2>Title</h2>
  </div>
</section>
```

```html
<!-- Incorrect: box styles on the section overflow the slide -->
<section id="framed-slide" style="border: 2px solid red; padding: 40px;">
  <h2>Title</h2>
</section>
```

## 2. A chapter stack container holds only nested `<section>`s

A vertical-stack container (`<section>` that holds stacked slides) must contain ONLY nested `<section>` elements. Direct text or content inside it lingers and overlaps the nested slides on vertical navigation.

```html
<!-- Correct: stack container holds only nested sections -->
<section>
  <section>First slide</section>
  <section>Second slide</section>
</section>
```

```html
<!-- Incorrect: direct content overlaps nested slides on vertical navigation -->
<section>
  <h2>Chapter Title</h2>
  <section>First slide</section>
  <section>Second slide</section>
</section>
```

## 3. `<aside class="notes">` is the last child of a slide `<section>`

Place speaker notes as the final child of a slide `<section>` so they render correctly and do not interfere with slide content.

```html
<section id="slide-with-notes">
  <h2>Title</h2>
  <aside class="notes">Speaker notes for this slide.</aside>
</section>
```

## 4. Mermaid diagrams are raw `<div class="mermaid"><pre>` blocks

The reveal.js-mermaid-plugin processes only raw `<div class="mermaid"><pre>` blocks. Fenced code blocks are not processed.

```html
<div class="mermaid">
<pre>
flowchart TD
    A --> B
</pre>
</div>
```

## 5. Validators flag box-affecting inline styles on a `<section>`

A validator must FAIL a deck that carries a box-affecting inline style (`border`, `padding`, `margin`) on a `<section>` element. This is a hard FAIL regardless of whether the deck appears to render.

## 6. Validation environment: static checks when no Chrome

`scripts/check-overflow.js` requires puppeteer with a runnable Chrome. In arm64 containers (e.g. OrbStack) without multi-arch Chrome it cannot run — `MODULE_NOT_FOUND` for puppeteer, or dynamic-loader errors from x86-64 Chrome binaries. Do not promise or attempt an overflow check there; fall back to the static invariant set.

Static validation fallback for deck edits:
- Verify tag counts balance: opening/closing `<section>`, `<aside>`, `<table>`, `<tr>`, `<th>`, `<td>`, `<div>`.
- Audit every `#/horizontal/vertical` href by counting nested sections — index links break on reorder.
- Grep zero trailing periods in visible text (`.</p>`, `.</td>`, `.</li>`, `.</h2>`, `.</h3>`).
- Grep zero `<!-- TODO -->` HTML comments.
- Confirm `<aside class="notes">` is the last child of every slide `<section>`.
- Confirm plain `<section>`s — no section-level styles.

The git index may hold a stale older revision of a deck file (shown as `AM` in `git status --porcelain`). Validate the WORKING TREE, not the index: use `git status --porcelain` for "which files changed" questions; treat `git diff`/`git diff --stat` against the index as unreliable for task-scoped diffs.
