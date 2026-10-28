---
id: cases/markdown/table-html-comment-splits-table
type: cases
L0: "An HTML comment line inside a GFM table splits the table; put one comment above the header naming the rows, never between rows, and markdownlint will not catch it."
hotness: 0.7
ttl: 365d
version: 1
freshness: 2026-10-27
directory: markdown
status: active
provenance: docs annotation delegation run, 2026-10-27; GitHub GFM table parsing
---

# HTML comment inside a GFM table splits it

idea: a table annotation is placed above the header, never between rows.

scope: cases — a single observed failure with its fix, not a claim about one lint rule.

rationale: in GFM a table block ends at the first line that is not a table row, so an `<!-- ... -->` line between rows closes the table and the rows after it render as loose text.

Failure: a delegated annotator put the comment above the row it annotated, reading "directly above the affected block" as above that row; the annotated row and every following row left the table.

Source: observed in the docs annotation child of this run, 2026-10-27.

Rule: when the affected block is a table row, write one comment above the table header naming the rows it covers.

Detection: markdownlint passes both the broken and the fixed table, so a gate will not report it; a reader checks tables for inter-row comment lines.
