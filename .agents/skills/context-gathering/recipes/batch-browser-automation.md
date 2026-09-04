# Batch Browser Automation Recipes

All recipes use the **devtools** MCP server via a code-mode environment (`code-mode-<site>-<task>`).

**Prerequisite:** Complete the [browser-automation-devtools workflow](../workflows/browser-automation-devtools.md) — it covers auth verification, navigation, extraction, caching, and anti-bot protocol. This recipe extends that workflow for batch operations.

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `devtools` — host Chrome navigation, extraction, and scripted flows |
| **When to use** | Batch research tasks targeting 5+ entities (e.g., visiting 20 LinkedIn company pages, scraping 15 GitHub repositories) |
| **Combines with** | [browser-automation-devtools](../workflows/browser-automation-devtools.md) — handles per-page extraction, caching, and selector drift recovery |

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Follow [browser-automation-devtools](../workflows/browser-automation-devtools.md) — auth, navigation, extraction patterns
4. Activate code-mode: `gateway_code-mode({"name": "code-mode-<site>-<task>", "servers": ["devtools", "serena"]})`

## Before you start

- **Confirm the site first.** If the operator did not name the target site, clarify before starting — never guess.
- **Confirm N.** "~N" or an unknown entity count → confirm the exact count with the operator first (the workflow's clarification trigger).
- **Read the site's extraction memory** `mem:browser-automation/<site>/<task>-extraction` (workflow Step 1); plan to create it after smoke-testing if absent.

## Search-first, not URL-first

Build the batch URL list from site search, not hand-collected URLs: direct URLs fail without notice (rebranding, restructuring, slug updates), and an entity's canonical page may live at a decentralized location (regional subdomains, separate sites). **How:** navigate to the site's search page (or its search URL), run [discover](../references/snippets.md#discover-targeted-structure-discovery) or snippet [A](../references/snippets.md#a-list-clickables) on the results to collect result links, and apply the site's search-result-title-verification rule — LinkedIn's `mem:browser-automation/linkedin/search-result-title-verification` is the worked example. Navigation tolerance (address-bar vs. in-page clicks) is per-site — record it in the site's extraction memory (workflow Step 3).

## Batch loop — per-source split with verify checkpoint

Per-source verify: each NAVIGATE and EXTRACTION is its own exec; never combine. After each batch of ≤2 entities, write checkpoint then `verifyAfterWrite([checkpointName], 100)` + `snapshot()` and emit `COUNT N fetched → N cached → N verified`. Respect 2× retry cap per tool/target and ≤2 KB budget per return.

```text
per entity:
  NAVIGATE exec call:    new_page({url}) alone — {ok:true} | {ok:false, error}   (#22: evaluate in the NEXT call) → snapshot()
  if ok:
    EXTRACTION exec call: unwrap + X install + extractor — {title, data, url} → snapshot()
    verify url matches the entity; a mismatch is a failure — never read an unverified page
    on failure: fallback rung 1 (same-page re-extract) → ... → mark incomplete (2× retry cap)
  append result
at each batch boundary (≤2 entities, ≤5 exec calls per batch):
  write checkpoint mem:private/<site>-research/batch-<N>-<YYYY-MM-DD> → verifyAfterWrite([name], 100) → COUNT line → snapshot() ≤2 KB read-back
at end:
  consolidate checkpoints into mem:private/<site>/<task>-<YYYY-MM-DD> → verifyAfterWrite → archive/delete checkpoints
```

## Scripts

### 1. Per-entity NAVIGATE exec call

One `gateway_mcp_exec` call per entity for navigation — the EXTRACTION call is a second, separate call. `new_page` alone — no evaluate in this call; a heavy evaluate in the same call times out ([devtools-known-issues](../references/devtools-known-issues.md) #22). `new_page` returns a plain pages table, not JSON — do not unwrap it (#11). `{ok: true}` only means navigation completed; page identity is verified in the EXTRACTION call.

```javascript
// NAVIGATE — one gateway_mcp_exec call per entity. new_page ALONE, no evaluate (#22).
var ENTITY_URL = 'https://example.com/page1';
try {
  var page = new_page({ url: ENTITY_URL });
  if (/error/i.test(String(page))) {
    return JSON.stringify({ ok: false, url: ENTITY_URL, error: String(page).slice(0, 300) });
  }
  return JSON.stringify({ ok: true, url: ENTITY_URL });
} catch (e) {
  return JSON.stringify({ ok: false, url: ENTITY_URL, error: String(e.message).slice(0, 300) });
}
```

### 2. Per-entity EXTRACTION exec call

Dispatched only after navigate returned `ok: true`. Self-contained — code-mode state does not persist between exec calls, so `unwrap` and snippet X's helper install are pasted INLINE here (anchors below). X must be re-installed after every navigation — `new_page` destroys the JS realm; without it the extractor fails with `H is undefined`. The extractor runs via `evaluate_script` — an async body is allowed (the per-task ≤40-action budget spans the whole task, not this one body — [truncation-examples §E](../references/truncation-examples.md)) — and returns `{title, data, url}` so the agent verifies page identity BEFORE reading data. Never read data from an unverified page.

```javascript
// EXTRACTION — one gateway_mcp_exec call per entity; only after navigate returned ok:true.
var ENTITY_URL = 'https://example.com/page1';
// unwrap — paste from snippets.md#unwrap; parse EVERY evaluate_script return through it.
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
// X — install the page helpers. Paste the FULL canonical helper array verbatim from
// snippets.md#x-install-helpers-once-per-page-load (pre-verified through the quoting
// layer — do not re-escape). Required after every new_page/navigate_page.
var xJs = [
  '() => {',
  '  /* PASTE the X body from snippets.md#x-install-helpers-once-per-page-load */',
  '  return "helpers installed";',
  '}'
].join(String.fromCharCode(10));
// Extractor — paste from the site extraction memory (mem:browser-automation/<site>/<task>-extraction);
// snippet E (snippets.md#e-linkedin-hiring-trends) is the LinkedIn chart extractor.
var EXTRACT_JS = [
  'async () => {',
  '  var H = window.__H;',
  '  await H.sleep(1000); // >=1 s pacing between entities — sleeps live inside the async body',
  '  var data = {}; /* REPLACE: extraction-memory fields */',
  '  return { title: document.title, data: data, url: location.href };',
  '}'
].join(String.fromCharCode(10));
try {
  unwrap(evaluate_script({ function: xJs })); // install X (light)
  var probe = unwrap(evaluate_script({ function: EXTRACT_JS })); // extract
  return JSON.stringify({ title: probe.title, data: probe.data, url: probe.url }).slice(0, 3000);
} catch (e) {
  return JSON.stringify({ status: 'error', url: ENTITY_URL, error: String(e.message).slice(0, 300) });
}
```

### 3. Fallback extraction (same-page rung-1 retry)

A failed entity is retried by re-running the EXTRACTION call — same script, same inlining discipline — with the broader scan below pasted as `EXTRACT_JS`. It runs ONLY on the page ALREADY verified as the entity's page (`{url}` matched). It never navigates; after a `new_page` failure the currently selected page is the PREVIOUS entity's page, so the fallback must NOT run then — extracting it under the failed entity's name would silently corrupt data. Escalate navigation-level failures to ladder rung 2 instead.

```javascript
// FALLBACK — same-page rung-1 retry: paste this as EXTRACT_JS in the EXTRACTION call
// (unwrap + X install stay inline). Only on a page already verified as the entity's page.
var fbJs = [
  '() => {',
  '  var H = window.__H;',
  '  var headings = Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, 10).map(function (h) {',
  '    return h.innerText.trim().slice(0, 100);',
  '  });',
  '  var links = Array.from(document.querySelectorAll("a[href]")).slice(0, 20).map(function (a) {',
  '    return { text: (a.innerText || "").trim().slice(0, 60), href: (a.href || "").slice(0, 120) };',
  '  }).filter(function (l) { return l.text; });',
  '  return { title: document.title, url: location.href, headings: headings, links: links, bodyText: (document.body.innerText || "").slice(0, 1500) };',
  '}'
].join(String.fromCharCode(10));
```

## Smoke-test the extractor first (BLOCKING GATE)

The batch reuses ONE extraction script across every entity. Validate it on the FIRST entity before the loop:

1. Run the NAVIGATE call for the first entity (or the most structure-rich page in the batch), then the EXTRACTION call.
2. Confirm the extractor returns the expected non-empty fields AND the identity check (`url`) matches the entity.
3. Iterate the script until accurate — this also proves the X install works; only then run the batch loop.

An extractor that silently returns `{}` on entity 8 forces a re-visit of every earlier entity. Never deploy an unvalidated script across a batch.

## Fallback ladder

Escalate per-entity extraction failures through the ladder — stop at the first rung that returns data, at most one attempt per rung:

1. **Same-page re-extraction.** Re-run the extractor with alternative selectors on the page ALREADY verified as the entity's page (fallback block above; workflow Step 9 drift recovery). Never reads a different page under this entity's name.
2. **Navigation failure: one paced re-navigation; extraction failure on a loaded page: scroll-trigger.** A failed `new_page` is retried with exactly ONE `navigate_page` to the same entity URL — record the site's address-bar tolerance per workflow Step 3 (the workflow's once-only `new_page` rule guards the auth-probe/D1 open, not batch per-entity navigation). On a page already loaded, charts lazy-render on scroll: scroll the section into view, wait, re-read (workflow Example E). One attempt only.
3. **Sourced data.** For a publicly-reported metric, use cached results or web search ONLY if the task's data-source rules allow it; label the value with its provenance.
4. **Mark incomplete.** Record `{entity, url, status: 'incomplete', reason}` and continue.

Each attempt must differ from the last. Never retry the same failing script — `require is not defined` / `Invalid or unexpected token` mean rewrite Node-style page scripts as plain DOM JS (devtools-known-issues #23), not re-run them.

**Server-down rung (no data-returning attempt).** Repeated navigation failures across ≥2 entities with the same documented error shape on real `new_page` calls → run the workflow's source-of-truth-down protocol ([browser-automation-devtools.md](../workflows/browser-automation-devtools.md) — "Source of truth down — ESCALATE, don't workaround"): verify with ≥2 real timeouts, then STOP and escalate; never substitute fetch/tavily for live-page evidence.

## Best practices

- **Budget.** 2 `gateway_mcp_exec` calls per entity (NAVIGATE + EXTRACTION); ≤5 DEVTOOLS calls per batch (the checkpoint write + read-back are serena calls and do not count against the devtools cap) → ≤2 entities per batch; 20 entities = 10 batches of 2 = 40 exec calls + 2 smoke-test calls (NAVIGATE + EXTRACTION on entity 1) = 42 total; checkpoint written at each batch boundary; the per-task ≤40-action budget ([truncation-examples §E](../references/truncation-examples.md)) spans the whole task including all `evaluate_script` bodies — a batch run that would exceed it → confirm scope with the operator first (workflow clarification trigger) or split into separate tasks; ≥1 s pacing between entities.
- **Two-artifact cache scheme.** Task result cache — ONE dated memory per task `mem:private/<site>/<task>-<YYYY-MM-DD>`; partials written as work proceeds; UPDATE the same memory, never a second one. This is the FINAL result. Batch checkpoints — INTERMEDIATE progress memories `mem:private/<site>-research/batch-<N>-<YYYY-MM-DD>`, one per batch; at task end consolidate them into the task result cache, then archive/delete the checkpoints (per `mem:browser-automation/general/batch-checkpoint-template` rule 3).
- **Store names may drift** — always `list_memories({topic: 'private/<site>'})` and pattern-match, never assume exact names.
- **Checkpoint read-back.** After each checkpoint write, run `verifyAfterWrite([checkpointName], 100)` — read back 1–2 entries, confirm `COUNT N fetched → N cached → N verified`, `snapshot()` ≤2 KB excerpts — before starting the next batch (verify every write). See [truncation-examples.md §B](../references/truncation-examples.md).
- **Smoke-test the extractor before the batch.** One run on the first entity; iterate until non-empty before the loop (BLOCKING GATE above).
- **Verify auth before the batch.** Run the auth check (browser-automation-devtools Step 2) once before the batch, not per entity.
- **Pace between entities.** ≥1 s between entities — the sleep lives INSIDE the async `evaluate_script` body (devtools-known-issues #2); top-level code-mode scripts must stay synchronous (scripting-workflow).

## Common pitfalls

- **Navigating AND extracting in one exec call.** `new_page` + a heavy `evaluate_script` in the same call times out (devtools-known-issues #22). Split: NAVIGATE call, then EXTRACTION call.
- **Reading an unverified page.** After a `new_page` failure the current page is the PREVIOUS entity's page — extracting it under the failed entity's name silently corrupts data. Verify `{url}` first; fallback is same-page-only.
- **Skipping the X install after navigation.** `new_page` destroys the JS realm — the EXTRACTION call must re-install the page helpers or the extractor fails with `H is undefined`.
- **Not caching intermediate results.** A failure on entity 15 should not lose results from entities 1–14. Checkpoint after each batch, then read back.
- **Deploying an unvalidated extractor.** A silent `{}` on entity 8 means re-visits — smoke-test on the first entity first (BLOCKING GATE).
- **Retrying the same failing script.** `require is not defined` / `Invalid or unexpected token` mean Node.js-isms in a browser script — rewrite as plain DOM JS (devtools-known-issues #23), don't re-run.
- **Skipping auth verification.** The batch assumes an authenticated session. Verify once before starting, not after a failure.
- **Reusing operator tabs.** Always open new tabs with `new_page`. Never navigate the operator's existing tabs.
- **Ignoring anti-bot signals.** A CAPTCHA or "verify you are human" on entity 5 means stop the entire batch. Report partial results and escalate.

## Acceptance criteria

- [ ] Target site confirmed and N exact before starting; batch URL list built search-first.
- [ ] NAVIGATE and EXTRACTION are separate `gateway_mcp_exec` calls per entity (devtools-known-issues #22).
- [ ] EXTRACTION call verifies page identity (`{title, data, url}`) before reading data; unverified pages never extracted.
- [ ] Snippet X installed inside the EXTRACTION call after every navigation (no `H is undefined`).
- [ ] Auth verified before the first batch via `list_pages` or `new_page` probe.
- [ ] Extractor smoke-tested on the first entity before the batch loop; empty returns iterated to non-empty (BLOCKING GATE).
- [ ] Batch checkpoints written to `mem:private/<site>-research/batch-<N>-<YYYY-MM-DD>` at each batch boundary (≤2 entities, ≤5 exec calls per batch) AND `verifyAfterWrite([name], 100)` read-back with `COUNT N fetched → N cached → N verified` + `snapshot()` ≤2 KB.
- [ ] At task end, checkpoints consolidated into the task cache `mem:private/<site>/<task>-<YYYY-MM-DD>` (updated in place, never a second one), then archived/deleted.
- [ ] Fallback extraction is same-page-only; no data read from the previously selected page under a failed entity's name.
- [ ] ≥1 s pacing between entities (sleep inside the async `evaluate_script` body).
- [ ] All errors collected per entity as `{entity, url, error}`; no identical retries.
- [ ] Anti-bot STOP executed if any entity triggers a bot-alert signal — partials cached, batch halted.
