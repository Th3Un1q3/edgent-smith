# Automa: lazy-panel wait + stale-read guard

When waiting for a lazy detail panel to show the clicked item:

1. Capture the current panel text into a variable (`prevPanelDesc`) BEFORE the click.
2. Poll (bounded, e.g. 20 × 500 ms) with a PURELY CONTENT-BASED ready-condition — break when text is non-empty AND (`prevPanelDesc` empty OR text differs from it). Do NOT put a URL/search-param signal in the break condition: its behavior on de.indeed.com is UNVERIFIED, and if the URL updates before the content swaps it causes premature stale reads.
3. After the poll, if no panel switch was observed AND text still equals `prevPanelDesc` AND the URL does not identify the current item — BLANK the description (insert an empty partial row) rather than attach the previous item text to the current row. Wrong data is worse than missing data.
4. Reset per-iteration extraction variables (description, duplicate flag) at the START of each iteration so a failed JS run cannot leak stale values (see `mem:browser-automation/automa/partial-results-resilience`).