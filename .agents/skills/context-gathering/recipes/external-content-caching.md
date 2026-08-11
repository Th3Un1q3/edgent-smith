# Recipe: External Content Caching

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `tavily` (web search/harvest), `fetch` / `deepwiki` / `github` (source-specific fetchers), `youtube-transcript` (video transcripts — used by the YouTube example below), `serena` (memory store) |
| **When to use** | Fetch and cache external content of ANY kind — web pages, library docs, search results, API responses, transcripts — verbatim, with verification — so the model context stays tiny, every fetched part is stored under `cache/{source}/...`, and any part can be revisited later via `list_memories` + `read_memory` without re-fetching |
| **Combines with** | [store-memories](./store-memories.md) — cache entries are serena memories written about-first; [collect-relevant-memories](./collect-relevant-memories.md) — revisit cached content selectively via topic list + read; [codebase-exploration](./codebase-exploration.md) — pair external findings with local code; [research-with-caching](./research-with-caching.md) — interactive per-topic variant (deepwiki/github/fetch), cache-first by default |

**Orientation:** the pipeline below is generic; a labeled YouTube-transcript example application follows it at the end of this file.

## Why this pattern

One `gateway_mcp-exec` call runs the entire pipeline: harvest candidate targets, verify them, fetch FULL content with pagination, write `cache/about` plus per-item `cache/{source}/{scope}/{descriptor}` memories, and return ONLY a tiny per-operation status report. Raw content never enters the model context — the script is the only thing that sees it. Every fetched part is stored and is revisitable via `list_memories` + `read_memory`. Live-run proof: ONE `gateway_mcp-exec` call drove ~121 MCP tool calls end-to-end (harvest → verify → 9-page paginated transcript fetch → ~dozens of memory writes) and returned only per-item `OK/FAIL <name> chars=<n> pages=<n>` lines. The model saw zero raw content; follow-up reads pulled specific cached items on demand.

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `gateway_code-mode({"name": "code-mode-content-cache", "servers": ["tavily", "fetch", "deepwiki", "github", "youtube-transcript", "serena"]})` — the tool is exposed to mcp-exec under the returned prefixed name; activate only the servers the target source needs
4. API facts: [content-fetch-api](../references/content-fetch-api.md); serena formats: [serena-memory-api](../references/serena-memory-api.md)

## Generic pipeline: cache any external content

**Order of operations:** HARVEST → VERIFY → FETCH → STORE → VERIFY → REPORT. Every run follows this sequence; the stages below detail each step.

All scripts are sync-only, single-quoted strings, array-join for multi-line content, per-op try/catch, and success confirmed by substring checks — never by `JSON.parse` on plain-text tools.

**Script hygiene:** gateway mcp-exec scripts must be valid JSON — quote keys and string values correctly; a malformed script wastes a call and dumps error text into context. Before exec, sanity-check quotes/braces. Combine multiple MCP ops into ONE script where possible (batching), and keep per-call output to status lines. **Scope every list_memories with a topic prefix** (e.g., {topic:'cache/{source}'} or {topic:'researches'}) — topic-scope to exactly the domains you need instead of enumerating the whole store. The one exception is the PRE-EXISTING DOMAINS FIRST survey ([Memory Convention](../references/memory-convention.md)), which intentionally runs `list_memories({})` to decide domain placement before creating a new domain; outside that survey, an untopic'd full-store enumeration (~140 names) is pure context waste.

### One-script skeleton (primary walkthrough)

One compact script runs the entire pipeline, phases labeled HARVEST → VERIFY → FETCH → STORE → VERIFY → REPORT. FETCH is the only source-specific stage — swap `get_transcript` for `tavily_extract` (library docs) or any paginated fetch; everything else stays identical. This is ONE `gateway_mcp-exec` call: all loops live inside the script, and no cross-call state is needed (variables do not persist between mcp-exec calls).

```javascript
// Generalized external-content-caching skeleton (sync-only, single-quoted strings).
// Phases: HARVEST -> VERIFY -> FETCH -> STORE -> VERIFY -> REPORT.
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
  // VERIFY — source-specific metadata filter, dedupe by canonical key
  // FETCH — paginated full-text loop with hard page cap and plain-text error checks
  // STORE (write checkpoint — mandatory on successful fetch) — cache/about first, then cache/{source}/{scope}/{descriptor} per item
  // VERIFY — read back 1–2 entries and confirm stored content matches fetched
  report.push('OK   pipeline done');
} catch (e) {
  report.push('ERROR: ' + e.message);
}
return report.join(NL); // tiny per-op status lines only — raw content never returned
```

### Stage 1 — Harvest candidate targets

`tavily_search with a max_results cap; parse the JSON string; extract only {title, url}; check for the "error" key and surface a 429 as a FAIL status line, not a crash. For non-search sources, harvest by enumeration instead (channel video lists, repo file lists, feeds) — extract only the IDs/names you need IN-SCRIPT and return a compact summary (counts + the specific keys you need); see the YouTube example application below for a worked enumeration recipe.`

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
var candidates = harvest('<query>');
return candidates.join(NL);
```

### Stage 2 — Verify & filter candidates

`Fetch metadata per candidate; keep only items matching the target scope; dedupe by canonical key (URL, id, or name). **Aggregate output cap:** when aggregating verification results, truncate each row to ≤120 chars and keep the TOTAL aggregated output ≤3KB.`

```javascript
// Verify each candidate matches the target scope; dedupe by canonical key.
// Tool call pattern: <source-specific metadata tool>({ ... }) — e.g., get_video_info for
// YouTube (see the example application below), github search_issues, deepwiki ask_question
// Response format: JSON STRING of metadata; the scope filter is a strict equality
var NL = String.fromCharCode(10);
var report = [];
var SCOPE = '<target scope, e.g. channel / repo / feed>';
function verify(candidate) {
  try {
    var info = JSON.parse(<metadataFetch>(candidate)); // source-specific metadata fetch
    if (info.scopeField !== SCOPE) { return null; }     // source-specific scope filter
    return info;
  } catch (e) {
    report.push('FAIL verify ' + candidate + ': ' + e.message);
    return null;
  }
}
var seen = {};
var verified = [];
for (var i = 0; i < candidates.length; i++) {
  var key = candidates[i].split(' | ')[1] || candidates[i]; // canonical key: url / id / name
  var info = verify(candidates[i]);
  if (!info) { continue; }
  if (seen[key]) { continue; }
  seen[key] = true;
  verified.push({ id: key, title: info.title, url: key });
}
report.push('OK   verified ' + verified.length + '/' + candidates.length + ' for scope ' + SCOPE);
return report.join(NL) + NL + '---' + NL + JSON.stringify(verified, null, 2);
```

### Stage 3 — Fetch full content (source-specific)

`This stage is the pluggable one — swap the fetch tool per source: tavily_extract for library docs, get_transcript for YouTube transcripts (see the example application below), any paginated fetch for lists — the rest of the pipeline is unchanged. Follow the opaque cursor until it is absent (hard cap ~9 pages); aggregate pages in-script; success responses are JSON — parse them, and on parse failure check the plain-text error prefix BEFORE treating anything as content.`

```javascript
// Fetch a FULL item by following the source's pagination until it stops.
// Tool call pattern: <source fetch>({ url: '<target>', ..., next_cursor: '<opaque>' })
// Response format: JSON string on SUCCESS — { title: '<title>', content: '<full text>', next_cursor: '<opaque or absent>' };
// on FAILURE (rate limit / IP ban / unavailable) a PLAIN-TEXT error string is
// returned — JSON.parse throws on it, so wrap the parse and check the prefix
var NL = String.fromCharCode(10);
var MAX_PAGES = 9;
function fetchItem(url) {
  var pages = [];
  var cursor = '';
  var prev = '';
  for (var p = 0; p < MAX_PAGES; p++) {
    var params = { url: url };
    if (cursor) { params.next_cursor = cursor; }
    try {
      var page = <sourceFetch>(params);
      if (typeof page === 'string' && page.indexOf('Error executing tool ') === 0) {
        return { ok: false, error: page }; // rate limit / IP ban — surface, don't cache
      }
      var parsed = JSON.parse(page); // success shape is JSON — parse it
      pages.push(parsed.content);
      if (!parsed.next_cursor || parsed.next_cursor === prev) { break; } // no new cursor → last page
      prev = parsed.next_cursor;
      cursor = parsed.next_cursor;
    } catch (e) {
      return { ok: false, error: 'page ' + p + ': ' + e.message }; // JSON.parse throw on error strings lands here
    }
  }
  return { ok: true, content: pages.join(NL), pages: pages.length };
}
var f = fetchItem('<target-url>');
if (!f.ok) { return 'FAIL fetch: ' + f.error; }
return 'OK   fetch pages=' + f.pages + ' chars=' + f.content.length;
```

### Stage 4 — Ensure cache/about first

`write_memory cache/about before topic writes when the domain is new; extend cache/about only if it grows a new source/scope. NEVER overwrite an existing about — check existence first via list_memories on the DOMAIN PREFIX, then test membership (exact-name topic lookups return {} and never match; see store-memories.md).`

```javascript
// The cache domain's about exists before any topic write (serena convention).
// EXISTENCE CHECK FIRST: list_memories topic filtering is PREFIX-based, so an
// exact-name lookup ({topic: 'cache/about'}) returns {} and never matches.
// List the domain prefix, then test membership; only write when ABSENT —
// an existing domain about is NEVER overwritten without operator approval.
// Tool call pattern: list_memories({ topic: 'cache' }) — prefix list
// Response format: JSON STRING — {"memories": ["cache/about", ...]}; parse and test membership
// Tool call pattern: write_memory({ memory_name: 'cache/about', content: '<md>' })
// Response format: plain text 'Memory cache/about written.' — check indexOf('written')
var NL = String.fromCharCode(10);
try {
  var dom = JSON.parse(list_memories({ topic: 'cache' }));
  if ((dom.memories || []).indexOf('cache/about') >= 0) { return 'OK   cache/about (exists — no overwrite)'; }
  var about = [
    '# Cache',
    '',
    'Fetched external content, stored for selective re-read.',
    '',
    '## Scope',
    '',
    '- cache/{source}/{scope}/{descriptor} — full fetched text with a short header (title, url, date, source).',
    '- cache/{source}/{scope} — per-scope harvest snapshots (names only).',
    '',
    '## Boundaries (out of scope)',
    '',
    '- Interpretations or analysis — this domain stores raw fetched content, not conclusions.',
    '- Sources not listed in this about need an entry before their first write.',
    '',
    '## Sources',
    '',
    '- <source>: <scope>',
  ].join(NL);
  var r = write_memory({ memory_name: 'cache/about', content: about, max_chars: 100000 });
  if (r.indexOf('written') < 0) { return 'ERROR: cache/about write not confirmed: ' + r; }
  return 'OK   cache/about';
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Stage 5 — Write per-item cache entries

`name cache/{source}/{scope}/{descriptor} (kebab-case slug from title + the canonical key); content = short header (title, url, date, source) + full fetched text; pass large max_chars (undocumented); confirm via indexOf('written').`

```javascript
// Store one fully-fetched item under a self-describing cache name.
// Tool call pattern: write_memory({ memory_name: 'cache/{source}/{scope}/{descriptor}', content: '<header + full text>', max_chars: <large> })
// Response format: plain text 'Memory <name> written.' — check indexOf('written');
// max_chars is UNDOCUMENTED — pass it large (100000+) so full content is not truncated
var NL = String.fromCharCode(10);
var SOURCE = '<source>';
var SCOPE = '<scope>';
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function storeItem(item) {
  try {
    var name = 'cache/' + SOURCE + '/' + SCOPE + '/' + slugify(item.title) + '_' + item.id;
    var content = [
      'title: ' + item.title,
      'url: ' + item.url,
      'date: ' + item.date,
      'source: ' + SOURCE,
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

### Stage 6 — Verify cache writes

`Verify cache writes: after each cache-write batch, read back 1–2 entries, confirm stored content matches fetched, report "N fetched → N cached → N verified"; failing entry = delete + redo. (General principle: SKILL.md Principles — "Verify every write".) Return only header + length + ≤700-char excerpt from a read-back, never the full content — **read-back integrity:** slicing a single memory/file into multiple reads whose concatenation returns the full content DEFEATS the ≤2KB rule; verification read-backs return ONLY header + length + ≤700-char excerpt (or aggregated scalar fields totaling ≤3KB), never the full content, even split across calls. Worked JS truncation/budget snippets (head/middle/tail/keyword-centered, 2 KB enforcement, verification read-back): [truncation-examples](../references/truncation-examples.md).`

### Stage 7 — Return the status report

`per-op lines only: OK/FAIL <name> chars=<n> pages=<n>; never return content. **Label status/checkpoint sections with the ACTUAL run identity** (e.g., 'Run 4 — ses_<session-id>, YYYY-MM-DD'). Never reuse a prior run's label (e.g., writing 'Run 2' when this is Run 3+) — stale labels corrupt provenance.`

```javascript
// The ONLY thing returned to the model is the per-operation status report.
// Raw content never leaves the script — it lives only in serena.
var NL = String.fromCharCode(10);
return report.join(NL) || 'OK   (no items this run)';
```

### Stage 8 — Return snippets for relevance judgment

When the caller (orchestrator/model) must judge relevance, cache the COMPLETE content verbatim (per verbatim + cardinality rules), but return ONLY: (1) per-op status lines (`OK/FAIL <name> chars=<n>`), and (2) a 200–300 char excerpt per item — the first ~200 chars of the cached content (or the matching snippet for search hits) — enough to judge the topic, never enough to substitute for the cached copy. Returning >300 chars of excerpt per item, or full content, is a violation. To "dig deeper" on a relevant item, `read_memory({memory_name})` on demand.

```javascript
// Status report PLUS a relevance snippet per item: full content stays cached,
// only a short excerpt (first ~200 chars of the cached content, or the
// matching snippet for search hits) is returned so the caller can judge.
var NL = String.fromCharCode(10);
var lines = report.slice();                       // per-op OK/FAIL <name> chars=<n> lines
for (var i = 0; i < fetched.length; i++) {
  var it = fetched[i];
  var excerpt = it.fullText.slice(0, 200);        // ≤ 300 chars — never the whole item
  lines.push('EXCERPT ' + it.name + ': ' + excerpt);
}
return lines.join(NL);
```

### Stage 9 — Reconcile superseded entries & re-read selectively

`list_memories topic cache/<source>/<scope>; delete_memory entries absent from the new harvest (regenerable per cache/about); demonstrate selective re-read via read_memory.`

```javascript
// List cached items for a scope, drop stale ones, and show a selective re-read.
// Tool call pattern: list_memories({ topic: 'cache/{source}/{scope}' })
// Response format: JSON STRING — {"memories": ["cache/{source}/{scope}/<descriptor>", ...]},
// topic filtering is prefix-based and case-sensitive
// Tool call pattern: delete_memory({ memory_name: '<name>' })
// Response format: plain text containing 'deleted', or an error string containing 'not found'
var NL = String.fromCharCode(10);
var report = [];
try {
  var listed = JSON.parse(list_memories({ topic: 'cache/' + SOURCE + '/' + SCOPE }));
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
  var raw = read_memory({ memory_name: 'cache/' + SOURCE + '/' + SCOPE + '/<descriptor>' });
  report.push('OK   re-read: ' + raw.length + ' chars back');
} catch (e) { report.push('FAIL re-read: ' + e.message); }
return report.join(NL);
```

**Verbatim-cache contrast** — BAD: a hand-crafted summary (e.g., "Key points:" bullets) passed off as the cache entry body — the youtube-research postmortem failure; it fabricates content absent from the raw fetch and defeats re-reads. GOOD: verbatim raw transcript/content plus a minimal header (title, url, date, channel, source).

## Best practices

- This pipeline handles public sources only (tavily search, fetch, GitHub, YouTube transcripts) — content stays in the public cache/ namespaces. Authenticated-session extraction (devtools) is the only private path: its output goes to `private/` per the browser-automation workflow.
- One `mcp-exec` per batch — a whole harvest + fetch + store runs in a single call; loops live inside the script (no cross-call state; variables do not persist between calls).
- Per-op try/catch plus success-substring checks (`written`, `deleted`) — a failure reports a FAIL line and does not abort sibling operations.
- Never `JSON.parse` plain-text tools: `write_memory`, `delete_memory`, and `get_available_languages` return plain text; `tavily_search`, `get_video_info`, `get_transcript` (success) and `list_memories` return JSON strings. `get_transcript` FAILURES return a plain-text error string — wrap the `JSON.parse` and fall back to the error-prefix check.
- Check error substrings: tavily 429 arrives as a JSON `"error"` key (not an exception); YouTube rate limits / IP bans arrive as plain-text `Error executing tool get_transcript: ...` strings (repeated calls in quick succession trip them) — handle both before treating a page as content.
- Raw content never returned: the model only ever sees the per-op status report; content lives in serena.
- **Context budget (hard, ~60K tokens):** all tool returns must be truncated in-script — snapshot ≤2 KB; fetched content of ANY kind (transcript pages, doc pages, search results, raw tool responses) is CACHED to `cache/{source}/…`, NOT returned to the model; search results trimmed to {title, url}. Returning >5KB of raw content to the model is a violation (canonical guardrail: [caching-rules.md](../references/caching-rules.md)). **This applies to ALL tool returns AND file reads:** every snapshot (fetch output, memory read-back, file read, search results, enumeration output) returned to the model must be truncated in-script to ≤2 KB; memory read-backs for verification return only header + length + ≤700-char excerpt; full content stays in cache/files, NEVER in context. Returning >5KB of raw content (from any source) to the model is a violation. Worked JS truncation snippets (≤2 KB enforcement, verification read-back): [truncation-examples](../references/truncation-examples.md).
- Pass `max_chars` large on cache writes — it is undocumented and defaults may truncate multi-page transcripts.
- Right-size waiver for cache entries: cache content is exempt from the usual right-size rule because `cache/about` documents that the domain stores raw fetched content by design (regenerable, so size is not a staleness risk).
- Regenerable entries → reconcile stale ones with `delete_memory` (unlike the filesystem server, serena has delete).

## Common pitfalls

- **Rate limits / IP bans**: tavily 429 returns a JSON object with an `"error"` key (check it after `JSON.parse`, before reading `.results`); YouTube blocking returns a plain-text string (`Error executing tool get_transcript: Could not retrieve a transcript for the video <url>! ...`), and repeated transcript calls in quick succession trip it. Surface both as FAIL status lines — never crash the script and never cache the error text.
- **Opaque cursor loops**: `next_cursor` values are opaque and the pagination end is signaled by the cursor going absent or repeating — cap the loop hard (~9 pages) so a broken cursor cannot fetch forever; also treat a repeated cursor as the last page.
- **write_memory overwrites**: `write_memory` replaces the whole memory — per-item names must be unique (`{slug}_{video_id}`) and updates must rewrite full content; use `edit_memory` only for small surgical changes.
- **Undocumented max_chars**: `max_chars` is not in the documented serena surface — pass it large (100000+) on cache writes or transcripts may be truncated silently.
- **Harvest drift**: web search results change between runs — regenerate the whole snapshot each run (entries are re-fetchable) and `delete_memory` entries absent from the new harvest; never hand-merge snapshots.
- **Memory-name constraints**: names are case-sensitive and `/` creates hierarchy — kebab-case the slug, keep the canonical id, and keep the `cache/{source}/{scope}/` prefix so `list_memories` topic filtering works.
- **Never dump raw content**: returning fetched text (or a single full transcript) to the model defeats the pattern — the return value is only `OK/FAIL <name> chars=<n> pages=<n>` lines.

Full API shapes and probed response formats: [content-fetch-api](../references/content-fetch-api.md).

## Acceptance criteria

Checklist — every item is objectively checkable and must pass before the run counts as complete:

- [ ] **Cardinality** — one cache entry per fetched item: `list_memories({topic: 'cache/{source}/{scope}'})` lists exactly one entry per item fetched, and no URL appears in two entries.
- [ ] **Count match** — the returned status report shows the same N across all three stages: "N fetched → N cached → N verified".
- [ ] **Context budget** — the script's total return is ≤2 KB: per-op `OK/FAIL <name> chars=<n> pages=<n>` lines only, plus ≤300-char excerpts where relevance snippets are requested — never full content.
- [ ] **Verbatim bodies** — read back 1–2 entries and confirm the body is verbatim raw content (no summary boilerplate), not a hand-crafted summary.
- [ ] **About present** — `list_memories({topic: 'cache'})` includes `cache/about`, and an existing `cache/about` was never overwritten.

## Example application: YouTube channel caching

> **This section is an EXAMPLE of the generic pipeline applied to YouTube transcripts — not part of the core workflow.** Read it only when the target content is YouTube transcripts; otherwise follow the generic pipeline above.

### Channel enumeration (harvest — YouTube-specific)

> **NOTE — channel enumeration:** youtube-transcript CANNOT list a channel's video IDs — `get_video_info` / `get_transcript` require KNOWN video IDs. To enumerate a channel's videos, use, in order: (1) **mine existing catalog memories** first (e.g., `ai-engineering/youtube/*`, `researches/*`) before fetching anything; (2) **bash:** `uvx yt-dlp --flat-playlist --print '%(id)s|%(title)s' 'https://www.youtube.com/@<channel>'` if uv/network is available; (3) **RSS:** `https://www.youtube.com/feeds/videos.xml?channel_id=<id>` (resolve the channel ID first); (4) **search-engine query harvesting** + `get_video_info` uploader verification as LAST resort. Never expect youtube-transcript to enumerate.
>
> **Enumeration hygiene:** after yt-dlp/RSS/search enumeration, NEVER read the full enumeration output/file into context (a 1,000+ line channel list is ~100K chars — a hard context violation). Extract only the needed IDs/titles IN-SCRIPT (grep/head/tail/awk) and return a compact summary (counts + the specific IDs you need). If you must inspect a file, read at most ~30 lines / ≤2KB slices via the same script.

### Uploader-filter verification (verify — YouTube-specific)

`get_video_info per candidate; keep only uploader === '<channel>'; dedupe by video id. **Aggregate output cap:** when aggregating get_video_info results, truncate each description to ≤120 chars, keep per-video rows compact (id | title | date | duration | first-120-chars), and keep the TOTAL aggregated output ≤3KB.`

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

### Transcript fetch (fetch — YouTube-specific)

`get_transcript loop over the opaque next_cursor until it is absent (hard cap ~9 pages); aggregate pages in-script; success pages are JSON ({title, transcript}) — parse them, and on parse failure check the plain-text error prefix 'Error executing tool get_transcript' BEFORE treating anything as content.`

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

### Duration-proportional verification math (transcript-specific)

The only length check for YouTube cache entries is duration-proportional: a video's cached transcript should be roughly ~1K chars/min of runtime, ±50%. This transcript-specific length expectation applies to the YouTube example only; the general 'Verify every write' principle lives in [SKILL.md](../SKILL.md) Principles — "Verify every write".

### Cache naming & per-item writes (YouTube-shaped)

`name cache/youtube/{channel}/{slug}_{video_id} (kebab-case slug from title); content = short header (title, url, date, channel, source) + full fetched text; pass large max_chars (undocumented); confirm via indexOf('written'). cache/about lists the source as '- youtube: channel <channel>' (see Stage 4).`

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

### Per-video acceptance criteria (YouTube-shaped)

Checklist for a YouTube run — the generic acceptance criteria above plus:

- [ ] **Cardinality** — `list_memories({topic: 'cache/youtube/<channel>'})` lists exactly one entry per video ID fetched, and no URL appears in two entries.
- [ ] **Uploader verified** — every cached entry's metadata shows `uploader === <channel>`.
- [ ] **Duration-proportional length** — read-back transcript length ≈ duration × ~1K chars/min ±50% (continuous spoken text, no summary boilerplate).

### Workspace-scoped note (edgent-smith only, not general)

`cache/youtube-videos/ai-engineer/*` and `cache/youtube-videos/aidotengineer/*` are the SAME channel (@aiDotEngineer) — REUSE existing transcripts; never create a second channel directory for an already-cached channel; re-fetching a cached video's transcript is forbidden.
