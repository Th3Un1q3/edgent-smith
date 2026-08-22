# Docs deck expanded: vertical navigation + mermaid (2026-08-21)

docs/index.html rewritten and independently validated (all 10 structural checks PASS, 2026-08-21). Title updated to "edgent-smith — System Documentation".

## Structure

- 9 horizontal sections, 4 vertical stacks (Architecture×4, Project Structure×3, Commands & Lookup×2, Workflows & Experiments×4), 22 slides total.

## Mermaid

- 3 diagrams in raw `<div class="mermaid"><pre>` containers: D1 world-model flowchart TB (Docker Compose subgraphs), D2 experiment-loop sequenceDiagram, D3 taxonomy flowchart LR.
- Mermaid config in Reveal.initialize: theme `base` + 7 themeVariables matching the blueprint palette (primaryColor #0d2b52, text #eaf2ff, line #7fd4ff, etc.). Plugins array (9) and all head links/scripts unchanged.
- blueprint.css: one rule added — `.reveal .mermaid svg { max-width:100%; margin:0 auto; display:block; }` (mermaid plugin emits inline SVG that hugs the left edge).

## Element variety

- 5 project tables (code map, just recipes, where-to-look, dual registry, keyboard shortcuts), 9 fragments (incl. grow/highlight-blue/fade-in-then-out), 4 blockquotes, 4 code blocks (data-trim/noescape, 3 with line-numbers, grounded in real symbols from agents/edge.py, cli/main.py, evals/runner.py, labeled illustrative), 4 speaker notes, 3 animate__ classes on the title slide only (never combined with fragments).

## Gotchas

- (a) The mermaid plugin does NOT process ```mermaid fenced blocks in data-markdown slides — use raw `<div class="mermaid"><pre>` inside the textarea.
- (b) Markdown heading levels do NOT create vertical slides — use explicit nested `<section>`.
- (c) Mermaid renders all diagrams once at plugin init.
- (d) Browser smoke test still pending (no headless browser in env) — structural/mermaid-syntax checks passed.

Related: mem:tooling/docs-revealjs-setup, mem:tooling/docs-revealjs-blueprint-theme, mem:tooling/docs-revealjs-fonts.