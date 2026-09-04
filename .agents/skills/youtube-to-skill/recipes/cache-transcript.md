# Recipe: Cache Transcript

Fetch once, write verbatim, return excerpt. Load [youtube-transcript-api.md](../references/youtube-transcript-api.md) and [fetch_transcript.py](../scripts/fetch_transcript.py) for the full contract.

Vocabulary: channel — lowercased normalized uploader name; slug — kebab-cased title truncated to 40 chars; videoId — 11-char YouTube identifier; segment — timestamped text chunk; cursor — opaque pagination token; chunk — single paginated timedtext response.

## Rules

1. **Check cache before fetch** — probe path first; skip script on hit.

```python
from pathlib import Path
path = Path(f"cache/youtube/{channel}/{slug}_{video_id}.txt")
if path.exists():
    return excerpt(path.read_text(encoding="utf-8"))
```

2. **Build path as `cache/youtube/{channel}/{slug}_{id}.txt`** — lowercase channel, slugify title to kebab ≤40 chars, append videoId.

```text
channel="Lex Fridman" -> lex-fridman
title="How I Built X: The Full Story!" -> how-i-built-x-the-full-story
path: cache/youtube/lex-fridman/how-i-built-x-the-full-story_dQw4w9WgXcQ.txt
```

3. **Fetch via standalone script** — invoke `fetch_transcript.py` with `--video-id` or `--url`; capture output file.

```bash
uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --video-id dQw4w9WgXcQ --format text --output cache/youtube/lex-fridman/how-i-built-x_dQw4w9WgXcQ.txt
# alt: --url https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --output /tmp/out.txt
```

4. **Enforce MAX_CHARS=100000 with notice** — truncate text/srt outputs that exceed cap; append notice, never drop silently.

```python
MAX_CHARS = 100_000
if len(output) > MAX_CHARS:
    output = output[:MAX_CHARS] + f"\n\n[truncated: transcript exceeds {MAX_CHARS} chars; showing first {MAX_CHARS} of {len(content)}]"
```

5. **Stream writes in chunks** — write in 8192-char chunks to cap peak memory; parents created automatically.

```python
from pathlib import Path
p = Path(path)
p.parent.mkdir(parents=True, exist_ok=True)
with p.open("w", encoding="utf-8") as f:
    for i in range(0, len(content), 8192):
        f.write(content[i:i+8192])
```

6. **Verify with read-back** — read file after write, byte-compare, fail loud on mismatch.

```python
written = Path(path).read_text(encoding="utf-8")
if written != content:
    raise RuntimeError(f"verify failed: wrote {len(content)} chars, read {len(written)}")
```

7. **Never fabricate on error** — surface script failure and abort; do not write stub or placeholder.

```python
import subprocess
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    raise RuntimeError(r.stderr.strip())  # do not write cache file
```

8. **Surface plain-text errors as-is** — propagate stderr without wrapping; exit codes 2–6 are deterministic.

```python
# exit 2 transcripts disabled, 3 no transcript, 4 unavailable, 5 rate limited, 6 invalid videoId
if result.returncode != 0:
    raise RuntimeError(result.stderr.strip())
```

9. **Validate duration-proportional word count** — expect `words ≈ duration_sec * 2.5`; warn when divergence exceeds 40%.

```python
words = sum(len(s["text"].split()) for s in segments)
expected = duration_sec * 2.5
if expected and abs(words - expected) / expected > 0.4:
    print(f"warn: {words} words vs expected {expected:.0f} for {duration_sec}s", file=sys.stderr)
```

10. **Loop pagination to MAX_PAGES=50 with per-chunk retry** — iterate `cursor` until null; retry each chunk on 429 with exponential backoff.

```python
MAX_PAGES = 50
segments, cursor, pages = [], None, 0
while pages < MAX_PAGES:
    for attempt in range(4):
        try:
            r = fetch_fn({"videoId": video_id} | ({"cursor": cursor} if cursor else {}))
            break
        except Exception as e:
            if "429" in str(e) or "rate limited" in str(e).lower():
                time.sleep((2 ** attempt) * 1.0 + 0.2); continue
            raise
    segments.extend(r["segments"]); cursor = r.get("next_cursor") or r.get("nextCursor"); pages += 1
    if cursor is None: break
```

11. **Return ≤2 KB excerpt, preserve full file** — callers receive excerpt; downstream analysis reads full cache.

```python
def excerpt(text: str) -> str:
    if len(text) <= 2000:
        return text
    return text[:1500] + "\n...\n" + text[-500:]
print(f"cached: {path} ({len(content)} chars)")
return excerpt(content)  # full content stays at path
```

12. **Handle every size without silent truncation** — single fetch for small, paginate for large, truncate-with-notice for very large.

```text
small <10m <15k 1 page | medium 10–60m 15k–60k 1–2 pages | large 1–2h 60k–100k 2–5 pages
very large 2–3h+ >100k 5–50 pages — paginate + MAX_CHARS notice + streaming write
```

## Acceptance Criteria

- Probe returns hit or miss without fetch on hit; path matches `cache/youtube/{channel}/{slug}_{videoId}.txt`.
- Write creates parents, streams 8192-char chunks, and passes read-back byte comparison.
- Output truncates at MAX_CHARS=100000 with notice appended, never silently.
- Pagination loops to MAX_PAGES=50 with per-chunk 429 retry; duration check warns at >40% divergence.
