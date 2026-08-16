# Browser Automation (devtools MCP)

Recipes and dated result caches for driving host Chrome through the devtools MCP server via the Docker MCP Gateway (mcp-find devtools, code-mode sandbox, sync JS calling evaluate_script).

## Scope

- Per-site extraction recipes at `browser-automation/<site>/<task>-extraction`: verified selectors, URL templates, site quirks, and verified scripts; one subnamespace per site.
- Dated, fresh-only result caches previously at `browser-automation/<site>/<task>-<YYYY-MM-DD>` — legacy: session-derived result caches now live at `private/<site>/<task>-<YYYY-MM-DD>`.
- All website-specific content lives here, never in the context-gathering skill.
- `browser-automation/wellfound/` — wellfound.com extraction recipes (devtools-required site; plain fetch returns 403).
- `browser-automation/general/` — cross-site lessons (e.g., bot-safe extraction).
- `browser-automation/automa/` — Automa workflow authoring lessons: engine behavior verified against Automa source (handlerRepeatTask, handlerLoopBreakpoint, switch-tab schema in src/utils/shared.js) and observed run failures.

## Boundaries (out of scope)

- General research fetches and external-content caches: mem:cache/about.
- Codebase navigation and analysis: handled by serena itself, not by memories.
- Generic devtools mechanics (quoting, list_pages markdown, isolatedContext, login-wall handling, pacing, drift recovery, caching rules) live in the skill's `workflows/browser-automation-devtools.md` and `references/devtools-known-issues.md` — do not duplicate them here.
- Dated result caches derived from authenticated (devtools) sessions do NOT belong here — they live at `private/<site>/<task>-<YYYY-MM-DD>` (private namespace — gitignored). Extraction recipes (selectors, quirks — no PII) stay public here at `browser-automation/<site>/<task>-extraction`.

Start with the target site's extraction recipe, e.g., `mem:browser-automation/<site>/<task>-extraction`.

Maintenance: when a new site subnamespace is added, update this about's Scope.