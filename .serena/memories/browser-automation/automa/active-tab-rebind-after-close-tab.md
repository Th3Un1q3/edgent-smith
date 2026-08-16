# Automa: rebind active-tab after close-tab (switch-tab pattern)

After a close-tab block succeeds, the engine holds a stale/absent active-tab reference; an immediately following active-tab block binds to whatever the window happens to have focused and can fail with Can't find active tab. Observed: a real run was killed at iteration 16 of 25 — one job lost, webhook never reached.

Fix: use switch-tab with Find Tab by Match Pattern (MDN syntax, scheme required, e.g. https://de.indeed.com/jobs* — query strings are ignored by match patterns) plus activeTab: true and createIfNoMatch: false to deterministically rebind to the list tab.

Verified switch-tab data schema (Automa src/utils/shared.js): findTabBy: "match-patterns", matchPattern, activeTab: true, createIfNoMatch: false, url, tabIndex, tabTitle; refDataKeys [url, matchPattern, tabTitle]. See `mem:browser-automation/indeed/jobs-extraction` for the list-page tab example.