# Recipe: External Content Caching

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `tavily` (web search/harvest), `youtube-transcript` (video info + full transcripts), `serena` (memory store) |
| **When to use** | Fetching and caching external content — web-search results, library docs, YouTube transcripts — so the model context stays tiny, every fetched part is stored under `cache/{source}/...`, and any part can be revisited later via `list_memories` + `read_memory` without re-fetching |
| **Combines with** | [store-memories](./store-memories.md) — cache entries are serena memories written about-first; [collect-relevant-memories](./collect-relevant-memories.md) — revisit cached content selectively via topic list + read; [codebase-exploration](./codebase-exploration.md) — pair external findings with local code; [research-with-caching](./research-with-caching.md) — interactive per-topic variant (deepwiki/github/fetch), cache-first by default |

## Why this pattern

One `gateway_mcp-exec` call runs the entire pipeline: harvest candidate targets, verify them, fetch FULL content with pagination, write `cache/about` plus per-item `cache/{source}/{channel}/{slug}_{id}` memories, and return ONLY a tiny per-operation status report. Raw content never enters the model context — the script is the only thing that sees it. Every fetched part is stored and is revisitable via `list_memories` + `read_memory`. Live-run proof: ONE `gateway_mcp-exec` call drove ~121 MCP tool calls end-to-end (harvest → verify → 9-page paginated transcript fetch → ~dozens of memory writes) and returned only per-item `OK/FAIL <name> chars=<n> pages=<n>` lines. The model saw zero raw content; follow-up reads pulled specific cached items on demand.

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `code_mode({"name": "code-mode-content-cache", "servers": ["tavily", "youtube-transcript", "serena"]})` — the tool is exposed to mcp-exec under the returned prefixed name
4. API facts: [content-fetch-api](../references/content-fetch-api.md); serena formats: [serena-memory-api](../references/serena-memory-api.md)

## Scripts

All scripts are sync-only, single-quoted strings, array-join for multi-line content, per-op try/catch, and success confirmed by substring checks — never by `JSON.parse` on plain-text tools.

### Harvest candidate targets

`tavily_search with a max_results cap; parse the JSON string; extract only {title, url}; check for the "error" key and surface a 429 as a FAIL status line, not a crash.`

```javascript
// Harvest candidate targets from web search.
// Tool call pattern: tavily_search({ query: '<q>', max_results: 10, search_depth: 'advanced' })
// Response format: JSON STRING — { results: [{ title, url, content, score, ... }] };
// on rate limit: JSON STRING with an "error" key (status 429 detail) — check BEFORE parsing
var NL = String.fromCharCode(10);
var report = [];
function harvest(query) {
  try {
    var raw = tavily_search({ query: query, max_results: 10, search_depth: 'advanced' });
    var parsed = JSON.parse(raw); // tavily_search returns JSON — parse it
    if (parsed.error) { // 429 rate limit arrives as a JSON error object, not an exception
      report.push('FAIL harvest ' + query + ': ' + (parsed.error.status || '') + ' ' + parsed.error.message);
      return [];
    }
    var items = [];
    for (var i = 0; i < parsed.results.length; i++) {
      var r = parsed.results[i];
      if (r.title && r.url) { items.push(r.title + ' | ' + r.url); }
    }
    report.push('OK   harvest ' + query + ': ' + items.length + ' candidates');
    return items;
  } catch (e) {
    report.push('FAIL harvest ' + query + ': ' + e.message);
    return [];
  }
}
var candidates = harvest('site:youtube.com example research query');
return candidates.join(NL);
```

### Verify & filter candidates

`get_video_info per candidate; keep only uploader === '<channel>'; dedupe by video id.`

```javascript
// Verify each candidate is a real video by the target channel; dedupe by video id.
// Tool call pattern: get_video_info({ url: '<youtube-url>' })
// Response format: JSON STRING — { title, description, uploader, upload_date (ISO), duration }
// Note: keys are lowercase JSON; the uploader filter is a strict equality
var NL = String.fromCharCode(10);
var report = [];
var CHANNEL = '<channel>';
function verify(url) {
  try {
    var info = JSON.parse(get_video_info({ url: url }));
    if (info.uploader !== CHANNEL) { return null; }
    return info;
  } catch (e) {
    report.push('FAIL verify ' + url + ': ' + e.message);
    return null;
  }
}
var seen = {};
var verified = [];
for (var i = 0; i < candidates.length; i++) {
  var url = candidates[i].split(' | ')[1];
  var info = verify(url);
  if (!info) { continue; }
  var id = url.match(/[?&]v=([^&]+)/)[1]; // extract video id for dedupe + naming
  if (seen[id]) { continue; }
  seen[id] = true;
  verified.push({ id: id, title: info.title, url: url });
}
report.push('OK   verified ' + verified.length + '/' + candidates.length + ' for channel ' + CHANNEL);
return report.join(NL) + NL + '---' + NL + JSON.stringify(verified, null, 2);
```

### Fetch full content with pagination

`get_transcript loop over the opaque next_cursor until it is absent (hard cap ~9 pages); aggregate pages in-script; success pages are JSON ({title, transcript}) — parse them, and on parse failure check the plain-text error prefix 'Error executing tool get_transcript' BEFORE treating anything as content. NOTE: this stage is the pluggable one — swap for tavily_extract (docs) or any paginated fetch; the rest of the pipeline is unchanged.`

```javascript
// Fetch a FULL transcript by following the opaque next_cursor until it stops.
// Tool call pattern: get_transcript({ url: '<youtube-url>', lang: 'en', next_cursor: '<opaque>' })
// Response format: JSON string on SUCCESS — { title: '<video title>', transcript: '<full text>', next_cursor: '<opaque or absent>' }
// (~50K chars/page for long videos); on FAILURE (rate limit / IP ban / unavailable)
// a PLAIN-TEXT error string starting 'Error executing tool get_transcript:' is
// returned — JSON.parse throws on it, so wrap the parse and check the prefix
var NL = String.fromCharCode(10);
var MAX_PAGES = 9;
function fetchTranscript(url) {
  var pages = [];
  var cursor = '';
  var prev = '';
  for (var p = 0; p < MAX_PAGES; p++) {
    var params = { url: url, lang: 'en' };
    if (cursor) { params.next_cursor = cursor; }
    try {
      var page = get_transcript(params);
      if (typeof page === 'string' && page.indexOf('Error executing tool get_transcript') === 0) {
        return { ok: false, error: page }; // rate limit / IP ban — surface, don't cache
      }
      var parsed = JSON.parse(page); // success shape is JSON — parse it
      pages.push(parsed.transcript);
      if (!parsed.next_cursor || parsed.next_cursor === prev) { break; } // no new cursor → last page
      prev = parsed.next_cursor;
      cursor = parsed.next_cursor;
    } catch (e) {
      return { ok: false, error: 'page ' + p + ': ' + e.message }; // JSON.parse throw on error strings lands here
    }
  }
  return { ok: true, content: pages.join(NL), pages: pages.length };
}
var t = fetchTranscript('https://www.youtube.com/watch?v=<video_id>');
if (!t.ok) { return 'FAIL fetch: ' + t.error; }
return 'OK   fetch pages=' + t.pages + ' chars=' + t.content.length;
```

### Ensure cache/about first

`write_memory cache/about before topic writes when the domain is new; extend cache/about only if it grows a new source/channel.`

```javascript
// The cache domain's about exists before any topic write (serena convention).
// Tool call pattern: write_memory({ memory_name: 'cache/about', content: '<md>' })
// Response format: plain text 'Memory cache/about written.' — check indexOf('written')
var NL = String.fromCharCode(10);
try {
  var about = [
    '# Cache',
    '',
    'Fetched external content, stored for selective re-read.',
    '',
    '## Scope',
    '',
    '- cache/{source}/{channel}/{slug}_{id} — full fetched text with a short header (title, url, date, channel, source).',
    '- cache/{source}/{channel} — per-channel harvest snapshots (names only).',
    '',
    '## Boundaries (out of scope)',
    '',
    '- Interpretations or analysis — this domain stores raw fetched content, not conclusions.',
    '- Sources not listed in this about need an entry before their first write.',
    '',
    '## Sources',
    '',
    '- youtube: channel <channel>',
  ].join(NL);
  var r = write_memory({ memory_name: 'cache/about', content: about, max_chars: 100000 });
  if (r.indexOf('written') < 0) { return 'ERROR: cache/about write not confirmed: ' + r; }
  return 'OK   cache/about';
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Write per-item cache entries

`name cache/{source}/{channel}/{slug}_{video_id} (kebab-case slug from title); content = short header (title, url, date, channel, source) + full fetched text; pass large max_chars (undocumented); confirm via indexOf('written').`

```javascript
// Store one fully-fetched item under a self-describing cache name.
// Tool call pattern: write_memory({ memory_name: 'cache/youtube/<channel>/<slug>_<id>', content: '<header + full text>', max_chars: <large> })
// Response format: plain text 'Memory <name> written.' — check indexOf('written');
// max_chars is UNDOCUMENTED — pass it large (100000+) so full transcripts are not truncated
var NL = String.fromCharCode(10);
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function storeItem(item) {
  try {
    var name = 'cache/youtube/' + CHANNEL + '/' + slugify(item.title) + '_' + item.id;
    var content = [
      'title: ' + item.title,
      'url: ' + item.url,
      'date: ' + item.date,
      'channel: ' + CHANNEL,
      'source: youtube',
      '',
      item.fullText,
    ].join(NL);
    var r = write_memory({ memory_name: name, content: content, max_chars: 100000 });
    if (r.indexOf('written') < 0) { return 'FAIL ' + name + ': ' + r; }
    return 'OK   ' + name + ' chars=' + item.fullText.length + ' pages=' + item.pages;
  } catch (e) {
    return 'FAIL ' + item.id + ': ' + e.message;
  }
}
var lines = [];
for (var i = 0; i < fetched.length; i++) { lines.push(storeItem(fetched[i])); }
return lines.join(NL);
```

### Return the status report

`per-op lines only: OK/FAIL <name> chars=<n> pages=<n>; never return content.`

```javascript
// The ONLY thing returned to the model is the per-operation status report.
// Raw content never leaves the script — it lives only in serena.
var NL = String.fromCharCode(10);
return report.join(NL) || 'OK   (no items this run)';
```

### Reconcile superseded entries & re-read selectively

`list_memories topic cache/<source>/<channel>; delete_memory entries absent from the new harvest (regenerable per cache/about); demonstrate selective re-read via read_memory.`

```javascript
// List cached items for a channel, drop stale ones, and show a selective re-read.
// Tool call pattern: list_memories({ topic: 'cache/youtube/<channel>' })
// Response format: JSON STRING — {"memories": ["cache/youtube/<channel>/<slug>_<id>", ...]},
// topic filtering is prefix-based and case-sensitive
// Tool call pattern: delete_memory({ memory_name: '<name>' })
// Response format: plain text containing 'deleted', or an error string containing 'not found'
var NL = String.fromCharCode(10);
var report = [];
try {
  var listed = JSON.parse(list_memories({ topic: 'cache/youtube/' + CHANNEL }));
  var onDisk = {};
  for (var i = 0; i < listed.memories.length; i++) { onDisk[listed.memories[i]] = true; }
  for (var name in onDisk) {
    if (currentHarvest.indexOf(name) < 0) { // not in this run's new harvest → superseded
      try {
        var d = delete_memory({ memory_name: name });
        report.push((d.indexOf('deleted') >= 0 ? 'OK   ' : 'FAIL ') + 'delete ' + name + ': ' + d);
      } catch (e) { report.push('FAIL delete ' + name + ': ' + e.message); }
    }
  }
} catch (e) { report.push('FAIL reconcile: ' + e.message); }
// Selective re-read: read ONE cached item back on demand, not the whole batch.
try {
  var raw = read_memory({ memory_name: 'cache/youtube/' + CHANNEL + '/<slug>_<id>' });
  report.push('OK   re-read: ' + raw.length + ' chars back');
} catch (e) { report.push('FAIL re-read: ' + e.message); }
return report.join(NL);
```

## Generalized skeleton

One compact script, phases labeled HARVEST → VERIFY → FETCH → STORE. FETCH is the only source-specific stage — swap `get_transcript` for `tavily_extract` (library docs) or any paginated fetch; everything else stays identical. This is ONE `gateway_mcp-exec` call: all loops live inside the script, and no cross-call state is needed (variables do not persist between mcp-exec calls).

```javascript
// Generalized external-content-caching skeleton (sync-only, single-quoted strings).
// Phases: HARVEST -> VERIFY -> FETCH -> STORE -> REPORT.
// FETCH is source-agnostic: get_transcript (video) / tavily_extract (docs) / any
// paginated fetch — the rest of the pipeline is unchanged.
var NL = String.fromCharCode(10);
var report = [];
function ok(s) { return typeof s === 'string' && (s.indexOf('written') >= 0 || s.indexOf('deleted') >= 0); }
function store(name, content) {
  try {
    var r = write_memory({ memory_name: name, content: content, max_chars: 100000 });
    report.push((ok(r) ? 'OK   ' : 'FAIL ') + name + (ok(r) ? ' chars=' + content.length : ': ' + r));
  } catch (e) { report.push('FAIL ' + name + ': ' + e.message); }
}
try {
  // HARVEST — tavily_search JSON; surface 429 "error" key as a FAIL line
  var search = JSON.parse(tavily_search({ query: '<query>', max_results: 10, search_depth: 'advanced' }));
  if (search.error) { report.push('FAIL harvest: ' + search.error.message); return report.join(NL); }
  // VERIFY — get_video_info uploader filter, dedupe by id
  // FETCH — paginated full-text loop with hard page cap and plain-text error checks
  // STORE — cache/about first, then cache/{source}/{channel}/{slug}_{id} per item
  report.push('OK   pipeline done');
} catch (e) {
  report.push('ERROR: ' + e.message);
}
return report.join(NL); // tiny per-op status lines only — raw content never returned
```

## Best practices

- This pipeline handles public sources only (tavily search, YouTube transcripts) — content stays in the public cache/ namespaces. Authenticated-session extraction (devtools) is the only private path: its output goes to `private/` per the browser-automation workflow.
- One `mcp-exec` per batch — a whole harvest + fetch + store runs in a single call; loops live inside the script (no cross-call state; variables do not persist between calls).
- Per-op try/catch plus success-substring checks (`written`, `deleted`) — a failure reports a FAIL line and does not abort sibling operations.
- Never `JSON.parse` plain-text tools: `write_memory`, `delete_memory`, and `get_available_languages` return plain text; `tavily_search`, `get_video_info`, `get_transcript` (success) and `list_memories` return JSON strings. `get_transcript` FAILURES return a plain-text error string — wrap the `JSON.parse` and fall back to the error-prefix check.
- Check error substrings: tavily 429 arrives as a JSON `"error"` key (not an exception); YouTube rate limits / IP bans arrive as plain-text `Error executing tool get_transcript: ...` strings (repeated calls in quick succession trip them) — handle both before treating a page as content.
- Raw content never returned: the model only ever sees the per-op status report; content lives in serena.
- Pass `max_chars` large on cache writes — it is undocumented and defaults may truncate multi-page transcripts.
- Right-size waiver for cache entries: cache content is exempt from the usual right-size rule because `cache/about` documents that the domain stores raw fetched content by design (regenerable, so size is not a staleness risk).
- Regenerable entries → reconcile stale ones with `delete_memory` (unlike the filesystem server, serena has delete).

## Common pitfalls

- **Rate limits / IP bans**: tavily 429 returns a JSON object with an `"error"` key (check it after `JSON.parse`, before reading `.results`); YouTube blocking returns a plain-text string (`Error executing tool get_transcript: Could not retrieve a transcript for the video <url>! ...`), and repeated transcript calls in quick succession trip it. Surface both as FAIL status lines — never crash the script and never cache the error text.
- **Opaque cursor loops**: `next_cursor` values are opaque and the pagination end is signaled by the cursor going absent or repeating — cap the loop hard (~9 pages) so a broken cursor cannot fetch forever; also treat a repeated cursor as the last page.
- **write_memory overwrites**: `write_memory` replaces the whole memory — per-item names must be unique (`{slug}_{video_id}`) and updates must rewrite full content; use `edit_memory` only for small surgical changes.
- **Undocumented max_chars**: `max_chars` is not in the documented serena surface — pass it large (100000+) on cache writes or transcripts may be truncated silently.
- **Harvest drift**: web search results change between runs — regenerate the whole channel snapshot each run (entries are re-fetchable) and `delete_memory` entries absent from the new harvest; never hand-merge snapshots.
- **Memory-name constraints**: names are case-sensitive and `/` creates hierarchy — kebab-case the slug, keep the video id, and keep the `cache/{source}/{channel}/` prefix so `list_memories` topic filtering works.
- **Never dump raw content**: returning fetched text (or a single full transcript) to the model defeats the pattern — the return value is only `OK/FAIL <name> chars=<n> pages=<n>` lines.

Full API shapes and probed response formats: [content-fetch-api](../references/content-fetch-api.md).
