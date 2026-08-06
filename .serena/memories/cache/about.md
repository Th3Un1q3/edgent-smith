# cache

Regenerable cache domain: raw fetched content (e.g., full YouTube transcripts) stored for reference. Not curated knowledge.

## Scope
- Full raw transcripts of YouTube videos, fetched via youtube-transcript get_transcript (paginated, full text) and stored per video under cache/youtube-videos/{channel}/{video_name}_{video_id}.
- Cache entries are machine-fetched and may be overwritten or regenerated at any time.

- cache/deepwiki/{topic-slug}/{question-slug} — deepwiki ask_question raw answers; cache/github/{owner}-{repo}/issue-{id} and search-{query-slug} — issue bodies/search result sets; cache/fetch/{hostname-slug}/{path-slug} — fetched doc pages (markdown).

## Boundaries (out of scope)
- Not curated analysis or summaries; treat entries as raw source material for other tasks.
- Right-size rule waived for cache entries per operator instruction: full transcripts are the point of this cache.

## Related Domains
- `mem:ai-engineering`