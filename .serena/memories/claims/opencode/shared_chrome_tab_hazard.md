---
id: claims/opencode/shared_chrome_tab_hazard
type: claims
L0: "Children sharing one logged-in Chrome steal tab targets, so each child must create and track its own page"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# shared_chrome_tab_hazard
fact: Concurrent children sharing one logged-in Chrome instance steal each other's tab targets, so a child cannot assume the active page is the one it navigated.
scope: Parallel browser automation via subtasks.
evidence: Observed target loss in the orchestration run when several children drove the same browser.
rule: Each child creates its own page and holds its own target handle; never act on "the active tab".
Source: observed orchestration run, 2026-10-22; shared browser session behavior.