# Workflow: Browser Automation with the devtools MCP Server

We drive the host Chrome through the devtools MCP server via the gateway for extraction, navigation, and scripted SPA flows. Site-verified selectors, URL templates, and quirks live in per-site memory namespaces: extraction recipes at `mem:browser-automation/<site>/<task>-extraction` (public — no PII); dated result caches at `mem:private/<site>/<task>-<YYYY-MM-DD>` (private by default — session-derived). Read the target site's namespace before starting; this skill is site-agnostic. This workflow covers the full loop: activate → verify auth → navigate → extract → cache → memorize selectors → recover from drift.

## Principles

- **Return only needed fields.** One `evaluate_script` per logical unit, hard-capped at 3 KB; never `take_snapshot` during extraction (Steps 4–5).
- **Persist verified selectors** per site at `mem:browser-automation/<site>/<task>-extraction`, stamped with the verification date (Step 8).
- **Expect selector drift.** Probe a sentinel first, keep recorded fallbacks, prefer cheap re-derivation over heroic parsing (Step 9).
- **Reuse the operator's authenticated session.** Auth missing or login wall → STOP and escalate; no aggressive retries, no automated login (Steps 2, 10).
- **Cache with freshness TTL.** Search-URL → results in dated `mem:private/<site>/<task>-<YYYY-MM-DD>` memories; fresh hits skip re-extraction (Step 7).
- **Pace actions.** ≥1 s between human-like actions, ≥250 ms between in-page transitions, bounded polling deadlines, no burst loops (Step 6).
- **Fail fast.** In-script error handling and bounded fallbacks; if none work, stop and report instead of looping (Step 11).

## Prerequisites

- Complete the [Setup workflow](./setup.md) to activate a code-mode sandbox with the `devtools` and `serena` servers.
- Follow the [Scripting workflow](./scripting-workflow.md) for synchronous-JS rules, quoting, and error handling.
- The devtools MCP server must be attached to the operator's host Chrome with an authenticated session (logged-in cookies). We never attempt to log in ourselves.

## Steps

### 1. Activate the sandbox

Activate code-mode with only the servers we need — `devtools` and `serena` — and a descriptive, task-related name (e.g., `code-mode-<site>-<task>`). Keep the server set minimal per the Principles; adding servers later costs a re-activation.

### 2. Verify authentication first

Call `list_pages()` and inspect the markdown table. Locate the operator's session tab by its URL (e.g., the operator's logged-in tab for the target site). Detect a login wall: the URL redirects to a login page or the page renders only login prompts.

- Session tab present and logged in → proceed.
- Auth missing or login wall detected → **STOP** and escalate to the operator. No aggressive retries, no automated login.

No session tab present does NOT mean the session is unauthenticated: even when the operator says the session is authenticated, `list_pages()` may show no session tab for the target site — session cookies live in the devtools server's shared default context, not in a named tab. A valid auth check without a session tab: open `new_page({url: '<target-url>'})` (WITHOUT `isolatedContext`) and probe for a login wall.

### 3. Navigate

Open the target with `new_page({url: '<target-url>'})` — exactly once per session. Every subsequent movement is a click (by text or recorded selector) inside `evaluate_script`: pagination, filters, "load more", cards — click, don't re-URL. Address-bar navigation (`new_page`/`navigate_page` with a new URL) is a bot signal and a fallback only when no clickable path exists — if you must use it, record the fallback and why in the cache memory. **Never** pass `isolatedContext` — an isolated context has no session cookies and lands on the login wall immediately. If we need another tab, create it with `new_page`; never reuse or navigate the operator's existing tabs.

### 4. Structure discovery — snapshot-truncate-first

For sites/tasks with no extraction memory: (a) take ONE `take_snapshot`; (b) truncate it aggressively (first ~2 KB, or filter to text-only); (c) identify the needed text/buttons/structure in the truncated output; (d) issue a TARGETED `evaluate_script` that returns only the nodes containing that text (e.g., `{tag, text, href, class}` filtered on `textContent`); (e) click by text when sufficient. This is the ONLY permitted `take_snapshot` use — one per unfamiliar flow; never for extraction, never un-truncated.

### 5. Extract with minimal output

Run one `evaluate_script` per logical unit and return only the fields we need (e.g., id, title, href — the exact fields come from `mem:browser-automation/<site>/<task>-extraction`). Never call `take_snapshot` during extraction — snapshots flood context and their uids are ephemeral. Every result is HARD-CAPPED at 3 KB: trim and aggregate inside the script (`map` to objects, `join` arrays) instead of returning raw DOM. If a result exceeds the cap, re-run the script trimmed — the oversized result never reaches the model. No raw HTML/markup dumps into context.

### 6. SPA interactions

Run click-wait-read flows inside one async `evaluate_script`: click a list item, poll for the href to change with a bounded deadline (4 s) and a 120 ms sleep between polls, read the fields, then continue. Pace item-to-item transitions at ≥250 ms (the site's extraction memory may record tuned values) and ≥1 s between distinct human-like actions (clicks, navigations). Respect a per-task action budget — default ≤40 actions, tunable in the site's extraction memory. Watch for bot-alert signals after every action; on detection: STOP, checkpoint-write partials, report. Bounded polling beats open-ended waits; do not let a script run unattended.

### 7. Cache results — checkpoints as you work

Check the cache before extracting: `mem:private/<site>/<task>-<YYYY-MM-DD>`. Each dated memory records its TTL — e.g., "Fresh for 24 h; re-run if older or if count differs". On a fresh hit, skip re-extraction entirely.

Mandatory write checkpoints: write every intermediate result AS WORK PROCEEDS — after each search/results list, each page, each category — into the same dated memory. Never wait for the end of extraction. If the session stops early (bot alert, error), the checkpoint writes already persisted the partial data; never rely on a single end-of-task write.

Result caches are session-derived (the operator's authenticated Chrome) → private by default: `private/{site}/{task}-<YYYY-MM-DD>`, under the `private` domain (`private/about`). Extraction recipes hold no PII and stay public at `browser-automation/<site>/<task>-extraction`.

Partial-cache rule: a fresh dated cache may hold fewer results than the task requires. If the fresh cache covers the task's required count, skip re-extraction; otherwise re-extract to fill the gap and UPDATE the same dated memory — do not create a second one.

### 8. Store/refresh selectors

Maintain `mem:browser-automation/<site>/<task>-extraction` with the verified selectors, the verification date stamp, and both the primary and stale/fallback selectors (sites A/B test class names; the superseded ones become the fallbacks). Run the [BLOCKING GATE](../references/memory-management-checklist.md) before every write.

### 9. Drift recovery

Before trusting stored selectors, probe a sentinel element with one cheap `evaluate_script` that returns a single boolean or count. If fields come back empty or wrong, try the recorded fallback selectors listed in the site's extraction memory. If that fails, re-derive cheaply: dump the relevant nodes of one item only — never the whole page — identify the current classes, and update the extraction memory with a new verified date. Heroic parsing of full DOM dumps is the last resort, not the first step.

### 10. Anti-bot protocol

Bot-alert signals: CAPTCHA iframe, "verify you are human" copy, a 403 alert page, or blocked/rate-limit copy. On any signal, execute the STOP sequence: STOP all actions immediately → write partial results to `private/` (the Step 7 checkpoint memories already hold most of it) → report to the operator with the signal and what was cached. No aggressive retries, no looped `new_page` — address-bar navigation is itself a bot signal (Step 3).

### 11. Fail fast

Retries are bounded and in-script only. If a script errors and no recorded fallback works, **stop** and report — include the raw partial response for diagnosis. Never loop.

## Examples

**Generic extraction skeleton (site-independent)**

Get the URL template, selectors, and pagination details from `mem:browser-automation/<site>/<task>-extraction` — this example shows only the generic mechanics that apply to any site.

Quoting rules: single quotes for JS strings in the code-mode script, double quotes inside the `evaluate_script` source, array-join for multi-line strings, and `String.fromCharCode(10)` for newlines — never backslashes.

```javascript
var SELECTOR = ''; /* set from mem:browser-automation/<site>/<task>-extraction */
var js = [
  '() => Array.from(document.querySelectorAll(SELECTOR)).map(function (el, i) {',
  '  return {id: i, title: el.textContent.trim(), href: el.href};',
  '})'
].join(String.fromCharCode(10));
try {
  var result = evaluate_script({function: js});
  return 'OK: ' + result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

`SELECTOR` is a placeholder for the recorded selector from `mem:browser-automation/<site>/<task>-extraction`; adapt the mapped fields (e.g., id, title, href) to whatever that site's extraction memory records. For click-wait-read flows, wrap the same body in `async () => { ... }` and `await` a bounded poll of `location.href` (deadline 4 s, sleep 120 ms) after `click()` — see Step 6. `evaluate_script` returns a markdown-wrapped string, not bare JSON — strip to the first `{` and the last `}` before parsing (see [references/devtools-known-issues.md](../references/devtools-known-issues.md)).

**Click by text (no snapshot needed)** — verified 2026-08-06 (devtools-known-issues #16)

```javascript
var js = [
  '() => {',
  '  var el = Array.from(document.querySelectorAll("button,a")).find(function (n) { return n.textContent.includes("TEXT"); });',
  '  if (el) { el.click(); return "OK: clicked " + el.textContent.trim(); }',
  '  return "ERROR: element with text not found";',
  '}'
].join(String.fromCharCode(10));
try {
  var result = evaluate_script({function: js});
  return 'OK: ' + result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

**Targeted text-filter query (structure discovery, Step 4)** — returns only the nodes containing the keyword

```javascript
var js = [
  '() => Array.from(document.querySelectorAll("button,a,h2")).filter(function (n) {',
  '  return n.textContent.includes("KEYWORD");',
  '}).map(function (n) {',
  '  return {tag: n.tagName, text: n.textContent.trim(), href: n.href, class: n.className};',
  '})'
].join(String.fromCharCode(10));
try {
  var result = evaluate_script({function: js});
  return 'OK: ' + result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## Acceptance Criteria

- Sandbox activated with `devtools` + `serena` only, under a descriptive name.
- Auth verified via `list_pages` before any navigation; login wall → STOP and escalate.
- First step on an unfamiliar site was a truncated snapshot (≤2 KB) — one per flow, never for extraction.
- Extraction returns only needed fields, hard-capped at 3 KB per result.
- Navigation after the initial `new_page` used clicks (address-bar count = 0 unless documented).
- ≥1 s inter-action gaps observed and ≤40 actions per task.
- Results checkpoint-cached in dated `private/` memories with a TTL; fresh hits skip re-extraction.
- Selector memory stamped with a verification date and fallbacks; BLOCKING GATE run before every write.
- On drift, a fallback or a cheap targeted re-derivation resolved it; the memory was updated.
- Bot-alert STOP sequence executed and partials cached, if any alert occurred.
- Fail-fast path executed (STOP + report) whenever no fallback worked.

## Exit Criteria

- Task data is extracted, cached, and — where applicable — the selector memory is current.
- No operator tabs were touched beyond reading `list_pages`.
- If we stopped early: the operator received the raw partial response and a clear reason.

## Clarification Triggers

Ask the operator before:
- touching or navigating tabs we did not create;
- any action that might log the session out (navigating the session tab away from authenticated domains, closing it);
- batch runs longer than N items — confirm N with the operator first;
- batch runs that would exceed the per-task action budget (default ≤40, tunable in site memory) — confirm the exact N with the operator first;
- any bot-alert occurrence — report to the operator immediately with the signal and the cached partials.
