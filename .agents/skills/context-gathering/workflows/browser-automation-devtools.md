# Workflow: Browser Automation with the devtools MCP Server

We drive the host Chrome through the devtools MCP server via the gateway for extraction, navigation, and scripted SPA flows.

Site-verified selectors, URL templates, and quirks live in per-site memory namespaces: extraction recipes at `mem:browser-automation/<site>/<task>-extraction` (public — no PII); dated result caches at `mem:private/<site>/<task>-<YYYY-MM-DD>` (private by default — session-derived). Read the target site's namespace before starting; this skill is site-agnostic.

Full loop: activate → verify auth → navigate → extract → cache → memorize selectors → recover from drift.

## Principles

- **Return only needed fields.** One `evaluate_script` per logical unit, hard-capped at 3 KB; never `take_snapshot` during extraction (Steps 4–5).
- **Persist verified selectors** per site at `mem:browser-automation/<site>/<task>-extraction`, stamped with the verification date (Step 8).
- **Expect selector drift.** Probe a sentinel first, keep recorded fallbacks, prefer cheap re-derivation over heroic parsing (Step 9).
- **Reuse the operator's authenticated session.** Auth missing or login wall → STOP and escalate; no aggressive retries, no automated login (Steps 2, 10).
- **Cache with freshness TTL.** Search-URL → results in dated `mem:private/<site>/<task>-<YYYY-MM-DD>` memories; fresh hits skip re-extraction (Step 7).
- **Pace actions.** ≥1 s between human-like actions, ≥250 ms between in-page transitions, bounded polling deadlines, no burst loops (Step 6).
- **Fail fast.** In-script error handling and bounded fallbacks; if none work, stop and report instead of looping (Step 11).
- **Escalate, don't workaround.** The devtools server is the designated source of truth for live-page DOM evidence; when it is DOWN, stop after bounded retries and escalate to the operator — never silently substitute tools that change the source of truth. Full rule: "Source of truth down — ESCALATE, don't workaround" below.

## Source of truth down — ESCALATE, don't workaround

When a task designates a specific source of truth (for us: the devtools server for live-page DOM evidence) and that source is DOWN or unreachable:

- **Retry, bounded.** Gateway attach is transiently flaky — on "Not connected" or an empty tool list, retry once or twice before concluding anything (devtools-known-issues #20).
- **Stop after ~8–10 bounded retries and escalate.** Report the exact blocker — which tool, what error, what config — and ask the operator to restart the host proxy/service (`.devcontainer/init.sh`) or re-attach the session. **Never silently substitute tools that change the source of truth**: direct HTTP fetch (urllib/requests/curl), tavily, search APIs, or web archives. Workaround tools yield different data and corrupted evidence — rendered markdown ≠ real DOM (e.g., a "Show more" button that exists only in markdown, or a job count that disagrees with the filtered live page).
- **Write prompts around the gotchas** (reference notes: [devtools-known-issues #20–22](../references/devtools-known-issues.md)): gateway attach is transiently flaky ("Not connected" → retry once or twice; sustained failure = host proxy/Chrome down); the code-mode JS harness mangles `\"`/`\\` inside nested strings — write scripts with zero backslashes and zero double quotes; navigate in one CDP call and evaluate in the NEXT — navigate + heavy evaluate in one call times out.
- **Verify down before declaring down** — an agent MUST have attempted the actual tool path (`gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec` against the devtools server) and observed ≥2 real timeouts/errors on real tool calls before reporting the server as down. Log files, port scans, or indirect evidence alone are NOT sufficient. After an operator reports a restart, re-probe rather than trusting a prior down-verdict. Orchestrators must not embed "the server is down" as a premise in retry prompts.

## Prerequisites

- Complete the [Setup workflow](./setup.md) to activate a code-mode sandbox with the `devtools` and `serena` servers.
- Follow the [Scripting workflow](./scripting-workflow.md) for synchronous-JS rules, quoting, and error handling.
- The devtools MCP server must be attached to the operator's host Chrome with an authenticated session (logged-in cookies). We never attempt to log in ourselves.
- **The devtools server runs on the HOST, not in this container.** `.devcontainer/init.sh` (devcontainer `initializeCommand`) launches `chrome-devtools-mcp` on the host OS, bridged by mcp-proxy to port 9223; the agent reaches it only through the gateway. The server's filesystem IS the host's — container paths (`/tmp/...`, `/workspace/...`) do not exist there. Every file-writing tool (`take_snapshot`, `evaluate_script`, `take_screenshot`) refuses a `filePath` with `Error: Access denied: path <p> (canonical: <host path>) is not within any of the configured workspace roots` (verified live 2026-08-13), and even an allowed host-side write would be unreadable from this container. **All devtools data returns INLINE or not at all.**

## Steps

### 1. Activate the sandbox
Activate code-mode with only `devtools` + `serena` and a descriptive, task-related name (`code-mode-<site>-<task>`). Keep the server set minimal per the Principles — adding servers later costs a re-activation.

### 2. Verify authentication first
Call `list_pages()` and inspect the markdown table. Locate the operator's session tab by its URL. Detect a login wall: the URL redirects to a login page or the page renders only login prompts.

- Session tab present and logged in → proceed.
- Auth missing or login wall → **STOP** and escalate. No aggressive retries, no automated login.

No session tab ≠ unauthenticated: session cookies live in the devtools server's shared default context, not in a named tab. A valid auth check without a session tab: `new_page({url: '<target-url>'})` (WITHOUT `isolatedContext`) and probe for a login wall.

### 3. Navigate
Open the target with `new_page({url: '<target-url>'})` — exactly once per session. Two movement types:

- **Intra-page (SPA):** every movement is a click (by text or recorded selector) inside `evaluate_script` — pagination, filters, "load more", tabs, cards. Click, don't re-URL.
- **Cross-URL (distinct resources):** e.g., list result → item detail page, company → profile: paced `navigate_page`. Address-bar navigation is tolerated on some sites and triggers bot detection on others (e.g., wellfound — devtools-known-issues #17); record the site's **address-bar tolerance** in the extraction memory. Pace ≥1 s, shortest path (one hop, not a chain of reloads).

**Never** pass `isolatedContext` — an isolated context has no session cookies and lands on the login wall immediately. Create extra tabs with `new_page`; never reuse or navigate the operator's existing tabs.

### 4. Structure discovery — targeted query, not snapshots
No extraction memory yet: discover with a TARGETED `evaluate_script` returning only the nodes containing the text we need (e.g., `{tag, text, href, class}` filtered on `textContent`) — cheap, precise, no context flood. Only if that fails may you take ONE `take_snapshot` — **inline only, NO `filePath`** — and truncate it to a ~2 KB slice IN-SCRIPT before returning (snapshot-truncate-first; [truncation-examples.md §A](../references/truncation-examples.md)). An inline `take_snapshot` returns the full a11y tree (tens of KB) into context BEFORE any in-script truncation could apply if you skip it — truncate first, always. This is the ONLY permitted use — one per unfamiliar flow. For interactive structure (clickable/typeable), prefer the battle-tested snippets in Examples (A–D).

**Snapshot `filePath` — DO/DON'T (verified live 2026-08-13):**
- DO take snapshots INLINE (no `filePath`) and truncate to ~2 KB in-script before returning.
- DO call `take_snapshot` BEFORE the first `evaluate_script` on a page when a snapshot is needed — an `evaluate_script` on a page with no snapshot can fail with `No snapshot found for page N` (devtools-known-issues #13); a snapshot taken first avoids that failure class.
- DON'T pass any `filePath` — container-style (`/tmp/...`, `/workspace/...`), host-style, and relative paths are ALL denied by the host-side server (`Error: Access denied: ... is not within any of the configured workspace roots`), and a host-side file is unreadable from this container.
- DON'T assume the server's filesystem is the agent's filesystem — the server runs on the HOST (launched by `.devcontainer/init.sh`; see Prerequisites); the agent sees only inline returns through the gateway.

### 5. Extract with minimal output
One `evaluate_script` per logical unit; return only the fields the site's extraction memory records. Never `take_snapshot` during extraction. Every result is hard-capped per Shared rules: trim/aggregate in-script (`map` to objects, `join` arrays), never raw DOM. Oversized results still reach the model on the first call — stay lean from the start; there is no `filePath` escape hatch (denied — see Step 4 / Prerequisites), so trim/aggregate in-script and re-run with tighter caps rather than dumping raw DOM. Parse every return through `unwrap` (Shared rules).

### 6. SPA interactions
Click-wait-read flows inside ONE async `evaluate_script`: click a list item, bounded-poll the href for change, read, continue. Pace per Shared rules (site memory may tune). Watch for bot-alert signals after every action; on detection: STOP, checkpoint-write partials, report. Use the effect-verified click companion (B2) — `WARNING` semantics per Shared rules. On SPAs where filters mirror URL params (e.g., LinkedIn `f_WT`/`f_TPR`), a synthetic click on a React-controlled hidden input may be silently ignored: if a click shows no effect, ONE bounded `navigate_page` with the param set is acceptable; record the site's address-bar tolerance in memory.

### 7. Cache results — checkpoints as you work
Check `mem:private/<site>/<task>-<YYYY-MM-DD>` before extracting; each dated memory records its TTL ("Fresh for 24 h; re-run if older or if count differs"); fresh hit → skip re-extraction. Mandatory checkpoints: write every intermediate result AS WORK PROCEEDS — after each search/results list, page, category — into the same dated memory; never wait for the end (an early stop still leaves partials persisted). Caches are session-derived → private by default (`private/{site}/{task}-<YYYY-MM-DD>`, `private/about`); extraction recipes hold no PII and stay public at `browser-automation/<site>/<task>-extraction`. Partial-cache rule: a fresh dated cache may hold fewer results than required — if it covers the task's count, skip; else re-extract the gap and UPDATE the same memory, never a second one.

### 8. Store/refresh selectors
Maintain `mem:browser-automation/<site>/<task>-extraction`: verified selectors, verification date stamp, primary + stale/fallback selectors (sites A/B test class names; superseded ones become fallbacks). Run the [BLOCKING GATE](../references/memory-management-checklist.md) before every write.

### 9. Drift recovery
Probe a sentinel element (one cheap `evaluate_script` returning a boolean/count) before trusting stored selectors. Empty/wrong fields → recorded fallbacks; then re-derive cheaply: dump ONE item's relevant nodes only — never the whole page — identify current classes, update memory with a new verified date. Heroic parsing of full DOM dumps is the last resort.

### 10. Anti-bot protocol
Bot-alert signals: CAPTCHA iframe, "verify you are human" copy, 403 alert page, blocked/rate-limit copy. On any signal: STOP all actions immediately → write partials to `private/` (Step 7 checkpoints hold most already) → report signal + cached state to the operator. No retries, no looped `new_page` — address-bar navigation is itself a bot signal (Step 3).

### 11. Fail fast
Retries are bounded and in-script only. Script error and no recorded fallback → **stop** and report, including the raw partial response for diagnosis. Never loop.

## Battle-test lessons

- **`:has()` resolves to the OUTERMOST ancestor:** prefer `parentElement`/`closest()` ancestor stepping; zero-size inputs signal the real clickable is an ancestor.
- **Pattern-based field matching:** with conditional spans (e.g., attribution before view counts), match meta fields by regex role (`/^[0-9.,KMB]+ views?$/`, `/ago|year|month|week|day|hour/`) rather than positional index.
- Other lessons live in Shared rules and Steps: textContent-vs-innerText → `textOf`; hydration timing → `WAIT_FOR_SELECTOR`; quote double-decoding → zero-backslash rule; stale-route shells (`visible: false`) → C; long tracking hrefs → `shortHref`; `new_page` returns a pages table → D1.

## Acceptance Criteria

- Sandbox activated with `devtools` + `serena` only, under a descriptive name.
- Auth verified via `list_pages` before any navigation; login wall → STOP and escalate.
- Structure discovery on an unfamiliar site used a targeted `evaluate_script` first; any `take_snapshot` was INLINE with NO `filePath` and truncated in-script to ~2 KB — one per flow, never for extraction.
- Extraction returns only needed fields, hard-capped at 3 KB per result, parsed via `unwrap`.
- Intra-page navigation used clicks; cross-URL navigation was paced (≥1 s) and the site's address-bar tolerance recorded.
- ≥1 s inter-action gaps observed and ≤40 actions per task (pacing/action-budget helpers: [truncation-examples.md §E](../references/truncation-examples.md)).
- Results checkpoint-cached in dated `private/` memories with a TTL; fresh hits skip re-extraction.
- Selector memory stamped with a verification date and fallbacks; BLOCKING GATE run before every write.
- On drift, a fallback or a cheap targeted re-derivation resolved it; the memory was updated.
- Bot-alert STOP sequence executed and partials cached, if any alert occurred.
- Fail-fast path executed (STOP + report) whenever no fallback worked.
- Interactive-element discovery used the battle-tested snippets (A–D): clickables listed with a limit, filtered by type/text with self-verified unique selectors, effect-verified clicks (WARNING on no state change), inputs filtrable with visibility flags, and the combined navigate+list flow.

## Exit Criteria

- Task data is extracted, cached, and — where applicable — the selector memory is current.
- No operator tabs were touched beyond reading `list_pages`.
- If we stopped early: the operator received the raw partial response and a clear reason.

## Clarification Triggers

Ask the operator before:
- touching or navigating tabs we did not create;
- any action that might log the session out (navigating the session tab away from authenticated domains, closing it);
- batch runs longer than N items — confirm N with the operator first;
- batch runs that would exceed the per-task action budget (default ≤40, tunable in site memory) — confirm the exact N first;
- any bot-alert occurrence — report to the operator immediately with the signal and the cached partials.

## Shared rules and helpers

- **Quoting:** single quotes at code-mode level, double quotes inside the `evaluate_script` source, array-join for multi-line strings, `String.fromCharCode(10)` for newlines, `String.fromCharCode(34)` for quotes — never backslashes.
- **Zero-backslash rule:** code-mode double-decodes backslash escapes, so any `\` in page source throws `SyntaxError` (verified live on YouTube round 1); build special characters via `String.fromCharCode`.
- **3 KB cap:** every return is hard-capped — `LIMIT`/`MAX_TEXT` cap the data and wrappers return `JSON.stringify(result).slice(0, 3000)` ([truncation-examples.md §C](../references/truncation-examples.md)).
- **Selector-quoting gotcha:** attribute-selector values with special characters (`.`, `/`, `=`, `-`) must be quoted or `querySelectorAll` throws `not a valid selector` — `a[href*="example.com"]`, NOT `a[href*=example.com]` (devtools-known-issues #18).
- **Two-call pattern:** discover via B, click via B2 in the NEXT `evaluate_script` call with the emitted `uniqueSelector`. The DOM persists between calls, so a verified selector stays valid unless the page re-rendered.
- **WARNING semantics:** B2's `WARNING: ... no state change detected` means the click did NOT register — treat as "not applied"; verify via a re-list (B) or a state/URL probe.
- **Pacing:** ≥1 s between distinct actions, ≥250 ms between transitions, bounded polls (default 4 s / 120 ms), ≤40 actions ([truncation-examples.md §E](../references/truncation-examples.md)).

**Return parsing — ALWAYS go through `unwrap`.** `evaluate_script` returns a markdown-wrapped string (`Script ran on page and returned:` + a `json`-fenced block) whose value may be an object, array, **or a plain string** — "strip to the first `{` and the last `}`" fails on string returns and on double-encoded values. `JSON.parse` the whole fenced block; detect the plain-error-string prefix (`Error:` / `SyntaxError:` etc.) before parsing. Use this helper (canonical here — devtools-known-issues #11 points at this file) for every `evaluate_script` return:

```javascript
function unwrap(raw) {
  var s = String(raw);
  var body = s;
  var fence = '```json';
  var i = s.indexOf(fence);
  if (i >= 0) {
    var j = s.indexOf('```', i + fence.length);
    if (j >= 0) { body = s.slice(i + fence.length, j); }
  }
  if (/^(Error|SyntaxError|TypeError|ReferenceError|No snapshot)/.test(body.trim())) {
    throw new Error(body.trim().slice(0, 300));
  }
  return JSON.parse(body);
}
```

The helper must never contain backslash escapes (the old escaped-regex version threw `SyntaxError: missing ) after argument list`, verified live on YouTube round 1). `evaluate_script` already serializes the page's return value — do NOT `JSON.stringify` inside the page.

**Install the page helpers (once per page load).** The page JS realm persists across `evaluate_script` calls (already proven in-file by `window.__ctxSeq`), so helpers installed once survive until navigation. **Re-install after every `new_page`/`navigate_page` — navigation destroys the realm.** Every snippet starts with `var H = window.__H;` and calls helpers as `H.<name>`. Unifications vs the older per-snippet copies: `visible` uses the offsetParent variant (an element with a negative bounding-box dimension flips visible to false in C's listing); `textOf` uses the full variant (value/select handling — C's reduced version was a subset); `sig` uses B2's version with the ctrl probe (D2's effect detection becomes richer — strictly a superset).

```javascript
// X — Install the page helpers once per page load. Re-run after every new_page/navigate_page.
var js = [
  '() => {',
  '  var Q = String.fromCharCode(34);',
  '  var SIG_KEYS = ["checked", "aria-expanded", "aria-pressed", "aria-selected", "className"];',
  '  var CANDIDATES = ["button", "a[href]", "[role=" + Q + "button" + Q + "]", "input[type=" + Q + "submit" + Q + "]", "input[type=" + Q + "button" + Q + "]", "input[type=" + Q + "checkbox" + Q + "]", "input[type=" + Q + "radio" + Q + "]", "summary", "select", "label", "[role=" + Q + "option" + Q + "]"];',
  '  function textOf(el) { var t = el.innerText; if (t && t.trim()) { return t.trim(); } t = (el.textContent || "").trim(); if (!t && el.tagName === "INPUT") { t = (el.value || "").trim(); } if (el.tagName === "SELECT" && el.options && el.options[el.selectedIndex]) { t = el.options[el.selectedIndex].text.trim(); } return t; }',
  '  function visible(el) { var r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) { return false; } if (el.offsetParent === null) { var st = window.getComputedStyle(el); if (st.display === "none" || st.visibility === "hidden") { return false; } } return true; }',
  '  function trunc(s, maxText) { if (s.length > maxText) { s = s.slice(0, maxText - 3) + "..."; } return s; }',
  '  function shortHref(el) { var h = el.href; if (!h) { return ""; } if (h.length <= 120) { return h; } try { var u = new URL(h); return u.origin + u.pathname; } catch (e) { return h.slice(0, 120); } }',
  '  async function waitHydrated(sel) { if (!sel) { return; } var deadline = Date.now() + 4000; while (Date.now() < deadline) { if (document.querySelectorAll(sel).length > 0) { return; } await new Promise(function (r) { setTimeout(r, 120); }); } }',
  '  function isCheckRadio(el) { return (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")); }',
  '  function labelText(el) {',
  '    var lab = (el.labels && el.labels[0]) || (el.closest ? el.closest("label") : null); if (lab) { var lt = textOf(lab); if (lt) { return lt; } }',
  '    var v = (el.value === undefined || el.value === null) ? "" : String(el.value).trim(); if (v && (el.type === "submit" || el.type === "button")) { return v; } return el.type || "checkbox";',
  '  }',
  '  function cssPath(el) {',
  '    var parts = []; var node = el;',
  '    while (node && node !== document.body && node !== document.documentElement) { var parent = node.parentElement; if (!parent) { break; } var tag = node.tagName.toLowerCase(); var nth = Array.from(parent.children).filter(function (c) { return c.tagName === node.tagName; }).indexOf(node) + 1; parts.unshift(tag + ":nth-of-type(" + nth + ")"); node = parent; }',
  '    return "body > " + parts.join(" > ");',
  '  }',
  '  function uniqueSel(el) {',
  '    var s, v, j;',
  '    if (el.id && typeof CSS !== "undefined" && CSS.escape) { s = "#" + CSS.escape(el.id); if (document.querySelector(s) === el) { return s; } }',
  '    var stables = ["data-testid", "data-test", "name", "aria-label"];',
  '    for (j = 0; j < stables.length; j++) { v = el.getAttribute(stables[j]); if (v && v.indexOf(Q) < 0) { s = el.tagName.toLowerCase() + "[" + stables[j] + "=" + Q + v + Q + "]"; if (document.querySelector(s) === el) { return s; } } }',
  '    s = cssPath(el); if (document.querySelector(s) === el) { return s; }',
  '    var seq = (window.__ctxSeq || 0) + 1; window.__ctxSeq = seq;',
  '    el.setAttribute("data-el", "t" + seq);',
  '    return el.tagName.toLowerCase() + "[data-el=" + Q + "t" + seq + Q + "]";',
  '  }',
  '  function ctrl(el) { var lab = (el.tagName === "LABEL") ? el : (el.closest ? el.closest("label") : null); if (lab) { if (lab.control) { return lab.control; } var q = lab.querySelector("input"); if (q) { return q; } if (lab.parentElement) { q = lab.parentElement.querySelector("input"); if (q) { return q; } } } return null; }',
  '  function sig(el) {',
  '    var s = { href: location.href }; var i, v, ci;',
  '    for (i = 0; i < SIG_KEYS.length; i++) { if (SIG_KEYS[i] === "checked") { v = el.checked; } else if (SIG_KEYS[i] === "className") { v = String(el.className); } else { v = el.getAttribute(SIG_KEYS[i]); } if (v !== null && v !== undefined && v !== "") { s[SIG_KEYS[i]] = v; } }',
  '    ci = ctrl(el);',
  '    if (ci) { if (ci.checked !== undefined && ci.checked !== "") { s.inputChecked = ci.checked; } if (ci.value !== undefined && ci.value !== "") { s.inputValue = ci.value; } if (ci.selected !== undefined && ci.selected !== "") { s.inputSelected = ci.selected; } }',
  '    return s;',
  '  }',
  '  function sigChanged(a, b) { var k; for (k in a) { if (a[k] !== b[k]) { return true; } } for (k in b) { if (b[k] !== a[k]) { return true; } } return false; }',
  '  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }',
  '  window.__H = { textOf: textOf, visible: visible, trunc: trunc, shortHref: shortHref, waitHydrated: waitHydrated, isCheckRadio: isCheckRadio, labelText: labelText, cssPath: cssPath, uniqueSel: uniqueSel, ctrl: ctrl, sig: sig, sigChanged: sigChanged, sleep: sleep, CANDIDATES: CANDIDATES };',
  '  return "helpers installed";',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## Examples

### SELECTOR extraction (Step-5 minimal extractor)
Set `SELECTOR` from `mem:browser-automation/<site>/<task>-extraction`; adapt the mapped fields (e.g., id, title, href) to whatever that site's memory records. Quoting/rules as in Shared rules. For click-wait-read flows, wrap the same body in `async () => { ... }` and bounded-poll `location.href` (4 s deadline, 120 ms sleep) after `click()` — see Step 6 / D2.

```javascript
var SELECTOR = ''; /* set from mem:browser-automation/<site>/<task>-extraction */
var js = [
  '() => Array.from(document.querySelectorAll(SELECTOR)).map(function (el, i) {',
  '  return {id: i, title: el.textContent.trim(), href: el.href};',
  '})'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### A — List clickable elements (limit-capped)
Candidate set: `button`, `a[href]`, `[role="button"]`, `input[type="submit"]`, `input[type="button"]`, `summary`, `select` — visible only, empty-text excluded. Returns `{count, items}` (`count` = number RETURNED, capped by `LIMIT`, not total matches). Hrefs longer than 120 chars trimmed to `origin + pathname` (long tracking blobs dropped — use site memory for full URLs). `WAIT_FOR_SELECTOR` bounded-polls (4 s / 120 ms) for a hydration selector before listing; `''` = disabled. **Use:** `LIMIT`, `MAX_TEXT`, `WAIT_FOR_SELECTOR`.

```javascript
// A — List clickable elements (plain, LIMIT-capped). Uses helpers installed by X.
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var LIMIT = 20;',
  '  var MAX_TEXT = 80;',
  '  var WAIT_FOR_SELECTOR = "";',
  '  var Q = String.fromCharCode(34);',
  '  var CANDIDATES = ["button", "a[href]", "[role=" + Q + "button" + Q + "]", "input[type=" + Q + "submit" + Q + "]", "input[type=" + Q + "button" + Q + "]", "summary", "select"];',
  '  await H.waitHydrated(WAIT_FOR_SELECTOR);',
  '  var nodes = [];',
  '  CANDIDATES.forEach(function (sel) { nodes = nodes.concat(Array.from(document.querySelectorAll(sel))); });',
  '  nodes = Array.from(new Set(nodes));',
  '  var out = [];',
  '  nodes.forEach(function (el) {',
  '    if (out.length >= LIMIT) { return; }',
  '    if (!H.visible(el)) { return; }',
  '    var text = H.trunc(H.textOf(el), MAX_TEXT);',
  '    if (!text) { return; }',
  '    var h = H.shortHref(el);',
  '    var row = { tag: el.tagName.toLowerCase(), text: text };',
  '    if (h) { row.href = h; }',
  '    if (el.type) { row.type = el.type; }',
  '    out.push(row);',
  '  });',
  '  return { count: out.length, items: out };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + result.count + ' clickables: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```
### B — Filter clickables by type + text, self-verified unique selector
Candidate set = A's set plus `label`, `[role="option"]`, and `input[type="checkbox"]`/`input[type="radio"]` via `H.CANDIDATES` (Set-deduped — an element matching several selectors counts once). Checkbox/radio inputs skip the visibility check (typically zero-size/visually hidden); their display text comes from the associated label, falling back to `value` for submit/button inputs, else the type name. Every hit carries `uniqueSelector` and `verified: true` (held at discovery time: `document.querySelector(uniqueSelector) === el`). `TYPE` accepts `any`, `button`, `a`, `button,a`, `label`, `[role="option"]`, etc. (comma-separated; values containing double quotes use the `Q` concatenation pattern). `TEXT` is a case-insensitive substring match on display text. **Use:** `TYPE`, `TEXT`, `LIMIT`, `MAX_TEXT`, `WAIT_FOR_SELECTOR`.

```javascript
// B — Clickables filterable by TYPE and TEXT, each with a self-verified unique selector.
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var TYPE = "any";',
  '  var TEXT = "";',
  '  var LIMIT = 20;',
  '  var MAX_TEXT = 80;',
  '  var WAIT_FOR_SELECTOR = "";',
  '  await H.waitHydrated(WAIT_FOR_SELECTOR);',
  '  var nodes = [];',
  '  H.CANDIDATES.forEach(function (sel) { nodes = nodes.concat(Array.from(document.querySelectorAll(sel))); });',
  '  nodes = Array.from(new Set(nodes));',
  '  var out = [];',
  '  nodes.forEach(function (el) {',
  '    if (out.length >= LIMIT) { return; }',
  '    if (!H.isCheckRadio(el) && !H.visible(el)) { return; }',
  '    var text = H.isCheckRadio(el) ? H.labelText(el) : H.textOf(el);',
  '    if (!text) { return; }',
  '    if (TYPE !== "any") {',
  '      var okType = false;',
  '      TYPE.split(",").forEach(function (t) { if (el.matches(t.trim())) { okType = true; } });',
  '      if (!okType) { return; }',
  '    }',
  '    if (TEXT && text.toLowerCase().indexOf(TEXT.toLowerCase()) < 0) { return; }',
  '    var h = H.shortHref(el);',
  '    var row = { tag: el.tagName.toLowerCase(), text: H.trunc(text, MAX_TEXT), uniqueSelector: H.uniqueSel(el), verified: true };',
  '    if (h) { row.href = h; }',
  '    if (el.type) { row.type = el.type; }',
  '    out.push(row);',
  '  });',
  '  return { count: out.length, items: out };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + result.count + ' clickables: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### C — List inputs, filterable, visible flag
Candidate set: `input`, `select`, `textarea`, `[contenteditable="true"]`. Returns `{count, items}` with `{tag, type, visible, name?, id?, placeholder?, value?, uniqueSelector}`; filter by input `TYPE` (`all`, `text`, `email`, `search`, `password`, ...) and a case-insensitive `TEXT` match against name/id/placeholder/label text. `value` is truncated to `MAX_TEXT` and omitted for `type="password"`. `visible: false` fields exist in the DOM but are not interactable — SPA stale-route shells stay mounted; interactive count ≠ visible count; filter on visibility when counting or interacting. **Use:** `TYPE`, `TEXT`, `LIMIT`, `MAX_TEXT`.

```javascript
// C — Form fields (input/select/textarea/contenteditable), filterable by TYPE and TEXT.
var js = [
  '() => {',
  '  var H = window.__H;',
  '  var TYPE = "all";',
  '  var TEXT = "";',
  '  var LIMIT = 20;',
  '  var MAX_TEXT = 80;',
  '  var Q = String.fromCharCode(34);',
  '  var CANDIDATES = ["input", "select", "textarea", "[contenteditable=" + Q + "true" + Q + "]"];',
  '  function fieldText(el) {',
  '    var parts = [el.name, el.id, el.placeholder];',
  '    if (el.labels && el.labels.length) { parts.push(H.textOf(el.labels[0])); }',
  '    return parts.filter(function (s) { return s && String(s).trim(); }).join(" ").trim();',
  '  }',
  '  var nodes = [];',
  '  CANDIDATES.forEach(function (sel) { nodes = nodes.concat(Array.from(document.querySelectorAll(sel))); });',
  '  nodes = Array.from(new Set(nodes));',
  '  var out = [];',
  '  nodes.forEach(function (el) {',
  '    if (out.length >= LIMIT) { return; }',
  '    var tag = el.tagName.toLowerCase();',
  '    var type = el.type ? String(el.type) : "";',
  '    if (TYPE !== "all" && type !== TYPE) { return; }',
  '    if (TEXT && fieldText(el).toLowerCase().indexOf(TEXT.toLowerCase()) < 0) { return; }',
  '    var row = { tag: tag, type: type, visible: H.visible(el), uniqueSelector: H.uniqueSel(el) };',
  '    if (el.name) { row.name = el.name; }',
  '    if (el.id) { row.id = el.id; }',
  '    if (el.placeholder) { row.placeholder = H.trunc(String(el.placeholder), MAX_TEXT); }',
  '    var v = (el.value === undefined || el.value === null) ? "" : String(el.value);',
  '    if (type !== "password") { row.value = H.trunc(v, MAX_TEXT); }',
  '    out.push(row);',
  '  });',
  '  return { count: out.length, items: out };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + result.count + ' form fields: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### B2 — Effect-verified click companion (separate `evaluate_script` call)
Paste a B-emitted `uniqueSelector` into `SEL` and run B2 as the NEXT `evaluate_script` call. A state signature (`location.href` plus whichever of `checked`/`aria-expanded`/`aria-pressed`/`aria-selected`/`className` exist on the target) is captured before and bounded-polled (2 s / 120 ms) after. Checkbox/radio targets click their label/ancestor (`closest("label") || parentElement`) — a real label receives the user gesture a synthetic input click does not — and the signature is input-aware (probes the label's control input via `H.ctrl`, so a checkbox/radio flip is observable even when the click landed on the label). If the first click shows no state change, it retries ONCE by clicking the input directly. Returns `OK: clicked <label> (state changed)` / `OK: clicked <label> (state changed on retry)` / `WARNING: clicked <label> but no state change detected` — a WARNING means the click did NOT register; treat as "not applied" (verify via re-list or a state/URL probe). **Use:** `SEL` embedded single-quoted, delimiters built with `String.fromCharCode(39)` — no backslashes. `POLL_DEADLINE_MS`/`POLL_SLEEP_MS` default 2000/120.

```javascript
// B2 — Effect-verified click companion: click a unique selector in its own evaluate_script call.
var SEL = 'REPLACE_WITH_UNIQUE_SELECTOR';
var SQ = String.fromCharCode(39);
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var sel = ' + SQ + SEL + SQ + ';',
  '  var el = document.querySelector(sel);',
  '  if (!el) { throw new Error("no element for selector: " + sel); }',
  '  var POLL_DEADLINE_MS = 2000;',
  '  var POLL_SLEEP_MS = 120;',
  '  var isCheck = (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio"));',
  '  var target = isCheck ? (el.closest("label") || el.parentElement || el) : el;',
  '  var sig0 = H.sig(el);',
  '  target.click();',
  '  var label = (H.textOf(target) || target.tagName.toLowerCase()).trim();',
  '  if (label.length > 60) { label = label.slice(0, 57) + "..."; }',
  '  var deadline = Date.now() + POLL_DEADLINE_MS;',
  '  var ok = false;',
  '  while (Date.now() < deadline) {',
  '    await H.sleep(POLL_SLEEP_MS);',
  '    if (H.sigChanged(sig0, H.sig(el))) { ok = true; break; }',
  '  }',
  '  if (!ok && isCheck && target !== el) {',
  '    var inp = H.ctrl(target);',
  '    if (inp && inp !== target) {',
  '      inp.click();',
  '      deadline = Date.now() + POLL_DEADLINE_MS;',
  '      while (Date.now() < deadline) {',
  '        await H.sleep(POLL_SLEEP_MS);',
  '        if (H.sigChanged(sig0, H.sig(el))) { ok = true; break; }',
  '      }',
  '      if (ok) { return "OK: clicked " + label + " (state changed on retry)"; }',
  '    }',
  '  }',
  '  if (ok) { return "OK: clicked " + label + " (state changed)"; }',
  '  return "WARNING: clicked " + label + " but no state change detected";',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### D1 — Open page + load probe
D1 and D2 are two code-mode scripts run in order against the same devtools page (run the Step-2 auth check before D1). D1 opens `TARGET_URL` with `new_page` and confirms the load with a title/url probe (`new_page` returns a plain string — a markdown pages table, not a page id — so D1 wraps it in try/catch without `unwrap`). **Run the install snippet X first** so the helpers exist in the new page's realm for D2.

```javascript
// D1 — Open the target page, then confirm the load with a title/url probe.
// Fill TARGET_URL (single-quoted, code-mode level). Run the install snippet X first.
var TARGET_URL = 'REPLACE_WITH_TARGET_URL';
var probeJs = [
  '() => ({ title: document.title, url: location.href })'
].join(String.fromCharCode(10));
try {
  var page = new_page({ url: TARGET_URL });
  var probe = unwrap(evaluate_script({function: probeJs}));
  var title = String((probe && probe.title) || '').trim();
  var url = String((probe && probe.url) || '').trim() || TARGET_URL;
  if (!title) {
    return 'ERROR: loaded ' + url + ' but document.title is empty';
  }
  return 'OK: loaded ' + title + ' (' + url + ')';
} catch (e) {
  return 'ERROR: new_page or load probe failed: ' + e.message;
}
```

### D2 — Combined: list, click by text, re-list (paced)
Runs ONE async `evaluate_script`: list interactive elements (`before`), optionally click one matching `TEXT` via its unique selector with full pacing (≥1 s actions, ≥250 ms transitions, bounded poll 4 s / 120 ms, ≤40 actions), then re-list (`after`). Returns `{before, clicked, after}`; when `clicked.effect` is false the wrapper returns `WARNING: ... no state change detected` (treat as "not applied"). D2 exercises the full navigate → list → click → re-list pattern in one async call. **Use:** `TEXT` (`''` = list only, no click), `WAIT_FOR_SELECTOR`; pacing/poll constants `PACE_ACTION_MS`/`PACE_TRANSITION_MS`/`POLL_DEADLINE_MS`/`POLL_SLEEP_MS`/`MAX_ACTIONS` (defaults above).

```javascript
// D2 — List interactive elements; optionally click one matching TEXT via its unique selector,
// with full pacing (>=1 s actions, >=250 ms transitions, bounded poll 4 s/120 ms), then re-list.
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var TEXT = "REPLACE_WITH_TEXT";',
  '  var LIMIT = 20;',
  '  var MAX_TEXT = 80;',
  '  var WAIT_FOR_SELECTOR = "";',
  '  var PACE_ACTION_MS = 1000;',
  '  var PACE_TRANSITION_MS = 250;',
  '  var POLL_DEADLINE_MS = 4000;',
  '  var POLL_SLEEP_MS = 120;',
  '  var MAX_ACTIONS = 40;',
  '  var actions = 0;',
  '  function action() { actions++; if (actions > MAX_ACTIONS) { throw new Error("action budget exceeded (" + MAX_ACTIONS + ") — STOP"); } }',
  '  function allNodes() {',
  '    var nodes = [];',
  '    H.CANDIDATES.forEach(function (sel) { nodes = nodes.concat(Array.from(document.querySelectorAll(sel))); });',
  '    return Array.from(new Set(nodes));',
  '  }',
  '  function listInteractive() {',
  '    var out = [];',
  '    allNodes().forEach(function (el) {',
  '      if (out.length >= LIMIT) { return; }',
  '      if (!H.isCheckRadio(el) && !H.visible(el)) { return; }',
  '      var text = H.isCheckRadio(el) ? H.labelText(el) : H.textOf(el);',
  '      text = H.trunc(text, MAX_TEXT);',
  '      if (!text) { return; }',
  '      var h = H.shortHref(el);',
  '      var row = { tag: el.tagName.toLowerCase(), text: text };',
  '      if (h) { row.href = h; }',
  '      if (el.type) { row.type = el.type; }',
  '      out.push(row);',
  '    });',
  '    return { count: out.length, items: out };',
  '  }',
  '  function countMatches() { return allNodes().filter(function (el) { return H.isCheckRadio(el) || H.visible(el); }).length; }',
  '  await H.waitHydrated(WAIT_FOR_SELECTOR);',
  '  var out = { before: null, clicked: null, after: null };',
  '  out.before = listInteractive();',
  '  if (TEXT) {',
  '    var target = null;',
  '    allNodes().forEach(function (el) {',
  '      if (target) { return; }',
  '      var t = H.isCheckRadio(el) ? H.labelText(el) : H.textOf(el);',
  '      if (t && t.toLowerCase().indexOf(TEXT.toLowerCase()) >= 0) { target = el; }',
  '    });',
  '    if (!target) { out.clicked = "not found: " + TEXT; }',
  '    else {',
  '      var sel = H.uniqueSel(target);',
  '      var beforeCount = countMatches();',
  '      var isCheck = (target.tagName === "INPUT" && (target.type === "checkbox" || target.type === "radio"));',
  '      var clickTarget = isCheck ? (target.closest("label") || target.parentElement || target) : target;',
  '      var sig0 = H.sig(target);',
  '      action();',
  '      clickTarget.click();',
  '      await H.sleep(PACE_ACTION_MS);',
  '      var deadline = Date.now() + POLL_DEADLINE_MS;',
  '      var changed = false;',
  '      var effect = false;',
  '      while (Date.now() < deadline) {',
  '        await H.sleep(POLL_SLEEP_MS);',
  '        if (countMatches() !== beforeCount) { changed = true; }',
  '        if (!document.querySelector(sel)) { changed = true; }',
  '        if (H.sigChanged(sig0, H.sig(target))) { effect = true; }',
  '        if (changed || effect) { break; }',
  '      }',
  '      await H.sleep(PACE_TRANSITION_MS);',
  '      out.clicked = { text: H.trunc(H.textOf(target), MAX_TEXT), selector: sel, changed: changed, effect: effect };',
  '      out.after = listInteractive();',
  '    }',
  '  }',
  '  return out;',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  var msg = 'OK: ' + result.before.count + ' clickables before';
  if (result.clicked) {
    if (typeof result.clicked === 'string') { msg += ', ' + result.clicked; }
    else if (!result.clicked.effect) {
      msg = 'WARNING: clicked ' + result.clicked.text + ' but no state change detected';
    } else { msg += ', clicked: ' + result.clicked.text + ' (state changed)'; }
    if (result.after) { msg += ', ' + result.after.count + ' after'; }
  }
  msg += ' | ' + JSON.stringify(result).slice(0, 3000);
  return msg;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Cut-notes
- Single-call click-by-text is D2 with `TEXT` set (supersedes the standalone "Click by text" snippet).
- Text-filtered structure discovery is B (interactive) or the Step-4 pattern (any node).
