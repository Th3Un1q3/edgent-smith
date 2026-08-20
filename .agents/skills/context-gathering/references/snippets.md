# Reference: DevTools Browser Automation — Snippet Library

Canonical copy-paste snippets for the [browser-automation-devtools workflow](../workflows/browser-automation-devtools.md). Snippets are standalone but expect the helpers from [X](#x-install-helpers-once-per-page-load) and the [`unwrap`](#unwrap) helper.

**When to load:** when a workflow step points here (Steps 3–6, Shared rules), or any time you need a ready-made `evaluate_script` body for clickable/input discovery, effect-verified clicks, navigation probes, paced click-throughs, chart extraction, structure discovery, sentinel drift probes, or pagination loops.

**Quoting:** the zero-backslash / zero-double-quote rule ([devtools-known-issues.md](./devtools-known-issues.md) #21) targets HAND-WRITTEN scripts and the JSON-encoding layer of `gateway_mcp_exec` — hand-written code that is not pre-verified gets mangled by the harness. The canonical snippets below are pre-checked to pass through that layer safely: paste them verbatim, do not re-escape, do not add backslashes. When writing NEW scripts, keep to single-quoted JS strings and avoid raw double quotes and backslashes inside them; build special characters with `String.fromCharCode`.

**Contents**

- [X — install helpers](#x-install-helpers-once-per-page-load)
- [unwrap](#unwrap)
- [SELECTOR — minimal extractor](#selector-minimal-extractor)
- [discover — targeted structure discovery](#discover-targeted-structure-discovery)
- [A — list clickables](#a-list-clickables)
- [B — filter clickables](#b-filter-clickables)
- [C — list inputs](#c-list-inputs)
- [B2 — effect-verified click](#b2-effect-verified-click)
- [D1 — open page and probe](#d1-open-page-and-probe)
- [probe — sentinel drift probe](#probe-sentinel-drift-probe)
- [D2 — list, click, re-list](#d2-list-click-and-relist)
- [paginate — generic pagination loop](#paginate-generic-pagination-loop)
- [E — LinkedIn hiring trends](#e-linkedin-hiring-trends)

## X install helpers once per page load

Run this FIRST, once per page load. The page JS realm persists across `evaluate_script` calls, so helpers installed once survive until navigation. **Re-install after every `new_page`/`navigate_page` — navigation destroys the realm.** Every snippet starts with `var H = window.__H;` and calls helpers as `H.<name>`. Helper registry: `textOf`, `visible`, `trunc`, `shortHref`, `waitHydrated`, `isCheckRadio`, `labelText`, `cssPath`, `uniqueSel`, `ctrl`, `sig`, `sigChanged`, `sleep`, `CANDIDATES`.

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

## unwrap

Parse EVERY `evaluate_script` return through this helper. `evaluate_script` returns a markdown-wrapped string (`Script ran on page and returned:` + a `json`-fenced block) whose value may be an object, array, **or a plain string** — "strip to the first `{` and the last `}`" fails on string returns and on double-encoded values. Parse the whole fenced block; detect the plain-error-string prefix (`Error:` / `SyntaxError:` etc.) before parsing (devtools-known-issues #11). Never `JSON.stringify` inside the page — the harness already serializes the return value.

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

## SELECTOR minimal extractor

Minimal extraction for Step 5. Set `SELECTOR` from the site's extraction memory; adapt the mapped fields (id, title, href) to what that memory records. For click-wait-read flows, wrap the same body in `async () => { ... }` and bounded-poll `location.href` after `click()` — see [D2](#d2-list-click-and-relist).

```javascript
var SELECTOR = 'REPLACE_WITH_SELECTOR'; /* set from mem:browser-automation/<site>/<task>-extraction */
var SQ = String.fromCharCode(39);
var js = [
  '() => {',
  '  var sel = ' + SQ + SELECTOR + SQ + ';',
  '  return Array.from(document.querySelectorAll(sel)).map(function (el, i) {',
  '    return {id: i, title: el.textContent.trim(), href: el.href};',
  '  });',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## discover targeted structure discovery

Targeted structure discovery for workflow Step 4 on unfamiliar sites. Returns only the nodes whose text matches `TEXT` — `{tag, text, href, class}`, capped at `LIMIT` — the cheap `take_snapshot` alternative (no a11y dump, no context flood). With `TEXT` empty, only leaf nodes (no element children) are returned so the result stays small. **Set:** `TEXT` (case-insensitive substring of `textContent`), `LIMIT` (default 20). Which text to hunt is a site-specific fact — it lives in the site's extraction memory, this snippet stays generic.

```javascript
// discover — targeted structure discovery (workflow Step 4): nodes whose text matches TEXT.
var js = [
  '() => {',
  '  var H = window.__H;',
  '  var TEXT = "REPLACE_WITH_TEXT";',
  '  var LIMIT = 20;',
  '  var MAX_TEXT = 120;',
  '  var out = [];',
  '  Array.from(document.querySelectorAll("body *")).forEach(function (el) {',
  '    if (out.length >= LIMIT) { return; }',
  '    var t = (el.textContent || "").trim();',
  '    if (!t) { return; }',
  '    if (TEXT && t.toLowerCase().indexOf(TEXT.toLowerCase()) < 0) { return; }',
  '    if (!TEXT && el.children.length) { return; }',
  '    var row = { tag: el.tagName.toLowerCase(), text: H.trunc(t, MAX_TEXT) };',
  '    var h = H.shortHref(el);',
  '    if (h) { row.href = h; }',
  '    if (el.className) { row.class = String(el.className).slice(0, 80); }',
  '    out.push(row);',
  '  });',
  '  return { count: out.length, items: out };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: ' + result.count + ' matching nodes: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## A list clickables

List clickable elements, limit-capped. Candidate set: `button`, `a[href]`, `[role="button"]`, `input[type="submit"]`, `input[type="button"]`, `summary`, `select` — visible only, empty-text excluded. Returns `{count, items}` (`count` = number RETURNED, capped by `LIMIT`, not total matches). Hrefs longer than 120 chars trimmed to `origin + pathname` (long tracking blobs dropped — use site memory for full URLs). `WAIT_FOR_SELECTOR` bounded-polls for a hydration selector before listing; `''` = disabled. **Set:** `LIMIT`, `MAX_TEXT`, `WAIT_FOR_SELECTOR`.

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

## C list inputs

List inputs, filterable, visible flag. Candidate set: `input`, `select`, `textarea`, `[contenteditable="true"]`. Returns `{count, items}` with `{tag, type, visible, name?, id?, placeholder?, value?, uniqueSelector}`; filter by input `TYPE` (`all`, `text`, `email`, `search`, `password`, ...) and a case-insensitive `TEXT` match against name/id/placeholder/label text. `value` is truncated to `MAX_TEXT` and omitted for `type="password"`. `visible: false` fields exist in the DOM but are not interactable — SPA stale-route shells stay mounted; interactive count ≠ visible count; filter on visibility when counting or interacting. **Set:** `TYPE`, `TEXT`, `LIMIT`, `MAX_TEXT`.

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

## B2 effect verified click

Effect-verified click companion — run as a SEPARATE `evaluate_script` call, the NEXT call after discovery. Paste a B-emitted `uniqueSelector` into `SEL`. A state signature (`location.href` plus whichever of `checked`/`aria-expanded`/`aria-pressed`/`aria-selected`/`className` exist on the target) is captured before and bounded-polled after. Checkbox/radio targets click their label/ancestor (`closest("label") || parentElement`) — a real label receives the user gesture a synthetic input click does not — and the signature is input-aware (probes the label's control input via `H.ctrl`, so a checkbox/radio flip is observable even when the click landed on the label). If the first click shows no state change, it retries ONCE by clicking the input directly. Returns `OK: clicked <label> (state changed)` / `OK: clicked <label> (state changed on retry)` / `WARNING: clicked <label> but no state change detected` — a WARNING means the click did NOT register; treat as "not applied" (verify via re-list or a state/URL probe). **Set:** `SEL` embedded single-quoted, delimiters built with `String.fromCharCode(39)` — no backslashes. `POLL_DEADLINE_MS`/`POLL_SLEEP_MS` default 2000/120.

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

## D1 open page and probe

Open the target page, then confirm the load with a title/url probe. D1 and [D2](#d2-list-click-and-relist) are two code-mode scripts run in order against the same devtools page — run the workflow's Step-2 auth check before D1, and run [X](#x-install-helpers-once-per-page-load) again AFTER D1's `new_page` and BEFORE D2/paginate — `new_page` destroys the realm, so helpers installed before D1 do not survive into the new page. `new_page` returns a plain string (a markdown pages table), not a page id — do not unwrap it (devtools-known-issues #11). **Set:** `TARGET_URL` (single-quoted, code-mode level).

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

## probe sentinel drift probe

Sentinel drift probe for workflow Step 9. One cheap `evaluate_script` returning `{found, count}` for a stored selector (`document.querySelectorAll` length) — run it before trusting recorded selectors; empty/wrong result → recorded fallbacks → re-derive. Returns `OK: sentinel found (n match(es))` / `WARN: sentinel not found — drift? use recorded fallbacks`. **Set:** `SEL` (the stored selector from `mem:browser-automation/<site>/...`, single-quoted, B2-style interpolation).

```javascript
// probe — sentinel drift probe (workflow Step 9): does the stored selector still match?
var SEL = 'REPLACE_WITH_STORED_SELECTOR';
var SQ = String.fromCharCode(39);
var js = [
  '() => {',
  '  var sel = ' + SQ + SEL + SQ + ';',
  '  var nodes = document.querySelectorAll(sel);',
  '  return { found: nodes.length > 0, count: nodes.length };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  if (!result.found) {
    return 'WARN: sentinel "' + SEL + '" not found — drift? use recorded fallbacks';
  }
  return 'OK: sentinel found (' + result.count + ' match(es))';
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## D2 list click and relist

Combined: list, click by text, re-list (paced). Runs ONE async `evaluate_script`: list interactive elements (`before`), optionally click one matching `TEXT` via its unique selector with full pacing, then re-list (`after`). Returns `{before, clicked, after}`; when `clicked.effect` is false the wrapper returns `WARNING: ... no state change detected` (treat as "not applied"). D2 exercises the full navigate → list → click → re-list pattern in one async call. **Set:** `TEXT` (`''` = list only, no click), `WAIT_FOR_SELECTOR`, and the pacing/poll constants at the top of the body (`PACE_ACTION_MS`/`PACE_TRANSITION_MS`/`POLL_DEADLINE_MS`/`POLL_SLEEP_MS`/`MAX_ACTIONS` — pacing defaults per the workflow's [Shared rules](../workflows/browser-automation-devtools.md#shared-rules-and-helpers)).

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

## paginate generic pagination loop

Generic pagination loop for workflow Step 6 SPA flows. One async `evaluate_script` that detects the site's control shape — Next/load-more/chevron button (text or `aria-label`), numbered `a[href]` links, or a `select` — and iterates clicks with full pacing (≥1 s actions, ≥250 ms transitions, bounded poll 4 s/120 ms, ≤40 actions) until no next control is found, collecting `ROW_SELECTOR` row texts each cycle. Controls that are `disabled`/`aria-disabled="true"` end the loop; so does a Next button removed from the DOM on the last page (the LinkedIn behavior recorded in `mem:browser-automation/linkedin/jobs-pagination-mechanism`). **Set:** `ROW_SELECTOR` (row selector from the site's extraction memory; `''` = iterate without collecting). Site-specific control selectors, when known, live in `mem:browser-automation/<site>/...` and override this generic detection — check the memory first.

```javascript
// paginate — generic pagination loop (workflow Step 6): detect the control, click through, collect rows.
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var Q = String.fromCharCode(34);',
  '  var ROW_SELECTOR = "";',
  '  var MAX_ACTIONS = 40;',
  '  var PACE_ACTION_MS = 1000;',
  '  var PACE_TRANSITION_MS = 250;',
  '  var POLL_DEADLINE_MS = 4000;',
  '  var POLL_SLEEP_MS = 120;',
  '  var actions = 0;',
  '  var seen = {};',
  '  var maxPage = 1;',
  '  var lastHref = location.href;',
  '  // One canonical dedupe key for the check AND the record — identical strings for text buttons, href links, and chevrons.',
  '  function nextKey(el) { var h = el.getAttribute("href") || ""; var tx = (el.textContent || "").toLowerCase().trim(); return h + "|" + tx; }',
  '  function action() { actions++; if (actions > MAX_ACTIONS) { throw new Error("action budget exceeded (" + MAX_ACTIONS + ") — STOP"); } }',
  '  function collectRows() {',
  '    if (!ROW_SELECTOR) { return []; }',
  '    return Array.from(document.querySelectorAll(ROW_SELECTOR)).map(function (el) { return H.trunc(H.textOf(el), 80); });',
  '  }',
  '  // Site-specific control selectors (mem:browser-automation/<site>/...) override this generic detection.',
  '  function nextControl() {',
  '    var els = Array.from(document.querySelectorAll("button, a[href], [role=" + Q + "button" + Q + "], select"));',
  '    for (var i = 0; i < els.length; i++) {',
  '      var el = els[i];',
  '      if (el.disabled || el.getAttribute("aria-disabled") === "true") { continue; }',
  '      if (!H.visible(el)) { continue; }',
  '      var t = H.textOf(el).toLowerCase();',
  '      var aria = (el.getAttribute("aria-label") || "").toLowerCase();',
  '      if (el.tagName === "SELECT" && el.selectedIndex >= 0 && el.selectedIndex < el.options.length - 1) {',
  '        el.selectedIndex = el.selectedIndex + 1;',
  '        el.dispatchEvent(new Event("change", {bubbles: true}));',
  '        return {el: el, kind: "select"};',
  '      }',
  '      if (/next|load more|show more|more|forward|chevron|»/.test(t + " " + aria)) {',
  '        if (!seen[nextKey(el)]) { return {el: el, kind: "button"}; }',
  '      }',
  '      if (el.tagName === "A" && /^\\d+$/.test(H.textOf(el).trim())) {',
  '        var n = parseInt(H.textOf(el).trim(), 10);',
  '        if (n > maxPage && !seen[nextKey(el)]) { return {el: el, kind: "link", page: n}; }',
  '      }',
  '    }',
  '    return null;',
  '  }',
  '  var rows = [];',
  '  var pages = 0;',
  '  while (true) {',
  '    rows = rows.concat(collectRows());',
  '    pages++;',
  '    var next = nextControl();',
  '    if (!next) { break; }',
  '    action();',
  '    if (next.kind !== "select") { next.el.click(); }',
  '    await H.sleep(PACE_ACTION_MS);',
  '    var beforeRows = collectRows().length;',
  '    var deadline = Date.now() + POLL_DEADLINE_MS;',
  '    while (Date.now() < deadline) {',
  '      await H.sleep(POLL_SLEEP_MS);',
  '      if (collectRows().length !== beforeRows || location.href !== lastHref) { break; }',
  '    }',
  '    lastHref = location.href;',
  '    await H.sleep(PACE_TRANSITION_MS);',
  '    if (next.kind === "link") { maxPage = next.page; }',
  '    seen[nextKey(next.el)] = true;',
  '  }',
  '  return { pages: pages, rows: rows.slice(0, 200) };',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  return 'OK: visited ' + result.pages + ' page(s), collected ' + result.rows.length + ' rows: ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## E linkedin hiring trends

LinkedIn company growth-chart extractor — run on the `/company/<alias>/home` route only; the Posts and About views render no chart (`mem:browser-automation/linkedin/company-page-growth-chart-route`). Scroll the inner MAIN scroll container FIRST to trigger the lazy render — `window.scrollTo` does nothing, the page scrolls inside `main` — then locate the chart. Extracts the ~13 monthly data points from `[aria-label]` nodes matching `/^[A-Z][a-z]+ [0-9]{4},/` and the rendered `Growth trends XX%` label. The rendered percentage carries no sign; the chart points are ground truth, so the trend's sign is computed from the first/last points and applied to the percentage (`mem:browser-automation/linkedin/growth-percentage-sign-ground-truth`; points extraction: `mem:browser-automation/linkedin/company-growth-chart-points-extraction`). Returns `{chartFound, dataPoints, growthTrend, rawText}` — `dataPoints` is the monthly `{date, value}` array; `growthTrend` is signed, `null` when no percentage renders.

```javascript
// E — LinkedIn company growth chart: scroll-first lazy render, monthly points, sign-corrected trend.
var js = [
  'async () => {',
  '  var H = window.__H;',
  '  var result = {chartFound: false, dataPoints: null, growthTrend: null, rawText: ""};',
  '  // Scroll the inner MAIN scroll container FIRST — the chart is lazy-rendered; window.scrollTo does nothing on LinkedIn.',
  '  var main = document.querySelector("main") || document.body;',
  '  main.scrollTop = main.scrollHeight;',
  '  await H.sleep(1500);',
  '  // Point nodes: [aria-label] starting "Month YYYY," (e.g., "March 2024, 12.5").',
  '  function findPoints() {',
  '    return Array.from(document.querySelectorAll("[aria-label]")).filter(function (el) {',
  '      return /^[A-Z][a-z]+ [0-9]{4},/.test(el.getAttribute("aria-label") || "");',
  '    });',
  '  }',
  '  var pts = findPoints();',
  '  var deadline = Date.now() + 4000;',
  '  while (!pts.length && Date.now() < deadline) {',
  '    await H.sleep(120);',
  '    pts = findPoints();',
  '  }',
  '  if (!pts.length) { return result; }',
  '  result.chartFound = true;',
  '  // Value format after the date prefix is not documented in the memory — take the first number group, strip thousands separators.',
  '  result.dataPoints = pts.map(function (el) {',
  '    var m = (el.getAttribute("aria-label") || "").match(/^([A-Z][a-z]+ [0-9]{4}),\\s*([\\d.,]+)/);',
  '    return m ? {date: m[1], value: parseFloat(m[2].replace(/,/g, ""))} : null;',
  '  }).filter(function (p) { return p !== null; });',
  '  result.rawText = H.trunc(H.textOf(pts[0].closest("section, div") || pts[0].parentElement) || "", 500);',
  '  // Rendered percentage has no sign — chart points are ground truth: declining points mean negative growth.',
  '  if (result.dataPoints.length >= 2) {',
  '    var first = result.dataPoints[0].value;',
  '    var last = result.dataPoints[result.dataPoints.length - 1].value;',
  '    var pctMatch = H.textOf(main).match(/Growth\\s+trends?\\s+([\\d.]+)%/i);',
  '    if (pctMatch) {',
  '      result.growthTrend = (last >= first ? 1 : -1) * parseFloat(pctMatch[1]);',
  '    }',
  '  }',
  '  return result;',
  '}'
].join(String.fromCharCode(10));
try {
  var result = unwrap(evaluate_script({function: js}));
  if (!result.chartFound) {
    return 'WARN: no growth chart found — run on the /company/<alias>/home route (Posts/About render none)';
  }
  var msg = 'OK: chart=' + result.chartFound + ' points=' + result.dataPoints.length;
  if (result.growthTrend !== null) { msg += ' growthTrend=' + result.growthTrend + '%'; }
  else { msg += ' (no percentage displayed)'; }
  return msg + ' | ' + JSON.stringify(result).slice(0, 3000);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## B filter clickables

Filter clickables by type + text, self-verified unique selector. Candidate set = A's plus `label`, `[role="option"]`, and `input[type="checkbox"]`/`input[type="radio"]` via `H.CANDIDATES` (Set-deduped — an element matching several selectors counts once). Checkbox/radio inputs skip the visibility check (typically zero-size/visually hidden); their display text comes from the associated label, falling back to `value` for submit/button inputs, else the type name. Every hit carries `uniqueSelector` and `verified: true` (held at discovery time: `document.querySelector(uniqueSelector) === el`). `TYPE` accepts comma-separated values (`any`, `button`, `a`, `button,a`, `label`, `[role="option"]`, ...); `TEXT` is a case-insensitive substring match on display text. **Set:** `TYPE`, `TEXT`, `LIMIT`, `MAX_TEXT`, `WAIT_FOR_SELECTOR`.

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