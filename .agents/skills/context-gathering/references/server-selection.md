# Reference: Server Selection — Defaults, Escalation & Cost

Recipes declare their server sets and tool formats (see [content-fetch-api.md](./content-fetch-api.md),
[serena-memory-api.md](./serena-memory-api.md), [filesystem-server-api.md](./filesystem-server-api.md)).
This reference answers the question those files do not: which server to start with for a
context-gathering need, in what order, and when to escalate. Selection is deliberate, not
discovered per task.

## Start here

For ANY external gathering, in order:

0. **Check cache and memory first** — list `cache/{source}/...` and `researches/{topic}` via
   serena before any external server. Cache-first is the skill default
   ([research-with-caching](../recipes/research-with-caching.md)), and applies
   unchanged to research-only / "do not modify project files" tasks — cache and
    memory writes via serena are not project-file modifications (canonical: [SKILL.md](../SKILL.md) Principles — 'Store research output in memory, not files').
1. **Pick the category default** — the most lightweight server that can do the job, from the
   category heuristics below.
2. **Escalate only on a concrete failure signal** — a documented error shape, an empty or
   insufficient result, or an auth/JS wall. Never escalate speculatively.

## Capability and weight

| Server | Key tools | Can | Cannot | Weight | Documented where |
|---|---|---|---|---|---|
| serena | list_memories, read_memory, write_memory, find_symbol, search_for_pattern | code intelligence; project memory; cache/memory lookup | no external network | L1 local — cheapest | [codebase-exploration](../recipes/codebase-exploration.md), [collect-relevant-memories](../recipes/collect-relevant-memories.md), [serena-memory-api](./serena-memory-api.md) |
| filesystem | read_text_file, search_files_content, directory_tree, write_file (no delete) | raw file access in the 9 allowed dirs; grep-style search | paths outside allowed dirs; no network; no delete | L1 local | [filesystem-access](../recipes/filesystem-access.md), [filesystem-server-api](./filesystem-server-api.md) |
| github | search_issues, issue_read, search_code, get_file_contents, list_issues, pull_request_read | read-only GitHub API: issues, PRs, code, metadata, Actions | no writes; API data only; rate limits surface as JSON error or text | L2 API (rate-limited) | [github-insights](../recipes/github-insights.md), [content-fetch-api](./content-fetch-api.md) |
| deepwiki | ask_question | semantic Q&A over curated repo wiki; plain-text answers | not a general web search; indexes may lag or miss private and new repos | L2 API | [github-insights](../recipes/github-insights.md), [research-with-caching](../recipes/research-with-caching.md) |
| context7 | resolve-library-id, query-docs | structured official docs for libraries; versions; code snippets | catalog only; library ID required; max 3 calls per question | L2 API (call-capped) | [refinement-discovery](../workflows/refinement-discovery.md) — no dedicated recipe yet |
| tavily | tavily_search, tavily_extract, tavily_crawl, tavily_map, tavily_research | real-time web search; URL extraction (advanced handles protected sites and tables); site crawl and map | no raw page control; no auth cookies; API quota (429 as JSON error key) | L3 network API | [external-content-caching](../recipes/external-content-caching.md), [content-fetch-api](./content-fetch-api.md) |
| fetch | fetch | direct public URL fetch; markdown-simplified; paginated via max_length and start_index | no JS rendering; no auth cookies; robots.txt pre-probe reports unreachable hosts | L3 network — cheapest direct fetch | [research-with-caching](../recipes/research-with-caching.md), [content-fetch-api](./content-fetch-api.md) |
| youtube-transcript | get_video_info, get_transcript, get_timed_transcript | YouTube metadata and full paginated transcripts | rate limits and IP bans (plain-text error prefix); no transcripts for some videos | L3 network (rate-limit sensitive) | [external-content-caching](../recipes/external-content-caching.md), [content-fetch-api](./content-fetch-api.md) |
| devtools | list_pages, new_page, evaluate_script, click, wait_for | drives the operator's host Chrome: JS-rendered and authenticated or private content via the operator session; SPA flows; extracted output is private by default (private/ namespace — see Memory Convention) | heaviest; needs an authenticated session; slow; selector drift; never take_snapshot for extraction; bot-alert handling: STOP on alert signals, cache partials privately, never retry; use click-first navigation, paced | L4 heavyweight — last resort | [browser-automation-devtools](../workflows/browser-automation-devtools.md), [devtools-known-issues](./devtools-known-issues.md) |

Activate sandboxes with the recipe's declared minimal server set, never all servers at once;
adding servers later costs a re-activation ([setup](../workflows/setup.md),
[scripting-workflow](../workflows/scripting-workflow.md)).

## Category heuristics

| Need (trigger) | Default server | Escalate when | Next server |
|---|---|---|---|
| Web search / discovery ("find info about X", "search the web") | tavily_search | results insufficient or full content required | refine query, then deepwiki or context7; full content via tavily_extract, then fetch, then devtools |
| Specific public URL ("get the content of this URL") | fetch | robots.txt probe failure (unreachable), empty body, authwall, JS-only page | tavily_extract (advanced depth), then devtools, then STOP and report |
| Authenticated / private / login-walled content | fetch | 403, login wall, or empty body — prove fetch fails, then tavily_extract (advanced) | tavily_extract (advanced), then devtools (operator session); login wall inside devtools → STOP and escalate to operator |
| JS-rendered / SPA (raw HTML insufficient) | fetch (probe) | markup-only or empty DOM — then tavily_extract (advanced) | tavily_extract (advanced), then devtools evaluate_script per browser-automation-devtools |
| GitHub repo / issues / PRs | github API (fields-trimmed) | semantic "how does this work" → deepwiki; known-issue discovery → search_issues; web-only or private-repo view | deepwiki ask_question; cache under cache/github/{owner}-{repo}/search-{slug}; devtools on github.com |
| Library/framework docs (structured) | context7 (resolve-library-id then query-docs) | not in catalog; 3-call cap reached | tavily_search, then fetch, then deepwiki |
| Deep documentation Q&A | deepwiki ask_question | empty or generic answer | tavily_search, then fetch; cross-check with github search_issues |
| Project memory recall / store | serena (list_memories, read_memory; write about-first) | not found; external gap | store-memories recipe; external gap → web-search category |
| Codebase exploration (internal) | serena symbols and patterns | raw file text needed | filesystem read_text_file; if path denied → direct read tool |
| Local file access (workspace) | filesystem (list_allowed_directories first) | path denied | direct read and grep tools; code semantics → serena |
| YouTube transcripts | youtube-transcript (get_video_info, then get_transcript) | rate limit or IP ban (plain-text error prefix) | back off and retry once, then tavily_search alternate source, then devtools (last resort) |
| Research synthesis + caching | cache-first pipeline ([research-with-caching](../recipes/research-with-caching.md) or [external-content-caching](../recipes/external-content-caching.md)) | batch timeout -32001 | split by source; never return raw content to the model |
| No ready-made recipe | refinement-discovery workflow, starting from the closest row above | — | map capabilities via gateway_mcp-find, test individually, capture a recipe |

Rows 12–13 are pipeline and meta exceptions: their default is a workflow or pipeline rather than a single server. Rows 3–4 start with the cheapest probe (fetch) and move the second server into the escalation column.

## Escalation chain

Weight bands, lightest to heaviest:

L1 local (serena, filesystem) → L2 structured APIs (github, deepwiki, context7) → L3 network (tavily, fetch, youtube-transcript) → L4 devtools (operator's Chrome).

**Routing precedence** — three rules settle which routing mechanism wins:
- An explicit operator tool choice OVERRIDES the lightest-first escalation.
- Interactive browser tasks (SPA click-through, pagination, form submission, login-gated flows) are devtools-first — fetch/tavily cannot click or iterate pages; do not force a futile probe sequence.
- Lightest-first applies when the operator has no tool preference and the content is static.

Content-path spine: tavily_search (discovery) → context7 or deepwiki (knowledge) → tavily_extract (URL content) → fetch (public URL) → devtools → STOP.

IF/THEN escalation rules:

- fetch returns "Failed to fetch robots.txt ... connection issue" → host unreachable → try tavily_extract, then devtools, else STOP and report.
- fetch or tavily_extract returns a login wall, 403, or near-empty body → devtools — the only server carrying the operator's session.
- wellfound.com returns 403 on plain `fetch` — devtools is the required path (operator-verified 2026-08-06).
- fetch or tavily_extract returns markup with an empty DOM (SPA) → devtools evaluate_script.
- tavily_extract fails on a URL → fetch, then devtools.
- context7 has no library or hits the call cap → tavily_search, then fetch.
- deepwiki returns an empty or generic answer → tavily_search, then fetch (also stated in [github-insights](../recipes/github-insights.md)).
- github API lacks a view (web-only feature, private-repo web page) or is rate-limited → devtools on github.com.
- youtube-transcript errors on all candidates → tavily_search alternate source, then devtools (last resort).
- Any server returns its documented error shape (tavily 429 error key; get_transcript plain-text prefix; github error or incomplete_results) → surface as a FAIL line, retry once, then escalate. Never cache failure strings.
- **YouTube targets:** default = youtube-transcript MCP server (get_video_info for metadata, then get_transcript for content). If ANY tool (tavily_search, tavily_extract, fetch) fails on a YouTube URL 2×, SWITCH to youtube-transcript — it is the dedicated, consent-wall-free path. Never retry a failing tool more than 2× before switching. Alternatives: tavily_search ↔ youtube-transcript ↔ fetch. **youtube-transcript is for KNOWN video IDs ONLY — it cannot enumerate a channel's videos; for enumeration use yt-dlp flat-playlist, the channel RSS feed, or search+verify (see [recipes/external-content-caching.md](../recipes/external-content-caching.md) HARVEST).**
- **Retry cap (hard):** never attempt the same tool more than 2× total on the same target (URL/video ID) in one session. After 2 failures, STOP, record the target in the persistent retry list (e.g., the catalog memory), and move on. Repeated probes (e.g., get_available_languages, alternate endpoints) are allowed ONLY as cheap existence checks — they do not replace the 2× cap on the failing call (worked example: [truncation-examples.md](./truncation-examples.md) §D — `withRetryCap`).

## Cost note

devtools is the heaviest server: slow, session-coupled, drift-prone. Reach it only when a
lighter server provably cannot deliver — prefer two failed lightweight attempts over an
immediate devtools launch. When in doubt, follow the Start-here rule: cache first, default
server, escalate on a concrete failure only. devtools output is session-derived and private: store it under private/, never in public researches/ or cache/. Inside devtools, follow click-first + paced navigation; an alert terminates the task — no retries.

## Cross-references

- Tool formats and error shapes: [content-fetch-api](./content-fetch-api.md), [serena-memory-api](./serena-memory-api.md), [filesystem-server-api](./filesystem-server-api.md), [devtools-known-issues](./devtools-known-issues.md)
- Recipes that own each server set: [research-with-caching](../recipes/research-with-caching.md), [external-content-caching](../recipes/external-content-caching.md), [github-insights](../recipes/github-insights.md), [codebase-exploration](../recipes/codebase-exploration.md), [filesystem-access](../recipes/filesystem-access.md), [store-memories](../recipes/store-memories.md), [manage-memories](../recipes/manage-memories.md)
- Workflows: [setup](../workflows/setup.md), [scripting-workflow](../workflows/scripting-workflow.md), [browser-automation-devtools](../workflows/browser-automation-devtools.md), [refinement-discovery](../workflows/refinement-discovery.md)
- Memory conventions: [memory-convention](./memory-convention.md); cache domain: `mem:cache/about`

Maintenance: this matrix must be re-verified whenever a server is added to or removed from the gateway catalog (see the docker-mcp-gateway skill's workflows/catalog.md).
