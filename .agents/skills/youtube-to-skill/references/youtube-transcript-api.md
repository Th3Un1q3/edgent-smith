# YouTube Transcript API

Vocabulary: videoId — 11-char YouTube identifier; segment — timestamped chunk with text, start, duration; cursor — opaque pagination token; chunk — single paginated timedtext response.

Run the standalone script to fetch transcripts — deterministic, no API key.

## 1. URL Extraction

Extract the 11-char videoId from any YouTube URL before invoking the script.

```js
/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
```

| Form | Example URL | Capture |
|------|-------------|---------|
| watch | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| youtu.be | `https://youtu.be/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| embed | `https://www.youtube.com/embed/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| shorts | `https://www.youtube.com/shorts/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |

Strip suffixes before extraction: `&t=`, `&list=`, `&pp=`, `#t=30s`, `?t=42`.

```python
import re
PATTERN = r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})"
def extract_video_id(url: str) -> str | None:
    m = re.search(PATTERN, url)
    return m.group(1) if m else None
assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s") == "dQw4w9WgXcQ"
```

## 2. Standalone Script Contract

Invoke the deterministic script via `uv run`; pass URL or videoId, language, format, output, and retry budget.

```bash
uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --url https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format text --output transcript.txt --retries 3
uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --video-id dQw4w9WgXcQ --format json --output transcript.json
```

| Flag | Values | Default | Notes |
|------|--------|---------|-------|
| `--url` | YouTube URL (any form) | — | Mutually exclusive with `--video-id` |
| `--video-id` | 11-char `[A-Za-z0-9_-]` | — | Validated by `VIDEO_ID_RE` |
| `--lang` | `en`, `en-US`, `es` | `en` | Falls back `lang → en` chain |
| `--format` | `text`, `json`, `srt` | `text` | `text` joins with `\n` |
| `--output`, `-o` | file path | stdout | Creates parents; verifies read-back |
| `--retries` | int | `3` | Exponential backoff per chunk |
| `--verbose`, `-v` | flag | off | Logs to stderr |

## 3. Pagination and Size Handling

Loop `cursor` until `null`, guard at `MAX_PAGES=50`, enforce `MAX_CHARS=100000`, retry each chunk, stream writes, and validate duration proportionality. Handles every size without silent truncation.

| Size | Duration | Chars | Pages | Handling |
|------|----------|-------|-------|----------|
| small | <10 min | <15k | 1 | Single fetch |
| large | 1–2 h | 60k–100k | 2–5 | Paginate if `nextCursor` present |
| very large | 2–3 h+ | >100k | 5–50 | Paginate, chunked write, truncate with notice |

Set `MAX_PAGES=50` to cap fetches — covers 3 h podcasts — and `MAX_CHARS=100000` to cap output.

```python
MAX_PAGES = 50
MAX_CHARS = 100000
segments, cursor, pages = [], None, 0
while pages < MAX_PAGES:
    r = fetch_fn({"videoId": video_id} | ({"cursor": cursor} if cursor else {}))
    segments.extend(r["segments"])
    cursor = r.get("next_cursor") or r.get("nextCursor")
    pages += 1
    if cursor is None:
        break
```

Retry each chunk with exponential backoff on 429/rate-limit; reset cursor on invalid token.

```python
for attempt in range(max_retries + 1):
    try:
        r = fetch_fn(params); break
    except Exception as e:
        if "429" in str(e) or "rate limited" in str(e).lower():
            time.sleep((2 ** attempt) * 1.0 + 0.2); continue
        raise
```

Truncate text/srt outputs that exceed `MAX_CHARS`; append notice, never drop silently.

```python
if len(output) > MAX_CHARS:
    output = output[:MAX_CHARS] + f"\n\n[truncated: transcript exceeds {MAX_CHARS} chars]"
```

Stream writes in 8192-char chunks and verify read-back byte-for-byte.

```python
with Path(path).open("w", encoding="utf-8") as f:
    for i in range(0, len(content), 8192):
        f.write(content[i:i+8192])
assert Path(path).read_text(encoding="utf-8") == content
```

Validate word count proportional to duration: `expected = duration_sec * 2.5`; warn when divergence exceeds 40%.

```python
expected = duration_sec * 2.5
actual = sum(len(s["text"].split()) for s in segments)
if abs(actual - expected) / expected > 0.4:
    print(f"Warning: {actual} words vs expected {expected:.0f}", file=sys.stderr)
```

## 4. Fallback Chain

Try `youtube-transcript-api` first; fall back to `httpx` timedtext scraping (`json3` → `srv3`) when the library misses.

```python
try:
    segments = fetch_with_yta(video_id, lang="en")
except FetchError as e:
    if e.exit_code == 3:
        segments = fetch_with_httpx(video_id, lang="en")
```

## 5. Exit Codes and Error Patterns

Map exceptions and HTTP signals to deterministic exit codes; surface hints on stderr.

| Code | Meaning | Trigger |
|------|---------|---------|
| 0 | success | Transcript written |
| 1 | generic / args error | Bad args, unexpected failure |
| 2 | TranscriptsDisabled | Owner disabled captions |
| 3 | NoTranscriptFound | No captions for `lang` |
| 4 | VideoUnavailable | Private, deleted, 404/410 |
| 5 | Rate limited | 429 / TooManyRequests after retries |
| 6 | Invalid videoId | Extraction fails or not 11 chars |

```python
try:
    segments = fetch_transcript(video_id, lang="en", max_retries=3)
except FetchError as e:
    print(f"{e} (exit {e.exit_code})", file=sys.stderr)
    raise SystemExit(e.exit_code)
```

## 6. Caching Hook

Cache the fetched transcript before analysis; delegate persistence to the recipe.

Load [recipes/cache-transcript.md](../recipes/cache-transcript.md) after fetch succeeds; also read [scripts/fetch_transcript.py](../scripts/fetch_transcript.py) for the full contract. The recipe handles `cache/youtube/{videoId}/transcript.json` writes and verification.
