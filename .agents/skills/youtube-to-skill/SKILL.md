---
name: youtube-to-skill
description: >
  Fix video knowledge that evaporates without a reusable skill — turn any YouTube link into a skill.
  Use when the user provides a YouTube URL, YouTube link, youtu.be link, youtube.com/watch, youtube.com/shorts, or youtu.be short link and asks youtube to skill, video to skill, transcript to skill, create skill from video, make skill from YouTube, or analyze video with aspect; also triggers on aspect-focused analysis, direct vs meta skill, direct skill, meta skill, and "summarize video into skill".
  Trigger phrases: "youtube to skill", "video to skill", "transcript to skill", "YouTube link to skill", "create skill from YouTube".
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: "1.0.0 — initial lean router for standalone fetch_transcript.py with pagination reliable for various sizes (MAX_PAGES=50, MAX_CHARS=100k)"
  author: Th3Un1qu3
---

# YouTube-to-Skill

Turn any YouTube video into a reusable skill draft — fetch transcript standalone, analyze against rubric, propose direct and meta variants.

## When to Use This Skill

Invoke this skill when:
- User provides a YouTube URL (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/) and asks to create a skill, convert video to skill, or extract a skill from transcript.
- User asks to analyze a video with an aspect focus (e.g., hook, retention, pedagogy, workflow) before skill creation.
- User says "youtube to skill", "video to skill", "transcript to skill", "YouTube link", "create skill from video", or asks for direct vs meta skill proposals.

## When Not to Use This Skill

Do not use this skill for:
- Requests with no YouTube source — local files, articles, or generic topic research without a video link.
- Requests that want a verbatim summary or transcript only with no skill synthesis.
- Simple Q&A about a video that needs no reusable artifact.

## Principles

- **Cache before fetch:** check cache/youtube/{channel}/{slug}_{videoId}.txt before running any fetch — see [recipes/cache-transcript.md](./recipes/cache-transcript.md).
- **Fetch standalone:** run `uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --url <url>` with --video-id/--format flags; standalone only — see [references/youtube-transcript-api.md](./references/youtube-transcript-api.md).
- **Paginate reliably for various sizes:** exhaust up to MAX_PAGES=50 and MAX_CHARS=100k to handle small to very large transcripts without silent truncation — see [references/youtube-transcript-api.md](./references/youtube-transcript-api.md).
- **Verify every write and cap returns:** read back cache writes and cap tool returns to ≤2KB excerpts while preserving full transcript on disk — see [recipes/cache-transcript.md](./recipes/cache-transcript.md).
- **Propose both kinds:** draft direct and meta variants scored against rubric before choosing — see [references/skill-kinds.md](./references/skill-kinds.md) and [references/analysis-rubric.md](./references/analysis-rubric.md).

## Workflow Skeleton

Validate URL → check cache → fetch standalone paginated → analyze with aspect → draft direct and meta → verify, cache, and report.

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Create a skill from a YouTube video (full 6-step flow) | [workflows/create-from-video.md](./workflows/create-from-video.md) |
| Analyze a video with an aspect focus before drafting | [workflows/analyze-aspect.md](./workflows/analyze-aspect.md) |
| Look up standalone fetch flags, pagination, and errors | [references/youtube-transcript-api.md](./references/youtube-transcript-api.md) |
| Choose direct vs meta skill kind | [references/skill-kinds.md](./references/skill-kinds.md) |
| Score transcript against rubric | [references/analysis-rubric.md](./references/analysis-rubric.md) |
| Cache transcript, verify writes, and excerpt returns | [recipes/cache-transcript.md](./recipes/cache-transcript.md) |
| Fetch transcript standalone | [scripts/fetch_transcript.py](./scripts/fetch_transcript.py) |

Shared audit tooling lives in `agent_utils/scripts/` — `audit_fences.py` and `validate_md_links.py` — as single source per Rule 24. Do not copy into per-skill `scripts/` (Rule 8 exception).

## Related Skills

- `context-gathering` — cache external knowledge and ground research; this skill delegates only transient caching here.
- `building-modular-skills` — lean router, routing completeness, and shaping rules for this skill's structure.
- `skill-creator` — draft, test, and iterate the proposed skill once this skill produces the initial spec.
