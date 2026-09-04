# Workflow: Create Skill from YouTube Video

Produce Direct and Meta skill drafts from a YouTube transcript.

When to load: when the user provides a YouTube link and asks to create a skill.

Vocabulary: videoId — 11-char YouTube identifier; transcript — timed text with start/duration; segment — timestamped chunk; cursor — pagination token; cache hit — existing file at cache path.
## Prerequisites

- Read [youtube-transcript-api.md](../references/youtube-transcript-api.md) for extraction, flags, pagination.
- Read [analysis-rubric.md](../references/analysis-rubric.md) and [skill-kinds.md](../references/skill-kinds.md) for scoring and kind decision.
- Load [cache-transcript.md](../recipes/cache-transcript.md) for cache path, verify, excerpt.

## Steps
### 1. Extract and Validate URL

Parse link, extract 11-char videoId, strip suffixes (`&t=`, `&list=`, `#t=`).

```python
import re
PATTERN = r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})"
m = re.search(PATTERN, url)
video_id = m.group(1) if m else None
```
Done when: `videoId` matches `^[A-Za-z0-9_-]{11}$`. | Gate: No valid videoId, no Step 2.
### 2. Check Cache First

Probe `cache/youtube/{channel}/{slug}_{videoId}.txt` per [cache-transcript.md](../recipes/cache-transcript.md).

```python
from pathlib import Path
path = Path(f"cache/youtube/{channel}/{slug}_{video_id}.txt")
if path.exists():
    transcript = path.read_text(encoding="utf-8")
```
Done when: cache probe completes; reuse on hit, fetch on miss. | Gate: Do not invoke fetch script on cache hit.
### 3. Fetch via Standalone Script

Invoke deterministic script with `MAX_PAGES=50`, `MAX_CHARS=100000`, per-chunk retry, streaming write, read-back verify, duration check.

```bash
uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --url https://www.youtube.com/watch?v=dQw4w9WgXcQ --format text --output cache/youtube/lex-fridman/how-i-built-x_dQw4w9WgXcQ.txt
# alt: --video-id dQw4w9WgXcQ --lang en --retries 3 --verbose
```

Handle every size without silent truncation:

| Size | Duration | Chars | Pages | Handling |
|------|----------|-------|-------|----------|
| small | <10m | <15k | 1 | single fetch |
| medium | 10-60m | 15k-60k | 1-2 | paginate if cursor present |
| large | 1-2h | 60k-100k | 2-5 | loop cursor, per-chunk retry |
| very large | 2-3h+ | >100k | 5-50 | paginate to 50, stream 8192-char chunks, truncate with notice |

Stream writes, verify byte-for-byte, warn when words diverge >40% from `duration * 2.5`.
Done when: transcript exists, verified via read-back, truncation notice appended if `>100000` chars. | Gate: No verified transcript, no Step 4.
### 4. Analyze via Rubric

Score 5 dimensions (0-2 each) with one verbatim quote ≤30 words + `[MM:SS]` per dimension.

```markdown
| Dimension | Score | Evidence (≤30w + [MM:SS]) | Why |
|---|---|---|---|
| Teachability | 2 | "create conftest, define scoped fixture, inject into tests" [08:21] | Ordered steps |
| Toolability | 1 | "run the codemod to scaffold fixtures" [12:04] | One tool maps |
```
Done when: 5 rows scored, 5 quotes attached, total 0-10 and verdict (Strong Direct 7-10, Meta 5-6, Not skillable 0-4) recorded. | Gate: No 5-dimension table with evidence, no Step 5.
### 5. Draft Both Kinds

Draft Direct and Meta proposals per [skill-kinds.md](../references/skill-kinds.md); name the failure mode each fixes.

```yaml
name: pytest-fixture-builder
description: >
  Fix brittle copy-pasted setup by generating scoped pytest fixtures.
  Use when the user mentions pytest fixtures, conftest, or repeated test setup.
```
Done when: two drafts exist with kebab-case names, trigger-rich descriptions, primary kind flagged via rubric total. | Gate: No two drafts with failure modes, no Step 6.
### 6. Present and Route

Present scored rubric, both drafts, source link, and recommended routing (new skill vs recipe).

```markdown
**Verdict: 8/10 Strong Direct** — primary Direct, secondary Meta
- Direct: .agents/skills/new-direct-skill/
- Meta: .agents/skills/new-meta-skill/
```
Done when: user sees verdict, evidence, both proposals, and next-action choice. | Gate: No user confirmation of routing, do not write skill files.
## Clarification Triggers

Ask the user before proceeding if:
- URL extracts no valid videoId or the link is a playlist.
- Rubric total is 0-4 — confirm recipe/checklist alternative.
- Both kinds tie — ask which primary to scaffold first.

## Acceptance Criteria

- [ ] Valid videoId extracted from watch, youtu.be, embed, or shorts URL.
- [ ] Cache checked before fetch; invocation uses `--url` or `--video-id` with `--format text --output <cache_path>`.
- [ ] Pagination loops cursor to `MAX_PAGES=50`, retries each chunk, streams 8192-char writes, verifies read-back, never truncates silently.
- [ ] Duration word count checked (`words ≈ duration * 2.5`, warn >40% divergence).
- [ ] Rubric scored 0-10 with 5 evidence quotes and verdict recorded.
- [ ] Both Direct and Meta drafts present with failure modes and trigger phrases.
