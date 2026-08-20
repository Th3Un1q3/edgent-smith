# JSON in <script> Tags - Escaping Gotcha

Embedding JSON in `<script type="application/json">` needs two escapes so the page survives both the HTML parser and JSON.parse:

- Escape `</script>` as `\/script>` (valid JSON; keeps the parser inside the element).
- Escape `<!--` as `\u003c!--` - NEVER `\!--`: `\!` is not a legal JSON escape, so JSON.parse fails and kills the whole page.

Also HTML-escape memory content (`&<>"`) before injecting into tooltips/DOM. Caught by a round-trip JSON.parse test on hostile content. Context: `mem:troubleshooting/web/no-build-graph-visualization`.