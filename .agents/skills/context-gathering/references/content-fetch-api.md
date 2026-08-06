# Reference: Content-Fetch API — Tools & Response Formats

Canonical tool list and return formats for scripting the **tavily**, **youtube-transcript**, **deepwiki**, **github**, **fetch**, and **serena** MCP servers in code-mode for external content caching and cache-first research. The recipes point here instead of re-defining the formats, so there is a single source of truth. All tool calls must be **synchronous** — no `async`/`await`. Serena memory formats are NOT duplicated here — see [serena-memory-api.md](./serena-memory-api.md); this reference only records content-fetch/research-specific observations (e.g., the undocumented `max_chars`).

## Server identity

| Property | `tavily` | `youtube-transcript` | `serena` |
|---|---|---|---|
| Catalog server name | `tavily` | `youtube-transcript` | `serena` |
| Purpose | Web search (`tavily_search`) + page extraction (`tavily_extract`) | Video info + full transcripts by YouTube URL | Project memory store (gateway-only) |
| required_secrets | `tavily.api_token` | none listed | none listed |
| Lifetime | `long_lived: false` | `long_lived: false` | `long_lived: false` |

## Tool table

| Tool | Purpose | Response format (probed where marked) |
|---|---|---|
| `tavily_search` | Web search; harvest candidate targets | **JSON string** — `{ results: [{ title, url, content, score }] }`; params: `query`, `search_depth` (`basic`/`advanced`/`fast`/`ultra-fast`), `max_results`, `include_domains`, `exclude_domains`, `topic`, `time_range`, `start_date`/`end_date`, `include_raw_content`; on rate limit returns a JSON string with an `"error"` key (see Error shapes) — **not** an exception (probed) |
| `get_video_info` | Metadata for one YouTube URL | **JSON string** — `{ title, description, uploader, upload_date (ISO date), duration }`; use `uploader === '<channel>'` as a strict filter; extract the video id from the URL for dedupe/naming (probed) |
| `get_transcript` | Full transcript for one YouTube URL, paginated | **JSON string on success** — `{ title, transcript, next_cursor? }`: `title` like `'6 Things to Know about AIE World's Fair 2026 - YouTube'`, `transcript` holds the full text (~18K chars for a short video; ~50K chars/page for long ones per the live run); pagination via an opaque `next_cursor` param — repeat the call passing the returned cursor until it goes absent/repeats (hard cap ~9 pages) (probed: success shape). **FAILURES return a PLAIN-TEXT error string**, not JSON and not an exception — see Error shapes (probed: observed live) |
| `get_timed_transcript` | Sibling of `get_transcript` | Not probed in this run — verify shape before relying on it |
| `get_available_languages` | Sibling of `get_transcript`; lists available transcript languages | Plain text, e.g. `en ("English (auto-generated)")[TRANSLATABLE]` (probed) |
| `ask_question` | Docs answers for a GitHub repo | **PLAIN-TEXT markdown string** — NOT JSON; never `JSON.parse` (it throws); treat the response as content directly; params: `repoName` (GitHub `owner/repo`, max 10 repos), `question` (probed) |
| `search_issues` | Search GitHub issues (auto `is:issue`) | **JSON string** — `{ incomplete_results, items: [{ number, state, title, html_url, ... }] }`; params: `query` (GitHub issue syntax), `perPage`, `page`, `sort`, `order`, `fields` (e.g. `['number','title','state','html_url']` — trim payloads), `owner`, `repo`; check the parsed `error` key and `incomplete_results` BEFORE reading `.items`; rate limits surface as text/JSON, not exceptions (probed) |
| `issue_read` | Read one known issue (follow-up to a search hit) | **JSON string** — issue detail (body, state, comments); params: `owner`, `repo`, `issue_number`, `method?` (probed) |
| `fetch` | Fetch a doc page | **PLAIN string** — markdown-simplified, prefixed `Contents of <url>:`; params: `url`, `max_length`, `start_index`, `raw`; EVERY fetch probes `robots.txt` FIRST — `'Failed to fetch robots.txt ... connection issue'` means the target is UNREACHABLE, not a content error; never cache failure strings (probed) |
| `write_memory` | Write/replace a memory | Plain text `Memory <name> written.` — check `indexOf('written')`; `max_chars` param is **UNDOCUMENTED** — pass it large (100000+) for cache entries so long content is not truncated (probed for cache use) |
| `list_memories` | List memories, optional `topic` prefix filter | JSON string — `{"memories": ["cache/youtube/<channel>/<slug>_<id>", ...]}`; topic filtering is **prefix-based and case-sensitive** (documented in serena reference) |
| `delete_memory` | Delete one memory | Plain text containing `deleted`, or an error string containing `not found`; this is the reconciliation tool for regenerable cache entries (unlike the filesystem server, serena has delete) (documented in serena reference) |

## Error shapes

Both servers return errors as normal results, not exceptions — check content, do not rely on try/catch alone.

### tavily rate limit (429) — JSON string

```json
{ "error": { "status": 429, "message": "<rate-limit detail>" } }
```

Observed behavior: the call does not throw; `JSON.parse` succeeds and the `"error"` key is present. Check `parsed.error` BEFORE reading `parsed.results` and surface it as a FAIL status line, not a crash.

### YouTube rate limit / transcript unavailable — plain-text string

```
Error executing tool get_transcript:
Could not retrieve a transcript for the video <url>! This is most likely caused by YouTube rate limiting or IP blocking. Please try again later.
```

Observed behavior: returned as a normal string result, NOT JSON and NOT an exception. `JSON.parse` on it throws (`invalid character 'E' looking for beginning of value`). Repeated `get_transcript` calls in quick succession trip this (observed live: the first call for a video succeeded, the immediate retry returned the error). Check `indexOf('Error executing tool get_transcript') === 0` BEFORE treating a page as content — never cache the error string.

### deepwiki — plain text, always

`ask_question` returns a plain markdown string — there is no JSON to parse on success; `JSON.parse` throws on it. Guard defensively (empty/error-string checks) before caching; never cache a non-answer.

### GitHub — JSON string with error/incomplete_results

`search_issues` results come back as a JSON string. Check the parsed object for an `"error"` key (rate limit) and `incomplete_results: true` (truncated results) BEFORE reading `.items`. Rate limits surface as text or a JSON error object, not as exceptions.

### fetch — 'Failed to fetch robots.txt' = unreachable host

Every `fetch` call first probes `robots.txt`. `'Failed to fetch robots.txt ... connection issue'` means the target host is unreachable — that is a connectivity result, NOT a content error; surface it as a FAIL status line and never cache it. A successful fetch returns content prefixed `Contents of <url>:` — check the prefix before treating the body as content.

## Common pitfalls

- **JSON vs plain text per tool**: `tavily_search`, `get_video_info`, `get_transcript` (success), `github search_issues`/`issue_read`, and `list_memories` return JSON strings — parse them. `write_memory`, `delete_memory`, `get_available_languages`, `deepwiki ask_question`, and `fetch` return plain text — check substrings/prefixes. `get_transcript` FAILURES return a plain-text error string — `JSON.parse` throws on it, so wrap the parse and fall back to an error-prefix check.
- **Deepwiki is plain text**: `ask_question` returns markdown, never JSON — do NOT `JSON.parse` (throws); treat the response as content directly. Contrast with `get_transcript` (JSON on success) — do not confuse them.
- **fetch robots.txt pre-probe**: every `fetch` probes robots.txt first; `'Failed to fetch robots.txt ... connection issue'` = unreachable host, not a content error — never cache failure strings; a valid page starts with `Contents of <url>:`.
- **GitHub result validation**: parse `search_issues` JSON, then check `error` and `incomplete_results` before reading `.items`; use `fields` to trim payloads; rate limits surface as text/JSON, not exceptions.
- **tavily error key**: a 429 arrives inside the JSON (`"error"` key), not as an HTTP-level exception — check it after parsing, before using `.results`.
- **Transcript error strings**: rate limits, IP bans, and missing transcripts come back as plain-text strings starting `Error executing tool get_transcript` — they look like content unless you check the prefix; a transcript fetch loop must check (or catch the `JSON.parse` throw) before appending to the page list.
- **Opaque cursors**: `next_cursor` values carry no parseable meaning; end-of-pagination is signaled by the cursor going absent or repeating — cap the loop (~9 pages) so a broken cursor cannot fetch forever.
- **`max_chars` undocumented**: not in the documented serena surface — pass it large on cache writes; a small or omitted value may truncate multi-page content silently.
- **Request full content for caching**: `fetch` returns only what fits `max_length` — pass a large value (e.g. 100000) and paginate via `start_index` to capture the whole page; combined with a large `max_chars` on `write_memory`, cache entries hold full content, not truncated excerpts.
- **No cross-call state**: variables do not persist between mcp-exec calls — all loops and aggregation live inside one script per batch.
- **Serena formats**: memory-name case sensitivity, `write_memory` overwrite semantics, and the `read_memory` dual return format are covered in [serena-memory-api.md](./serena-memory-api.md) — reference it, do not re-derive.

Cross-links: pipeline usage and generalized skeleton — [external-content-caching](../recipes/external-content-caching.md); cache-first research pipeline — [research-with-caching](../recipes/research-with-caching.md); serena helpers and return formats — [serena-memory-api.md](./serena-memory-api.md).
