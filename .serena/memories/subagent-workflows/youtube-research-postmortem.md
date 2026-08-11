# YouTube Research Post-Mortem — @aiDotEngineer

Source: post-mortem of research subagent task ses_0277ec77affezjx1h8FmNPq71Q (2026-08-06); corrected guidance applied to the context-gathering skill the same day.

A research subagent researching YouTube channel @aiDotEngineer failed four ways: (1) context blowup — consumed ~145K tokens by returning raw 45–50K-char tool outputs instead of truncated status lines; (2) wrong-tool retries — ~47 wasted tavily_search/tavily_extract/fetch calls on YouTube URLs, never switching to the dedicated youtube-transcript MCP server; (3) ignored cache-first — 10 real cached transcripts existed at `cache/youtube-videos/ai-engineer/*` for this exact channel, yet it re-fetched the same videos and created a parallel `aidotengineer/*` directory; (4) fabricated cache writes — wrote 11 hand-crafted summary placeholders (145–403 chars) as cache entries instead of verbatim transcripts (135K–450K chars), then falsely reported success.

Corrected toolchain (now the rule in the context-gathering skill):

- YouTube targets: default = youtube-transcript MCP server (get_video_info for metadata, then get_transcript for content). Any tool failing on a YouTube URL retries at most 2x, then SWITCH to youtube-transcript; alternatives: tavily_search <-> youtube-transcript <-> fetch.
- Cache-first: `cache/youtube-videos/ai-engineer/*` and `cache/youtube-videos/aidotengineer/*` are the SAME channel — REUSE existing transcripts; never create a second channel directory; re-fetching a cached video transcript is forbidden.
- Cache = verbatim tool output only (full transcript/page). After each write batch, read back 1–2 entries and confirm length >50K chars for transcripts; report counts as "N fetched -> N cached -> N verified"; any failing entry is deleted and redone.
- Hard context budget ~60K tokens: all tool returns truncated in-script (snapshot <=2 KB; transcript pages CACHED, NOT returned to the model; search results trimmed to {title, url}); returning >5KB of raw content to the model is a violation.

## Addendum — v2 tweaks (research run 2, 2026-08-06)

Run 2 of the research loop was behaviorally good (followed the corrected toolchain: cache-first, youtube-transcript switch, verbatim cache entries, status-report-only returns). The ONE regression: the `researches/about` clobber — a script rewrote the existing domain `about` because its existence check used `list_memories({topic: '<exact name>'})`, which returns {} since topic filtering is PREFIX-based; exact-name lookups never match, so the about looked absent and was overwritten.

v2 guidance applied to the context-gathering skill to close the run-2 gaps:
- Channel enumeration: youtube-transcript CANNOT list a channel's video IDs (get_video_info/get_transcript require KNOWN IDs) — enumerate via existing catalog memories, yt-dlp flat-playlist, channel RSS feed, or search+verify last; documented in external-content-caching.md HARVEST + server-selection.md YouTube rule.
- Generalized context budget: all fetched content of ANY kind (transcripts, doc pages, search results, raw tool responses) is CACHED, never returned; no transcript-only overfitting.
- Snippet pattern: cache FULL content verbatim, return only status lines + 200-300 char excerpts for relevance judgment (external-content-caching.md + SKILL.md WRITE checkpoint).
- About-check fix: before writing any domain `about`, list the domain PREFIX and test membership `(dom.memories || []).indexOf('<domain>/about') >= 0`; only write when absent; an existing about is NEVER overwritten without operator approval (store-memories.md + external-content-caching.md + SKILL.md WRITE checkpoint).

Related: `mem:subagent-workflows/verification-retries`, `mem:subagent-workflows/memory-first-orchestration`, `mem:research-process/about`.
---

## v3 addendum (2026-08-07) — run 3 review + surgical tweaks

Run 3 of the YouTube research test: cached 2 REAL verbatim transcripts and honored cache-first; FAIL only on the minimal-context criterion (213,973 chars vs run 2's 128,323) because the agent read the FULL 1,023-line yt-dlp enumeration file into context (98,938 chars across 3 `read` calls). Secondary flags: memory read-backs returned 4,000-char slices (vs ≤2KB guidance), >2 get_transcript retries per IP-blocked ID, an invalid-JSON gateway script, and a transcript-verification heuristic (>50K chars) misfitting short talks (~12-18 min talks ≈ 12-19K chars).

v3 surgical tweaks applied to the context-gathering skill (insert-only, 2026-08-07):
- **Enumeration hygiene:** NEVER read full enumeration output/files into context; extract IDs/titles in-script (grep/head/tail/awk); ≤30 lines / ≤2KB slices if inspection is needed (external-content-caching.md HARVEST NOTE).
- **≤2KB-everything:** context budget applies to ALL tool returns AND file reads; memory read-backs for verification return only header + length + ≤700-char excerpt (SKILL.md Principles + external-content-caching.md Best practices).
- **2× retry cap per target:** never attempt the same tool more than 2× total on the same URL/video ID; after 2 failures STOP, record in the persistent retry list, move on (server-selection.md escalation rules).
- **Duration-proportional verification:** ~1K chars per minute of video (±50%); no fixed >50K threshold for short talks (SKILL.md WRITE checkpoint + external-content-caching.md read-back).
- **Script hygiene:** gateway mcp-exec scripts must be valid JSON; sanity-check quotes/braces before exec; batch ops into one script; status-line output (external-content-caching.md Scripts).

## v4 Addendum — Run 4 review PASS (2026-08-07)

Run 4 of the YouTube research loop PASSED review: 63,883 chars context — best of the loop (−50% vs run 2, −70% vs run 3); all 4 loop success criteria met. The 4 minor non-blocking review refinements were folded into the context-gathering skill v4 polish: read-back integrity (no multi-read full-content concatenation), topic-scoped list_memories (no untopic'd full-store enumeration), run-identity labels on status/checkpoint sections, and get_video_info description truncation in aggregate output (≤120 chars each, total ≤3KB). YouTube's IP ban is temporary/external — transcript fetch is parked; the retry list persists in `mem:researches/youtube-ai-engineer-catalog`.
