# Recipe: Research with Caching

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `deepwiki` (ask_question docs answers), `github` (search_issues / issue_read known issues), `fetch` (doc pages), `serena` (memory store) |
| **When to use** | ANY research topic — cache-first is the default: answer questions from docs, check known GitHub issues, fetch doc pages — without re-fetching or flooding the model context |
| **Combines with** | [external-content-caching](./external-content-caching.md) (bulk/harvest variant), [store-memories](./store-memories.md), [collect-relevant-memories](./collect-relevant-memories.md), [github-insights](./github-insights.md) |

## Why cache-first

One `gateway_mcp-exec` loop per source batch: check `cache/{source}/...` → fetch only on MISS → write the FULL raw response to serena → synthesize a `researches/{topic}` memory with `mem:` refs → return ONLY a per-op status report. Caching is part of EVERY research by default: deterministic keys mean repeat queries hit; cached responses are revisitable via `list_memories` + `read_memory`; the model only ever sees status lines. Live-run proof: ONE cache-first research task cached 17 responses across deepwiki/github/fetch and produced `researches/connecting-chrome-dev-tools-from-devcontainer` with 17 `mem:` references, in a few `mcp-exec` batches, with zero raw dumps in context.

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `code_mode({"name": "code-mode-research-cache", "servers": ["deepwiki", "github", "fetch", "serena"]})` — the tool is exposed to mcp-exec under the returned prefixed name
4. API facts: [content-fetch-api](../references/content-fetch-api.md); serena formats: [serena-memory-api](../references/serena-memory-api.md); cache convention: `mem:cache/about`

## Cache-key formation

Every tool response maps to ONE deterministic cache key, so the same tool+query always resolves to the same memory and the cache-check hits:

`cache/{source}/{scope}/{descriptor}`

| Source | Key pattern | Example |
|---|---|---|
| deepwiki | `cache/deepwiki/{topic-slug}/{question-slug}` | `cache/deepwiki/chrome-devtools-protocol/launch-flags-remote-debugging` |
| github (known issue) | `cache/github/{owner}-{repo}/issue-{id}` | `cache/github/karakeep-app-karakeep/issue-2576` |
| github (search) | `cache/github/{owner}-{repo}/search-{query-slug}`; cross-repo: `cache/github/general/search-{query-slug}` | `cache/github/general/search-host-docker-internal-connection-refused` |
| fetch | `cache/fetch/{hostname-slug}/{path-slug}` (+ short hash suffix when slug empty/ambiguous) | `cache/fetch/developer.chrome.com/docs-devtools-remote-debugging-local-server` |
| youtube-videos | `cache/youtube-videos/{channel}/{slug}_{id}` (existing) | `cache/youtube-videos/ai-engineer/wf2026-autoresearch-keynotes-...` |

Slug rules: lowercase; alphanumeric + hyphens only; collapse repeated separators; trim leading/trailing dashes; cap ~60 chars. Cache entries carry a short header (tool, query/URL, fetched date, source line) + the FULL raw response; returns are status-report-only; entries are regenerable (right-size waiver in `cache/about`).

## Scripts

All scripts are sync-only, single-quoted strings, array-join for multi-line content, per-op try/catch, and success confirmed by substring checks — never by `JSON.parse` on plain-text tools.

### Cache lookup helper

`list_memories({topic: 'cache/<source>/<scope>'}) then read the exact key — HIT reuses the stored response (do NOT fetch), MISS proceeds to fetch.`

```javascript
// Cache lookup: HIT reuses the stored response, MISS proceeds to fetch.
// Tool call pattern: list_memories({ topic: 'cache/deepwiki/<topic-slug>' })
// Response format: JSON STRING — {"memories": ["cache/deepwiki/<topic-slug>/<question-slug>", ...]};
// topic filtering is prefix-based and case-sensitive
// Tool call pattern: read_memory({ memory_name: '<exact cache key>' })
// Response format: plain Markdown or JSON-wrapped content, or an error string containing 'not found'
var NL = String.fromCharCode(10);
function readMemory(name) {
  try {
    var raw = read_memory({ memory_name: name });
    if (typeof raw === 'string' && raw.indexOf('not found') >= 0) { return null; } // MISS
    try { var p = JSON.parse(raw); return p.content || raw; } catch (e) { return raw; }
  } catch (e) { return null; }
}
function cacheHit(scope, key) {
  try {
    var listed = JSON.parse(list_memories({ topic: scope }));
    for (var i = 0; i < listed.memories.length; i++) {
      if (listed.memories[i] === key) { return readMemory(key); }
    }
  } catch (e) { /* treat list failure as MISS, not a crash */ }
  return null;
}
var hit = cacheHit('cache/deepwiki/<topic-slug>', 'cache/deepwiki/<topic-slug>/<question-slug>');
return hit ? 'HIT  chars=' + hit.length : 'MISS cache/deepwiki/<topic-slug>/<question-slug>';
```

### Fetch & cache: deepwiki ask_question

`call ask_question({repoName, question}); the response is PLAIN TEXT markdown — never JSON.parse; write cache/deepwiki/{topic-slug}/{question-slug} with a header + the full answer; confirm via indexOf('written').`

```javascript
// Deepwiki answers are plain-text markdown — treat as content, never JSON.parse.
// Tool call pattern: ask_question({ repoName: '<owner/repo>', question: '<question>' })
// Response format: PLAIN-TEXT markdown string (NOT JSON — JSON.parse throws on it)
// Tool call pattern: write_memory({ memory_name: '<key>', content: '<header + answer>', max_chars: <large> })
// Response format: plain text 'Memory <key> written.' — check indexOf('written')
var NL = String.fromCharCode(10);
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
try {
  var answer = ask_question({ repoName: '<owner/repo>', question: '<question>' });
  if (typeof answer !== 'string' || answer.length === 0) { return 'FAIL deepwiki: empty answer'; }
  var key = 'cache/deepwiki/<topic-slug>/' + slugify('<question>');
  var body = [
    'tool: deepwiki ask_question',
    'repo: <owner/repo>',
    'question: <question>',
    'date: <YYYY-MM-DD>',
    'source: deepwiki',
    '',
    answer, // FULL raw answer — the point of the cache entry
  ].join(NL);
  var r = write_memory({ memory_name: key, content: body, max_chars: 500000 });
  if (r.indexOf('written') < 0) { return 'FAIL ' + key + ': ' + r; }
  return 'OK   ' + key + ' chars=' + answer.length;
} catch (e) { return 'FAIL deepwiki: ' + e.message; }
```

### Fetch & cache: github known issues

`search_issues with fields trim; JSON.parse; check error/incomplete_results; cache the search result set; if a concrete known issue matters, issue_read and cache issue-{id}; categorize findings (by-design/open-bug/feature-request + numbers/URLs).`

```javascript
// GitHub issue search returns JSON — parse and validate before use; payloads trimmed via fields.
// Tool call pattern: search_issues({ query: '<query>', fields: ['number', 'title', 'state', 'html_url'], perPage: 10 })
// Response format: JSON STRING — { incomplete_results, items: [{ number, state, title, html_url, ... }] };
// an "error" key (rate limit) or incomplete_results:true must be checked before reading .items
// Tool call pattern: issue_read({ owner: '<owner>', repo: '<repo>', issue_number: <n> })
// Response format: JSON STRING with the issue detail (body, state, comments)
var NL = String.fromCharCode(10);
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
try {
  var raw = search_issues({ query: '<query>', fields: ['number', 'title', 'state', 'html_url'], perPage: 10 });
  var parsed = JSON.parse(raw); // search_issues returns JSON — parse it
  if (parsed.error) { return 'FAIL search: ' + (parsed.error.message || parsed.error); } // rate limit / error object
  if (parsed.incomplete_results) { /* note truncated results in the status report */ }
  var key = 'cache/github/general/search-' + slugify('<query>');
  var body = ['tool: github search_issues', 'query: <query>', 'date: <YYYY-MM-DD>', 'source: github', '', raw].join(NL);
  var r = write_memory({ memory_name: key, content: body, max_chars: 500000 });
  if (r.indexOf('written') < 0) { return 'FAIL ' + key + ': ' + r; }
  var report = ['OK   ' + key + ' items=' + (parsed.items || []).length];
  for (var i = 0; i < (parsed.items || []).length; i++) {
    report.push('     #' + parsed.items[i].number + ' [' + parsed.items[i].state + '] ' +
      parsed.items[i].title + ' — ' + parsed.items[i].html_url);
  }
  // Known-issue follow-up: issue_read({owner, repo, issue_number}) → cache cache/github/{owner}-{repo}/issue-{id}
  return report.join(NL);
} catch (e) { return 'FAIL github: ' + e.message; }
```

### Fetch & cache: fetch doc pages

`fetch({url}); check the 'Contents of' prefix (robots.txt pre-probe noise — a 'Failed to fetch robots.txt' result means the target is UNREACHABLE, not a content error; never cache failure strings); cache cache/fetch/{hostname-slug}/{path-slug}.`

```javascript
// fetch returns a plain string, markdown-simplified, prefixed 'Contents of <url>:'.
// Tool call pattern: fetch({ url: '<url>', max_length: 100000 })
// Response format: PLAIN STRING — 'Contents of <url>:' followed by the markdown body
// Every fetch probes robots.txt FIRST: 'Failed to fetch robots.txt ... connection issue'
// means the HOST IS UNREACHABLE — surface it as a FAIL line, never cache the failure string
var NL = String.fromCharCode(10);
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
try {
  var page = fetch({ url: '<url>', max_length: 100000 });
  if (page.indexOf('Failed to fetch robots.txt') >= 0) { return 'FAIL fetch <url>: unreachable host (robots.txt probe failed)'; }
  if (page.indexOf('Contents of ') !== 0) { return 'FAIL fetch <url>: unexpected response prefix'; }
  var parts = '<url>'.replace(/^https?:\/\//, '').split('/');
  var hostSlug = slugify(parts[0]);                       // e.g. developer.chrome.com
  var pathSlug = slugify(parts.slice(1).join(' ')) || 'index';
  var key = 'cache/fetch/' + hostSlug + '/' + pathSlug;
  var body = ['tool: fetch', 'url: <url>', 'date: <YYYY-MM-DD>', 'source: fetch', '', page].join(NL);
  var r = write_memory({ memory_name: key, content: body, max_chars: 500000 });
  if (r.indexOf('written') < 0) { return 'FAIL ' + key + ': ' + r; }
  return 'OK   ' + key + ' chars=' + page.length;
} catch (e) { return 'FAIL fetch: ' + e.message; }
```

### Synthesize the research memory

`write researches/about first (new domain), then researches/{topic-slug}: synthesized findings + a '## Cached sources' section listing EVERY cache entry used with mem: links; every finding traces to a cached response or observed output.`

```javascript
// Research memories are knowledge, not raw dumps: findings + mem: refs into cache.
// Tool call pattern: write_memory({ memory_name: 'researches/about', content: '<about>' })
// Tool call pattern: write_memory({ memory_name: 'researches/<topic-slug>', content: '<synthesis>' })
// Response format: plain text 'Memory <name> written.' — check indexOf('written')
var NL = String.fromCharCode(10);
try {
  var about = [
    '# Researches',
    '',
    'Synthesized findings from cache-first research runs; every finding traces to a cached response.',
    '',
    '## Scope',
    '',
    '- researches/{topic-slug} — per-topic syntheses with a `## Cached sources` list of `mem:` refs.',
    '',
    '## Boundaries (out of scope)',
    '',
    '- Raw fetched content — lives in `cache/{source}/...`, not here.',
  ].join(NL);
  var r0 = write_memory({ memory_name: 'researches/about', content: about, max_chars: 5000 });
  if (r0.indexOf('written') < 0) { return 'FAIL researches/about: ' + r0; }
  var syn = [
    '# <Topic>',
    '',
    '<synthesized findings — each traces to a cached response or observed output>',
    '',
    '## Cached sources',
    '',
    '- mem:cache/deepwiki/<topic-slug>/<question-slug>',
    '- mem:cache/github/<owner>-<repo>/issue-<id>',
    '- mem:cache/fetch/<hostname-slug>/<path-slug>',
  ].join(NL);
  var r = write_memory({ memory_name: 'researches/<topic-slug>', content: syn, max_chars: 500000 });
  if (r.indexOf('written') < 0) { return 'FAIL researches/<topic-slug>: ' + r; }
  return 'OK   researches/<topic-slug> refs=<n>';
} catch (e) { return 'FAIL synthesize: ' + e.message; }
```

### Private branch (devtools-derived only)

When the source is devtools (authenticated session output) or the content may contain PII / job / application data, route everything to the `private` domain: `private/about` first, then `private/{subdomain}/{topic-slug}` (synthesis) and `private/cache/devtools/...` (raw responses) — never `researches/{topic}` or `cache/{source}/...`. Content gathered from public sources (deepwiki, github, fetch, tavily, context7) stays public. Public `cache/` entries are never created from private sources, and public memories never `mem:`-reference `private/*`.

### Return the status report

`per-op lines only: HIT/MISS, OK/FAIL <name> chars=<n>; never return raw content.`

```javascript
// The ONLY thing returned to the model is the per-operation status report.
// Raw content never leaves the script — it lives only in serena.
var NL = String.fromCharCode(10);
return report.join(NL) || 'OK   (no ops this run)';
```

## Generalized skeleton

One compact script per SOURCE batch, phases labeled CHECK → FETCH → STORE → SYNTHESIZE. Split by source into a few `mcp-exec` calls — a monolithic batch with MANY tool calls can hit the gateway timeout (-32001) mid-loop. All loops live inside the script; no cross-call state is needed (variables do not persist between mcp-exec calls).

```javascript
// Generalized research-with-caching skeleton (sync-only, single-quoted strings).
// Phases per source batch: CHECK (cache lookup) -> FETCH (on MISS) -> STORE -> REPORT.
// One mcp-exec per source (deepwiki / github / fetch) to avoid batch timeouts.
var NL = String.fromCharCode(10);
var report = [];
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
function ok(s) { return typeof s === 'string' && (s.indexOf('written') >= 0 || s.indexOf('edited') >= 0); }
function store(name, content) {
  try {
    var r = write_memory({ memory_name: name, content: content, max_chars: 500000 });
    report.push((ok(r) ? 'OK   ' : 'FAIL ') + name + (ok(r) ? ' chars=' + content.length : ': ' + r));
  } catch (e) { report.push('FAIL ' + name + ': ' + e.message); }
}
try {
  // CHECK — list_memories({topic: 'cache/<source>/<scope>'}) + read the exact key → HIT skips fetch
  // FETCH — per tool: deepwiki PLAIN TEXT (no JSON.parse); github JSON (check error/incomplete_results);
  //         fetch 'Contents of' prefix; robots.txt probe failure = unreachable host, never cached
  // STORE — header (tool, query/URL, date, source line) + FULL raw response under the canonical key
  // SYNTHESIZE — separate call: researches/about first, then researches/{topic-slug} with a
  //              '## Cached sources' list of mem: refs for every cache entry used
  report.push('OK   source batch done');
} catch (e) {
  report.push('ERROR: ' + e.message);
}
return report.join(NL); // tiny per-op status lines only — raw content never returned
```

## Best practices

- Cache-first ALWAYS: check `cache/{source}/...` before calling the tool — this is the default for every research, no reminding needed.
- Deterministic keys: same tool+query → same key → cache-check hits; use the canonical `cache/{source}/{scope}/{descriptor}` scheme.
- Never cache error/failure strings (deepwiki non-answers, github `error` objects, fetch unreachable-host probes) — cache only successful raw responses.
- Status-report-only return: HIT/MISS + OK/FAIL `<name> chars=<n>`; raw content never enters the model context.
- Pass `max_chars` large (500000) on cache writes — it is undocumented and a small/omitted value may truncate long responses.
- About-first: `researches/about` before topic memories; extend `cache/about` per new source before its first write.
- Private branch (devtools-derived / PII only): route to private/ namespace (private/about, private/{subdomain}/{topic}, private/cache/{source}/...); never public researches/cache. Public-source content stays public.
- Regenerable entries → reconcile stale ones with `delete_memory` (serena has delete, unlike the filesystem server).
- Split batches by source to avoid the gateway timeout (-32001) on monolithic mcp-exec calls.

## Common pitfalls

- **Deepwiki is plain text**: `ask_question` returns markdown, NOT JSON — never `JSON.parse` it; treat the response as content directly. (Contrast with `get_transcript`, which is JSON-on-success — do not confuse the two.)
- **fetch robots.txt pre-probe**: every `fetch` probes robots.txt first — `'Failed to fetch robots.txt ... connection issue'` means the target host is UNREACHABLE, not a content error; don't cache failure strings.
- **GitHub payload bloat**: always fields-trim search results; check `error`/`incomplete_results`; rate limits surface as text/JSON, not exceptions.
- **Monolithic batch timeouts**: many tool calls in one mcp-exec can hit the gateway timeout (-32001) mid-loop — split by source into a few batches.
- **Key collisions**: 60-char slug cap + punctuation dropping can collide — hash-suffix when ambiguous; cache-check before write.
- **Forgetting about-first**: `cache/about` must cover each new source; `researches/about` before topic memories.
- **Never dump raw content** into the report — it defeats the whole pattern.

Full API shapes and probed response formats: [content-fetch-api](../references/content-fetch-api.md).
