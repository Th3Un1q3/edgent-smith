# cache

Regenerable cache domain: raw fetched content (e.g., full YouTube transcripts) stored for reference. Not curated knowledge.

## Scope
- Full raw transcripts of YouTube videos, fetched via youtube-transcript get_transcript (paginated, full text) and stored per video under cache/youtube-videos/{channel}/{video_name}_{video_id}.
- Cache entries are machine-fetched and may be overwritten or regenerated at any time.
- cache/{source}/{scope}/{descriptor} — full fetched text with a short header (title, url, date, source).
- cache/{source}/{scope} — per-scope harvest snapshots (names only).
- cache/deepwiki/{topic-slug}/{question-slug} — deepwiki ask_question raw answers; cache/github/{owner}-{repo}/issue-{id} and search-{query-slug} — issue bodies/search result sets; cache/fetch/{hostname-slug}/{path-slug} — fetched doc pages (markdown).

## Sources
- tavily: search results (e.g., opencode skill spec search)
- fetch: extracted doc pages (e.g., github farmage/opencode-skills)
- github: repository trees, issue bodies, search result sets (e.g., Th3Un1qu3/.agents search)
- youtube-videos: full transcripts per video under cache/youtube-videos/{channel}/{video_name}_{video_id}
- deepwiki: deepwiki ask_question raw answers

## Boundaries (out of scope)
- Not curated analysis or summaries; treat entries as raw source material for other tasks.
- Interpretations or analysis — this domain stores raw fetched content, not conclusions.
- Sources not listed need an entry before first write.
- Right-size rule waived for cache entries per operator instruction: full transcripts are the point of this cache.

## Related Domains
- `mem:ai-engineering`
