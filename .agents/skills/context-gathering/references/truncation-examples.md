# Reference: Truncation & Budget Enforcement — Worked JavaScript Examples

Copy-pasteable JS for the skill's numeric context-budget rules: the ≤2 KB snapshot cap, ≤700-char verification read-back, ≤3 KB aggregate cap, 2× retry cap, and browser pacing/action budget. Every example implements an existing prose rule, cited inline. Scripts assume the `gateway_mcp-exec` code-mode environment: sync-only top level, tools exposed as functions (`read_memory`, `list_memories`, `write_memory`, `delete_memory`), no persistence between calls — every helper keeps its own state inside one script.

**When to load:** whenever a script returns tool output, reads back a memory/file for verification, aggregates rows, retries a tool, or paces browser actions — any time the ≤2 KB / ≤700-char / ≤3 KB / 2× / ≤40-action rules apply. Wired from: [caching-rules.md](./caching-rules.md) context budget, [browser-automation-devtools.md](../workflows/browser-automation-devtools.md), [devtools-known-issues.md](./devtools-known-issues.md), [github-insights.md](../recipes/github-insights.md), [filesystem-access.md](../recipes/filesystem-access.md), [research-with-caching.md](../recipes/research-with-caching.md). Disclosure budgets: see [serena-memory/references/frontmatter.md § Search Method](../../serena-memory/references/frontmatter.md).

## Contents

- [A. Truncating any tool return to ≤2 KB](#a-truncating-any-tool-return-to-2-kb)
- [B. Verification read-back (≤700-char excerpt)](#b-verification-read-back-700-char-excerpt)
- [C. Aggregate ≤3 KB enforcement](#c-aggregate-3-kb-enforcement)
- [D. Retry-cap counter (2× rule)](#d-retry-cap-counter-2-rule)
- [E. Pacing & action budget (browser)](#e-pacing--action-budget-browser)

## A. Truncating any tool return to ≤2 KB

**Implements:** [caching-rules.md](./caching-rules.md) §2 — *"every snapshot (fetch output, memory read-back, file read, search results, enumeration output) returned to the model must be truncated in-script to ≤2 KB"* — and browser-automation Step 4 — *"truncate it aggressively (first ~2 KB, or filter to text-only)"*.

`snapshot()` caps ANY tool return at 2 KB (2048 chars) before it reaches the model. Pass an optional keyword to get a keyword-centered window (technique 3); otherwise it falls back to a head+tail window (techniques 1+2):

```javascript
var KB = 1024;
// snapshot(): cap any tool return at ≤2 KB in-script.
// opts.keyword -> keyword-centered window; otherwise head+tail.
function snapshot(s, opts) {
  opts = opts || {};
  var MAX = 2 * KB;
  if (typeof s !== 'string' || s.length <= MAX) { return s; }
  if (opts.keyword && s.indexOf(opts.keyword) >= 0) { return keywordWindow(s, opts.keyword, MAX); }
  var head = Math.floor(MAX * 0.6);
  return s.slice(0, head) + '\n[...truncated ' + (s.length - MAX) + ' chars...]\n' + s.slice(s.length - (MAX - head));
}
// ponytail minimal — 2KB cap without keyword window (use when window not needed):
// function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
// empty guard — after every gateway_mcp-exec raw return (captures stderr):
// if (!raw || raw.trim()==="" || /Access denied|No such file/.test(raw)) throw new Error("empty gateway return → retry");
```

Minimal 2KB cap + empty guard — gateway template (copy-pasteable):

```javascript
function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
var raw = someTool({ query: "x" });
if (!raw || raw.trim()==="" || /Access denied|No such file/.test(raw)) throw new Error("empty gateway return → retry");
return snapshot(raw);
```

**(1) Head snippet — first N chars** (smallest; enough for structure discovery):

```javascript
var toolReturn = '...';                    // e.g., a take_snapshot a11y dump
var head = toolReturn.slice(0, 2 * KB);    // first 2048 chars only
return 'head ' + head.length + ' chars: ' + head;
```

**(2) Middle/tail window — last N chars, or a window around an offset** (tail for error strings whose cause is at the end; offset window for a known interesting region):

```javascript
var tail = toolReturn.slice(toolReturn.length - 2 * KB);             // last 2048 chars
var around = toolReturn.slice(Math.max(0, offset - 512), offset + 1536); // 2048-char window around an offset
```

**(3) Keyword-centered window — first N chars before/after the first occurrence** (the "snippets around certain keywords up to some extent" technique; use for search results and large fetches where the interesting text sits mid-string):

```javascript
// keywordWindow(): first N chars before and after the first occurrence of kw.
function keywordWindow(s, kw, max) {
  var i = s.indexOf(kw);
  if (i < 0) { return s.slice(0, max); }              // keyword absent -> head snippet
  var half = Math.floor(max / 2);
  var start = Math.max(0, i - half);
  var win = s.slice(start, i + kw.length + half);
  return (start > 0 ? '...' : '') + win + (i + kw.length + half < s.length ? '...' : '');
}
```

**Combine: keyword-centered when a keyword is given, else head+tail** — that is exactly what `snapshot()` does. Runnable demo with a fake `toolReturn`:

```javascript
var toolReturn = 'ERROR: rate limited. ' + new Array(5000).join('x') + ' end of response.';
var out = snapshot(toolReturn, { keyword: 'rate limited' });
return 'returned ' + out.length + ' chars (cap 2048):' + String.fromCharCode(10) + out;
```

## B. Verification read-back (≤700-char excerpt)

**Implements:** [caching-rules.md](./caching-rules.md) §3/§8 — *"After each cache-write batch, read back 1–2 entries via `read_memory` ... Report counts as 'N fetched → N cached → N verified'. Any entry failing verification = FAIL: delete it and redo"* — and the read-back cap — *"memory read-backs for verification return only header + length + ≤700-char excerpt"* (never the full content, even split across reads).

`verifyAfterWrite()` reads back up to 2 entries after a write batch, returns header + stored length + ≤700-char excerpt, reports the count chain, and deletes + flags for redo on a length mismatch:

```javascript
var NL = String.fromCharCode(10);
// verifyAfterWrite(): read back 1–2 entries; report "N fetched -> N cached -> N verified".
// Returns ONLY header + length + <=700-char excerpt; full content stays in the store.
function verifyAfterWrite(writtenNames, minChars) {
  var report = [];
  var verified = 0;
  var n = Math.min(writtenNames.length, 2);            // read back 1–2 entries only
  for (var i = 0; i < n; i++) {
    var name = writtenNames[i];
    var raw;
    try { raw = read_memory({ memory_name: name }); }
    catch (e) { report.push('FAIL ' + name + ': ' + e.message); continue; }
    if (typeof raw === 'string' && raw.indexOf('not found') >= 0) {
      report.push('FAIL ' + name + ': read-back missing — delete & redo');
      continue;
    }
    var content;
    try { content = JSON.parse(raw).content || raw; } catch (e) { content = raw; }
    if (content.length < minChars) {                   // mismatch -> delete and redo
      try {
        var d = delete_memory({ memory_name: name });
        report.push('FAIL ' + name + ': length ' + content.length + ' < ' + minChars + ' — deleted (' + d + '), redo');
      } catch (e) { report.push('FAIL ' + name + ': delete failed — ' + e.message); }
      continue;
    }
    verified++;
    report.push('OK   ' + name + ' chars=' + content.length);            // stored length
    report.push('     header: ' + content.slice(0, 200).split(NL)[0]);   // header line only
    report.push('     excerpt: ' + content.slice(0, 700));               // <=700 chars — never full
  }
  report.unshift('COUNT ' + writtenNames.length + ' fetched -> ' + writtenNames.length + ' cached -> ' + verified + ' verified');
  return report.join(NL);
}
```

(Transcript-specific length expectations are NOT generic — see the YouTube example section in [external-content-caching.md](../recipes/external-content-caching.md).)

**DeepWiki not-indexed status:** when pre-validate (`list_memories` / `search_code`) shows repo not indexed, return `DEEPWIKI-REPO-NOT-INDEXED repo:owner/repo` as a FAIL line and escalate `tavily_search` → `fetch` (cross-check `github search_issues`). Example: `FAIL deepwiki owner/repo: DEEPWIKI-REPO-NOT-INDEXED — fallback tavily_search -> fetch`.

## C. Aggregate ≤3 KB enforcement

**Implements:** [caching-rules.md](./caching-rules.md) §2 — *"aggregated scalar fields totaling ≤3KB"* — browser-automation Step 5 — *"Every result is HARD-CAPPED at 3 KB: trim and aggregate inside the script (`map` to objects, `join` arrays)"* — and external-content-caching — *"keep the TOTAL aggregated output ≤3KB"*.

Loop that accumulates per-item rows (each ≤120 chars) and stops/truncates before the total would exceed 3 KB, reporting how many rows were dropped:

```javascript
var KB = 1024;
// aggregateRows(): accumulate per-item rows (each <=120 chars) into <=3 KB total.
// Stops BEFORE the first row that would exceed the cap and counts what was dropped.
function aggregateRows(items, fmt) {
  var MAX_TOTAL = 3 * KB;
  var lines = [];
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    var row = String(fmt(items[i])).slice(0, 120);        // per-row cap
    if (total + row.length + 1 > MAX_TOTAL) {             // +1 for the newline
      lines.push('...stopped: ' + (items.length - i) + ' more rows would exceed 3 KB');
      break;
    }
    lines.push(row);
    total += row.length + 1;
  }
  return lines.join(String.fromCharCode(10));
}

// Runnable demo: aggregate 200 get_video_info-style rows into <=3 KB.
var items = [];
for (var i = 0; i < 200; i++) { items.push({ title: 'talk ' + i, id: 'id' + i, duration: '58:12' }); }
var out = aggregateRows(items, function (it) {
  return it.id + ' | ' + it.title + ' | ' + it.duration + ' | ' + new Array(100).join('d');
});
return 'aggregated ' + out.length + ' chars (cap 3 KB), ' + out.split(String.fromCharCode(10)).length + ' rows';
```

## D. Retry-cap counter (2× rule)

**Implements:** browser-automation Principles and Steps 2/11 — *"No aggressive retries"* and *"Retries are bounded and in-script only"* — the 2× cap: never call the same tool on the same target more than 2× total in one script.

```javascript
var calls = {};   // per-script only — state does NOT persist between mcp-exec calls
// withRetryCap(fn, target, maxTries): call fn on target at most maxTries (default 2) times.
function withRetryCap(fn, target, maxTries) {
  maxTries = maxTries || 2;
  calls[target] = (calls[target] || 0) + 1;
  if (calls[target] > maxTries) {
    return { ok: false, error: 'retry cap hit: ' + target + ' tried ' + maxTries + 'x — stop, report, escalate' };
  }
  try { return { ok: true, value: fn() }; }
  catch (e) { return { ok: false, error: e.message }; }
}

// Runnable demo: flaky tool bounded to 2 total attempts; the loop NEVER reaches a 3rd.
var fakeFail = 0;
var result;
for (var attempt = 0; attempt < 2; attempt++) {          // bounded loop: 2 max
  result = withRetryCap(function () {
    fakeFail++;
    if (fakeFail < 3) { throw new Error('transient failure ' + fakeFail); }
    return 'fetched ok';
  }, 'fetch://example.com/doc', 2);
  if (result.ok) { break; }
}
return result.ok ? 'OK: ' + result.value : 'FAIL: ' + result.error;
```

## E. Pacing & action budget (browser)

**Implements:** browser-automation Step 6 and Principle — *"≥1 s between distinct human-like actions (clicks, navigations)"*, *"≥250 ms between in-page transitions"*, *"Respect a per-task action budget — default ≤40 actions"*, and *"bounded polling deadlines, no burst loops"*.

Code-mode top level is sync-only; the pacing sleeps live INSIDE the async `evaluate_script` body (devtools-known-issues #2: the tool awaits async functions). The action counter works at either layer:

```javascript
// sleep(): use inside an async evaluate_script body (the devtools tool awaits it).
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

// Action budget: <=40 actions per task — count every click/navigation/input.
var actions = 0;
var MAX_ACTIONS = 40;
function action() {
  if (actions >= MAX_ACTIONS) {
    throw new Error('action budget exceeded (' + MAX_ACTIONS + ') — STOP, checkpoint partials, report');
  }
  actions++;
}
```

**Paced click-wait-read loop inside one `evaluate_script` (≥1 s between actions, ≥250 ms before transitions, bounded poll):**

```javascript
// Inside evaluate_script — the async body is awaited by the tool; sync-only at top level.
var js = [
  'async () => {',
  '  var actions = 0, MAX = 40;',
  '  function action() { if (++actions > MAX) { throw new Error("action budget exceeded"); } }',
  '  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }',
  '  var out = [];',
  '  for (var i = 0; i < items.length; i++) {',
  '    action();',                        // counts toward the <=40 budget
  '    clickItem(i);',
  '    await sleep(1000);',               // >=1 s between distinct human-like actions
  '    await sleep(250);',                // >=250 ms before the in-page transition
  '    var href = await waitForHrefChange(4000, 120);',  // bounded poll: deadline 4 s, sleep 120 ms
  '    out.push(href);',
  '  }',
  '  return out;',
  '}'
].join(String.fromCharCode(10));
```
