# Same-File Extract + Rewrite: Run the Two Phases Sequentially

When one agent extracts content from a file (read phase) and another rewrites/trims the same file (write phase), run the phases SEQUENTIALLY — never concurrently. Concurrent execution races the read against the edit: the extractor may snapshot stale text, or the writer may overwrite content the extractor already moved.

Handoff contract: the rewriter runs only after the extractor reports completion; the extractor's report names the new memory namespaces the extracted content lives in, so the rewriter replaces extracted sections with mem: pointers instead of guessing; the rewriter verifies the file state (line count/structure) matches the extractor's snapshot before editing.

Applied in the browser-automation-devtools rework (2026-08-13): situational knowledge extracted into `mem:browser-automation/<site>/...` memories first, then the workflow trimmed to point at them (source: operator-provided rework context).