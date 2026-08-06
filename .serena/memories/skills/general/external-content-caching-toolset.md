# External Content Caching Toolset

Observed runtime behavior of the content-fetch servers (tavily, youtube-transcript) that differs from or adds to canonical docs, captured during a live full-pipeline run. Canonical API shapes: .agents/skills/context-gathering/references/content-fetch-api.md.

- tavily_search returns a JSON string; on rate limit (429) it returns a JSON object with an "error" key (status 429 detail) instead of throwing — check parsed.error before reading parsed.results.
- get_transcript returns a JSON string on success — {title, transcript, next_cursor?} (~50K chars per page for long videos); FAILURES return plain-text error strings (e.g. "Error executing tool get_transcript: ..."); pagination via an opaque next_cursor param — repeat the call with the returned cursor until it goes absent or repeats; hard-cap the loop (~9 pages).
- YouTube IP bans surface as plain-text error strings ("Error executing tool get_transcript: Could not retrieve a transcript... YouTube is blocking requests from your IP...") — check substrings before treating a page as content.
- write_memory has an UNDOCUMENTED max_chars param — pass it large (100000+) for cache entries so long transcripts are not truncated.
- delete_memory exists on serena and is the reconciliation tool for regenerable cache entries (unlike the filesystem server, which has no delete).

Source: observed output of the live content-caching run (operator-verified). Pipeline recipe: .agents/skills/context-gathering/recipes/external-content-caching.md.