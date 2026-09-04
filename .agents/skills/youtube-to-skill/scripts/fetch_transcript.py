#!/usr/bin/env python3
"""Fetch YouTube transcript — standalone, deterministic, no MCP/API key.

Usage:
  uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --url https://www.youtube.com/watch?v=dQw4w9WgXcQ
  uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --video-id dQw4w9WgXcQ --format json
  uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --url https://youtu.be/dQw4w9WgXcQ --lang en --format srt --output transcript.srt

Requires: youtube-transcript-api (preferred) or httpx fallback (already in dependencies).
  pip install youtube-transcript-api   # or: uv add youtube-transcript-api
  # httpx fallback works without it by scraping captionTracks via timedtext.

Exit codes:
  0 success, 1 invalid args/generic, 2 transcripts disabled, 3 no transcript,
  4 video unavailable/private, 5 rate limited (after retries), 6 invalid videoId
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import html as html_lib
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# VideoId extraction — all YouTube URL forms
# ---------------------------------------------------------------------------

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

_PATH_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.|m\.)?youtu\.be/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"),
    re.compile(r"(?:https?://)?(?:www\.|m\.)?youtube\.com/embed/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"),
    re.compile(r"(?:https?://)?(?:www\.|m\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"),
    re.compile(r"(?:https?://)?(?:www\.|m\.)?youtube\.com/v/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"),
    re.compile(r"(?:https?://)?(?:www\.|m\.)?youtube-nocookie\.com/embed/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"),
]


def validate_video_id(video_id: str) -> bool:
    return bool(VIDEO_ID_RE.match(video_id))


def extract_video_id(url: str) -> str | None:
    """Extract 11-char videoId from any YouTube URL. Returns None if not found.

    Handles: watch?v=, youtu.be/, embed/, shorts/, m.youtube.com,
    youtube-nocookie, with &t=, &list=, &pp=, #t= stripped.
    """
    url = url.strip()
    if not url:
        return None
    if validate_video_id(url):
        return url
    for pat in _PATH_PATTERNS:
        m = pat.search(url)
        if m and validate_video_id(m.group(1)):
            return m.group(1)
    parse_target = url if "://" in url else f"https://{url}" if url.startswith("youtu") or url.startswith("www.") else url
    try:
        parsed = urlparse(parse_target)
        qs = parse_qs(parsed.query)
        candidates = qs.get("v", [])
        for cand in candidates:
            # Require exact 11-char match — do NOT truncate longer candidates
            if validate_video_id(cand):
                return cand
        path_parts = parsed.path.strip("/").split("/")
        for part in path_parts:
            part = part.split("?")[0].split("&")[0].split("#")[0]
            if validate_video_id(part):
                return part
    except Exception:
        pass
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])", url)
    if m and validate_video_id(m.group(1)):
        return m.group(1)
    m = re.search(r"youtube\.com/watch\?v=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])", url)
    if m and validate_video_id(m.group(1)):
        return m.group(1)
    return None


# ---------------------------------------------------------------------------
# Helpers: formatting
# ---------------------------------------------------------------------------

def _srt_timestamp(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    hours, ms = divmod(ms, 3600_000)
    minutes, ms = divmod(ms, 60_000)
    secs, ms = divmod(ms, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"


def format_text(segments: list[dict[str, Any]]) -> str:
    return "\n".join(s["text"] for s in segments)


def format_json(segments: list[dict[str, Any]]) -> str:
    return json.dumps(segments, ensure_ascii=False, indent=2)


def format_srt(segments: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for i, seg in enumerate(segments, 1):
        start = float(seg.get("start", 0))
        duration = float(seg.get("duration", 0))
        end = start + duration if duration else start + 2.0
        text = seg.get("text", "").strip()
        lines.append(str(i))
        lines.append(f"{_srt_timestamp(start)} --> {_srt_timestamp(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Size & truncation helpers — reliable handling for various transcript sizes
# ---------------------------------------------------------------------------

MAX_CHARS = 100_000
MAX_PAGES = 50  # high enough for 3h podcast (~50 pages * 2k tokens/page); guards infinite loop


def truncate_if_needed(content: str, max_chars: int = MAX_CHARS) -> tuple[str, bool]:
    """Return (content, truncated). If len > max_chars, truncate and append notice.

    Memory-efficient: slices once, notice appended without duplicating huge string twice.
    Caller should warn if truncated.
    """
    if len(content) <= max_chars:
        return content, False
    notice = f"\n\n[truncated: transcript exceeds {max_chars} chars; showing first {max_chars} of {len(content)}]"
    # keep max_chars, then notice (total slightly over max to preserve notice)
    return content[:max_chars] + notice, True


# compat alias for older tests
def check_max_chars(content: str, max_chars: int = MAX_CHARS) -> tuple[str, bool]:
    return truncate_if_needed(content, max_chars)


def validate_transcript_size(segments: list[dict[str, Any]], duration_sec: int | float | None = None) -> bool:
    """Proportional check: words ≈ duration_sec * 2.5; warn if divergence >40%.

    Returns True if plausible, False if divergent, True if duration unknown.
    No silent truncation — prints warning to stderr when divergent.
    """
    if duration_sec is None or duration_sec <= 0:
        return True
    total_words = sum(len(s.get("text", "").split()) for s in segments)
    expected = float(duration_sec) * 2.5
    if expected == 0:
        return True
    divergence = abs(total_words - expected) / expected
    if divergence > 0.4:
        print(
            f"Warning: transcript word count {total_words} diverges from expected {expected:.0f} "
            f"for {duration_sec:.0f}s (divergence {divergence:.0%})",
            file=sys.stderr,
        )
        return False
    return True


# compat alias
def check_duration_proportional(segments: list[dict[str, Any]], duration_sec: int | float | None = None) -> bool:
    return validate_transcript_size(segments, duration_sec)


def write_output_streaming(content: str, path: str | Path, chunk_size: int = 8192) -> None:
    """Memory-efficient streaming write: writes in chunks, verifies read-back.

    Handles large transcripts (>100k) without holding duplicate huge buffers.
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    # streaming write in chunks to limit peak memory
    with p.open("w", encoding="utf-8") as f:
        for i in range(0, len(content), chunk_size):
            f.write(content[i : i + chunk_size])
    # verify
    written = p.read_text(encoding="utf-8")
    if written != content:
        raise RuntimeError(f"verify failed: wrote {len(content)} chars, read {len(written)}")


def write_output(content: str, path: str | Path) -> None:
    """Alias for streaming write (keeps memory efficient)."""
    return write_output_streaming(content, path)


def fetch_paginated(fetch_fn: Any, video_id: str, max_pages: int = MAX_PAGES, max_retries: int = 3) -> list[dict[str, Any]]:
    """Generic pagination loop: cursor until null, per-chunk retry, guard at MAX_PAGES.

    fetch_fn: callable taking dict {"videoId": ..., "cursor": ...?} -> dict with
              {"segments": [...], "next_cursor": str|None} or plain list.
    Handles both json3 chunked timedtext and legacy MCP get_transcript pagination.
    """
    segments: list[dict[str, Any]] = []
    cursor: str | None = None
    pages = 0
    while pages < max_pages:
        params: dict[str, Any] = {"videoId": video_id}
        if cursor is not None:
            params["cursor"] = cursor
        # per-chunk retry
        last_exc: Exception | None = None
        result: Any = None
        for attempt in range(max_retries + 1):
            try:
                result = fetch_fn(params)
                break
            except Exception as e:
                last_exc = e
                msg = str(e).lower()
                retryable = "rate limited" in msg or "429" in msg or "too many" in msg
                if retryable and attempt < max_retries:
                    time.sleep((2**attempt) * 1.0 + 0.2)
                    continue
                if "invalid cursor" in msg:
                    cursor = None
                    # restart from beginning; still counts as retry
                    if attempt < max_retries:
                        time.sleep(0.5)
                        continue
                raise
        else:
            if last_exc is not None:
                raise last_exc
        # normalize result
        if isinstance(result, str):
            raise FetchError(result, exit_code=1)
        if isinstance(result, list):
            # plain list of segments, assume terminal page
            segments.extend(result)
            break
        if isinstance(result, dict):
            segs = result.get("segments", [])
            if isinstance(segs, list):
                segments.extend(segs)
            # support multiple cursor field names
            cursor = result.get("next_cursor")
            if cursor is None:
                cursor = result.get("nextCursor")
            if cursor is None:
                cursor = result.get("cursor")
            # also support continuation token nesting
            if cursor is None and "continuation" in result:
                cursor = result.get("continuation")
            pages += 1
            if cursor is None:
                break
            continue
        # unknown shape: stop
        break
    return segments


# compat alias
def fetch_with_pagination(fetch_fn: Any, video_id: str, max_pages: int = MAX_PAGES) -> list[dict[str, Any]]:
    return fetch_paginated(fetch_fn, video_id, max_pages=max_pages)


# ---------------------------------------------------------------------------
# youtube-transcript-api fetch with compatibility + fallback chain
# ---------------------------------------------------------------------------

class FetchError(Exception):
    def __init__(self, message: str, exit_code: int, retryable: bool = False) -> None:
        super().__init__(message)
        self.exit_code = exit_code
        self.retryable = retryable


def _map_yta_exception(exc: Exception) -> FetchError:
    name = type(exc).__name__
    msg = str(exc) or name
    low = msg.lower()
    if "TranscriptsDisabled" in name:
        return FetchError(f"Transcripts disabled: {msg}", exit_code=2)
    if "NoTranscriptFound" in name:
        return FetchError(f"No transcript found: {msg}", exit_code=3)
    if "VideoUnavailable" in name:
        return FetchError(f"Video unavailable: {msg}", exit_code=4)
    if "TooManyRequests" in name:
        return FetchError(f"Rate limited: {msg}", exit_code=5, retryable=True)
    if "RequestBlocked" in name:
        return FetchError(f"Request blocked: {msg}", exit_code=5, retryable=True)
    if "YouTubeRequestFailed" in name:
        if "429" in msg or "too many" in low or "blocked" in low or "rate limited" in low:
            return FetchError(f"Rate limited: {msg}", exit_code=5, retryable=True)
    if "transcript disabled" in low:
        return FetchError(f"Transcripts disabled: {msg}", exit_code=2)
    if "no transcript" in low:
        return FetchError(f"No transcript found: {msg}", exit_code=3)
    if "video unavailable" in low or "private" in low or "not found" in low:
        return FetchError(f"Video unavailable: {msg}", exit_code=4)
    if "too many requests" in low or "429" in msg or "rate limited" in low:
        return FetchError(f"Rate limited: {msg}", exit_code=5, retryable=True)
    return FetchError(msg, exit_code=1)


def _normalize_segments(raw: Any) -> list[dict[str, Any]]:
    """Normalize various yta return shapes to list[{text, start, duration}]."""
    segments: list[dict[str, Any]] = []
    if hasattr(raw, "__iter__") and not isinstance(raw, (str, bytes, dict)):
        for item in raw:  # type: ignore
            if isinstance(item, dict):
                segments.append({
                    "text": item.get("text", ""),
                    "start": float(item.get("start", 0)),
                    "duration": float(item.get("duration", 0)),
                })
            else:
                segments.append({
                    "text": getattr(item, "text", str(item)),
                    "start": float(getattr(item, "start", 0)),
                    "duration": float(getattr(item, "duration", 0)),
                })
        return segments
    if hasattr(raw, "snippets"):
        return _normalize_segments(getattr(raw, "snippets"))
    if isinstance(raw, dict) and "segments" in raw:
        return _normalize_segments(raw["segments"])
    return segments


def fetch_with_yta(video_id: str, lang: str, max_retries: int = 3) -> list[dict[str, Any]]:
    """Fetch via youtube-transcript-api with manual→auto→translate fallback."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    except ImportError as e:
        raise FetchError(
            "youtube-transcript-api not installed. Install with: pip install youtube-transcript-api  "
            "or: uv add youtube-transcript-api  (httpx fallback will be tried if this fails)",
            exit_code=1,
        ) from e

    def _try_fetch(languages: list[str]) -> list[dict[str, Any]] | None:
        last_exc: Exception | None = None
        try:
            api_instance = YouTubeTranscriptApi()  # type: ignore[call-arg]
            if hasattr(api_instance, "fetch"):
                raw = api_instance.fetch(video_id, languages=languages)  # type: ignore
                segs = _normalize_segments(raw)
                if segs is not None:
                    if len(segs) > 0:
                        return segs
                    raise FetchError(f"No transcript found for video {video_id} (lang={languages})", exit_code=3)
        except Exception as e:
            last_exc = e
            mapped = _map_yta_exception(e)
            if mapped.exit_code in (2, 4, 5) or mapped.retryable:
                raise mapped from e
        try:
            if hasattr(YouTubeTranscriptApi, "fetch") and callable(getattr(YouTubeTranscriptApi, "fetch")):
                raw = YouTubeTranscriptApi.fetch(video_id, languages=languages)  # type: ignore
                segs = _normalize_segments(raw)
                if segs is not None:
                    if len(segs) > 0:
                        return segs
                    raise FetchError(f"No transcript found for video {video_id} (lang={languages})", exit_code=3)
        except Exception as e:
            last_exc = e
            mapped = _map_yta_exception(e)
            if mapped.exit_code in (2, 4, 5) or mapped.retryable:
                raise mapped from e
        try:
            if hasattr(YouTubeTranscriptApi, "get_transcript"):
                raw = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)  # type: ignore
                segs = _normalize_segments(raw)
                if segs is not None:
                    if len(segs) > 0:
                        return segs
                    raise FetchError(f"No transcript found for video {video_id} (lang={languages})", exit_code=3)
        except Exception as e:
            last_exc = e
            mapped = _map_yta_exception(e)
            if mapped.exit_code in (2, 4, 5) or mapped.retryable:
                raise mapped from e
        try:
            transcript_list = None
            api_instance2 = YouTubeTranscriptApi()  # type: ignore[call-arg]
            if hasattr(api_instance2, "list"):
                transcript_list = api_instance2.list(video_id)  # type: ignore
            elif hasattr(YouTubeTranscriptApi, "list_transcripts"):
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)  # type: ignore
            elif hasattr(YouTubeTranscriptApi, "list"):
                transcript_list = YouTubeTranscriptApi.list(video_id)  # type: ignore
            if transcript_list is not None:
                for method_name in ("find_transcript", "find_generated_transcript"):
                    try:
                        if hasattr(transcript_list, method_name):
                            t = getattr(transcript_list, method_name)(languages)
                            raw = t.fetch()  # type: ignore
                            segs = _normalize_segments(raw)
                            if segs is not None:
                                if len(segs) > 0:
                                    return segs
                                raise FetchError(f"No transcript found for video {video_id} (lang={languages})", exit_code=3)
                    except FetchError:
                        raise
                    except Exception:
                        continue
                try:
                    first = None
                    for tr in transcript_list:  # type: ignore
                        first = tr
                        break
                    if first is not None and hasattr(first, "translate"):
                        translated = first.translate(lang)  # type: ignore
                        raw = translated.fetch()  # type: ignore
                        segs = _normalize_segments(raw)
                        if segs is not None:
                            if len(segs) > 0:
                                return segs
                            raise FetchError(f"No transcript found for video {video_id} (lang={languages})", exit_code=3)
                except Exception as e2:
                    last_exc = e2
        except Exception as e:
            last_exc = e
            mapped = _map_yta_exception(e)
            if mapped.exit_code in (2, 4, 5) or mapped.retryable:
                raise mapped from e
        if last_exc is not None:
            raise _map_yta_exception(last_exc) from last_exc
        return None

    attempts: list[list[str]] = [
        [lang],
        [lang, "en"],
        ["en"],
        ["en-US", "en-GB", "en"],
    ]
    last_error: FetchError | None = None
    for langs in attempts:
        for attempt in range(max_retries + 1):
            try:
                result = _try_fetch(langs)
                if result is not None:
                    if len(result) > 0:
                        return result
                    raise FetchError(f"No transcript found for video {video_id} (lang={langs})", exit_code=3)
                break
            except FetchError as fe:
                last_error = fe
                if fe.retryable and attempt < max_retries:
                    delay = (2**attempt) * 1.0 + 0.5
                    time.sleep(delay)
                    continue
                if fe.exit_code == 3:
                    break
                raise
            except Exception as e:
                last_error = _map_yta_exception(e)
                if last_error.retryable and attempt < max_retries:
                    delay = (2**attempt) * 1.0
                    time.sleep(delay)
                    continue
                if last_error.exit_code == 3:
                    break
                raise last_error from e
    if last_error is not None:
        raise last_error
    raise FetchError(f"No transcript found for video {video_id} (lang={lang})", exit_code=3)


def _extract_balanced_json_str(text: str, key: str, open_ch: str, close_ch: str) -> str | None:
    """Extract balanced JSON array/object after key using bracket counting.

    Handles quoted strings with escapes, so baseUrl with special chars like
    `]` inside strings does not truncate. Returns substring including brackets
    or None if not found.
    """
    idx = text.find(key)
    if idx == -1:
        return None
    start = text.find(open_ch, idx + len(key))
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def _extract_caption_tracks_array(html: str) -> str | None:
    """Extract full captionTracks JSON array via balanced parsing."""
    return _extract_balanced_json_str(html, '"captionTracks"', "[", "]")


def _extract_yt_initial_player_response(html: str) -> str | None:
    """Extract ytInitialPlayerResponse JSON object via balanced parsing."""
    # Try `ytInitialPlayerResponse = {...};` form
    key = "ytInitialPlayerResponse"
    idx = html.find(key)
    if idx != -1:
        # find first '{' after key
        s = _extract_balanced_json_str(html[idx:], key, "{", "}")
        # _extract_balanced_json_str expects key inside substring; adjust
        if s:
            return s
        # fallback: find '{' directly
        start = html.find("{", idx)
        if start != -1:
            raw = _extract_balanced_json_str(html, html[idx:start+1], "{", "}")
            if raw:
                return raw
    # Fallback: extract captions object containing captionTracks
    return _extract_balanced_json_str(html, '"captions"', "{", "}")


# ---------------------------------------------------------------------------
# httpx fallback — direct timedtext scraping (no API key, pure HTTP)
# ---------------------------------------------------------------------------

def fetch_with_httpx(video_id: str, lang: str = "en", max_retries: int = 3) -> list[dict[str, Any]]:
    """Fallback via httpx: scrape captionTracks from watch page, fetch timedtext."""
    try:
        import httpx  # type: ignore
    except ImportError as e:
        raise FetchError(
            "httpx not installed and youtube-transcript-api unavailable. Install one of:\n"
            "  pip install youtube-transcript-api\n"
            "  pip install httpx  (fallback)",
            exit_code=1,
        ) from e

    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(headers=headers, timeout=15.0, follow_redirects=True) as client:
                resp = client.get(f"https://www.youtube.com/watch?v={video_id}")
                if resp.status_code == 429:
                    raise FetchError("Rate limited (HTTP 429) on watch page", exit_code=5, retryable=True)
                if resp.status_code in (404, 410):
                    raise FetchError(f"Video unavailable (HTTP {resp.status_code})", exit_code=4)
                if resp.status_code != 200:
                    raise FetchError(f"Failed to fetch watch page: HTTP {resp.status_code}", exit_code=1)
                html = resp.text
                low_html = html.lower()
                if "transcript" not in low_html and ("video unavailable" in low_html or "private video" in low_html):
                    if "captiontracks" not in low_html:
                        raise FetchError(f"Video unavailable or private: {video_id}", exit_code=4)
                caption_tracks: list[dict[str, Any]] | None = None
                # Robust balanced parsing — avoids truncation at first ']' inside baseUrl
                json_str = _extract_caption_tracks_array(html)
                if json_str:
                    try:
                        caption_tracks = json.loads(json_str)
                    except json.JSONDecodeError:
                        try:
                            caption_tracks = json.loads(html_lib.unescape(json_str))
                        except Exception:
                            caption_tracks = None
                if caption_tracks is None:
                    # Prefer ytInitialPlayerResponse JSON extraction (more reliable)
                    ypr_json = _extract_yt_initial_player_response(html)
                    if ypr_json:
                        try:
                            data = json.loads(ypr_json)
                            # ypr may be full player response; drill to captions
                            captions = data.get("captions", data)
                            renderer = captions.get("playerCaptionsTracklistRenderer", captions)
                            caption_tracks = renderer.get("captionTracks")
                            # If ypr was just captions object, above still works
                            if caption_tracks is None and "captionTracks" in data:
                                caption_tracks = data.get("captionTracks")
                        except Exception:
                            pass
                    # Fallback: try captions object directly via balanced parse
                    if caption_tracks is None:
                        cap_json = _extract_balanced_json_str(html, '"captions"', "{", "}")
                        if cap_json:
                            try:
                                data = json.loads(cap_json)
                                captions = data.get("captions", data)
                                renderer = captions.get("playerCaptionsTracklistRenderer", captions)
                                caption_tracks = renderer.get("captionTracks")
                            except Exception:
                                pass
                if not caption_tracks:
                    raise FetchError(f"No transcript found (no captionTracks): {video_id}", exit_code=3)

                def _pick_track(tracks: list[dict[str, Any]], target: str) -> dict[str, Any] | None:
                    for t in tracks:
                        if t.get("languageCode") == target:
                            return t
                    for t in tracks:
                        lc = t.get("languageCode", "")
                        if lc.startswith(target) or target.startswith(lc):
                            return t
                    for t in tracks:
                        if t.get("kind") == "asr" and t.get("languageCode", "").startswith(target[:2]):
                            return t
                    for t in tracks:
                        if t.get("languageCode", "").startswith("en"):
                            return t
                    return tracks[0] if tracks else None

                track = _pick_track(caption_tracks, lang)
                if not track:
                    raise FetchError(f"No transcript found for lang {lang}", exit_code=3)
                base_url: str = track.get("baseUrl", "")
                if not base_url:
                    raise FetchError("captionTracks entry missing baseUrl", exit_code=3)
                for fmt in ("json3", "srv3"):
                    # Chunked pagination loop for timedtext: YouTube returns full transcript in one
                    # response for normal videos, but we handle chunked continuation if present
                    # (json3 may contain nextCursor/continuation for very large 3h+ podcasts).
                    # Per-chunk retry and MAX_PAGES guard ensure reliability for various sizes.
                    all_segments: list[dict[str, Any]] = []
                    cursor: str | None = None
                    pages = 0
                    queued_format_success = False
                    while pages < MAX_PAGES:
                        fetch_url = base_url + f"&fmt={fmt}" if "&fmt=" not in base_url else base_url
                        if "&fmt=" in fetch_url:
                            fetch_url = re.sub(r"&fmt=[^&]+", f"&fmt={fmt}", fetch_url)
                        else:
                            fetch_url = fetch_url + f"&fmt={fmt}"
                        # append cursor/seq for chunked continuation if present
                        if cursor:
                            # timedtext chunk continuation: try &seq or &cursor param
                            if "seq=" in fetch_url:
                                fetch_url = re.sub(r"seq=[^&]+", f"seq={cursor}", fetch_url)
                            elif "cursor=" in fetch_url:
                                fetch_url = re.sub(r"cursor=[^&]+", f"cursor={cursor}", fetch_url)
                            else:
                                fetch_url = fetch_url + f"&cursor={cursor}"
                        # per-chunk retry for 429/timeouts
                        chunk_resp = None
                        for chunk_attempt in range(max_retries + 1):
                            try:
                                chunk_resp = client.get(fetch_url)
                                if chunk_resp.status_code == 429:
                                    if chunk_attempt < max_retries:
                                        time.sleep((2**chunk_attempt) * 1.0 + 0.2)
                                        continue
                                    raise FetchError("Rate limited on timedtext fetch (429)", exit_code=5, retryable=True)
                                break
                            except FetchError:
                                raise
                            except Exception as e_ch:
                                if chunk_attempt < max_retries:
                                    time.sleep((2**chunk_attempt) * 0.8)
                                    continue
                                raise FetchError(f"timedtext chunk fetch failed: {e_ch}", exit_code=1) from e_ch
                        assert chunk_resp is not None
                        tr_resp = chunk_resp
                        if tr_resp.status_code != 200:
                            break
                        body = tr_resp.text
                        if not body.strip():
                            break
                        if fmt == "json3":
                            try:
                                data = json.loads(body)
                                events = data.get("events", [])
                                chunk_segments: list[dict[str, Any]] = []
                                for ev in events:
                                    if "segs" not in ev:
                                        continue
                                    text = "".join(s.get("utf8", "") for s in ev["segs"]).strip()
                                    if not text:
                                        continue
                                    start = ev.get("tStartMs", 0) / 1000.0
                                    duration = ev.get("dDurationMs", 0) / 1000.0
                                    if text == "\n":
                                        continue
                                    chunk_segments.append({"text": html_lib.unescape(text), "start": start, "duration": duration})
                                if chunk_segments:
                                    all_segments.extend(chunk_segments)
                                    queued_format_success = True
                                # check for chunked continuation (rare for huge transcripts)
                                next_cursor = data.get("nextCursor") or data.get("next_cursor") or data.get("continuation")
                                # also support wire-external: events may include continuation token in last event
                                if next_cursor:
                                    cursor = str(next_cursor)
                                    pages += 1
                                    if pages >= MAX_PAGES:
                                        print(f"Warning: reached MAX_PAGES={MAX_PAGES}, truncating pagination", file=sys.stderr)
                                        break
                                    continue
                                # no continuation => done with this format
                                if all_segments:
                                    return all_segments
                                break
                            except json.JSONDecodeError:
                                break
                        else:
                            try:
                                # ET parsing for srv3 — streaming-friendly for large transcripts
                                # For very large XML (>100k chars) ET.fromstring is okay; paginated chunks stay small.
                                root = ET.fromstring(body)
                                chunk_segments = []
                                for elem in root.findall("text"):
                                    text = html_lib.unescape(elem.text or "")
                                    if not text.strip():
                                        continue
                                    start = float(elem.get("start", "0"))
                                    duration = float(elem.get("dur", "0"))
                                    chunk_segments.append({"text": text, "start": start, "duration": duration})
                                if chunk_segments:
                                    all_segments.extend(chunk_segments)
                                    queued_format_success = True
                                # srv3 rarely paginates; check for continuation attribute
                                next_cursor = root.get("nextCursor") or root.get("next_cursor")
                                if next_cursor:
                                    cursor = str(next_cursor)
                                    pages += 1
                                    continue
                                if all_segments:
                                    return all_segments
                                break
                            except ET.ParseError:
                                break
                        pages += 1
                        if cursor is None:
                            break
                    if queued_format_success and all_segments:
                        return all_segments
                    # try next fmt
                    continue
                raise FetchError(f"No transcript found (timedtext empty) for {video_id}", exit_code=3)
        except FetchError as fe:
            last_exc = fe
            if fe.retryable and attempt < max_retries:
                delay = (2**attempt) * 1.5 + 0.5
                time.sleep(delay)
                continue
            raise
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                delay = (2**attempt) * 1.0
                time.sleep(delay)
                continue
            raise FetchError(f"httpx fallback failed: {e}", exit_code=1) from e
    if last_exc:
        if isinstance(last_exc, FetchError):
            raise last_exc
        raise FetchError(str(last_exc), exit_code=1) from last_exc
    raise FetchError("Unknown httpx fallback error", exit_code=1)


# ---------------------------------------------------------------------------
# Unified fetch with retries and httpx fallback when yta missing
# ---------------------------------------------------------------------------

def fetch_transcript(video_id: str, lang: str = "en", max_retries: int = 3) -> list[dict[str, Any]]:
    """Unified entry: try yta, then httpx fallback if yta not installed or not found."""
    try:
        import importlib.util as _ilu

        if _ilu.find_spec("youtube_transcript_api") is not None:
            try:
                return fetch_with_yta(video_id, lang, max_retries=max_retries)
            except FetchError as fe:
                if fe.exit_code == 3:
                    try:
                        return fetch_with_httpx(video_id, lang, max_retries=max_retries)
                    except FetchError:
                        raise fe from None
                raise
        else:
            return fetch_with_httpx(video_id, lang, max_retries=max_retries)
    except ImportError:
        return fetch_with_httpx(video_id, lang, max_retries=max_retries)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Fetch YouTube transcript — standalone, no MCP, no API key, pure HTTP.",
        epilog=(
            "Examples:\n"
            "  %(prog)s --url https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
            "  %(prog)s --video-id dQw4w9WgXcQ --format json --output transcript.json\n"
            "  %(prog)s --url https://youtu.be/dQw4w9WgXcQ --lang en --format srt\n"
            "\nDependency: pip install youtube-transcript-api  (or uv add youtube-transcript-api)\n"
            "Fallback uses httpx (already in pyproject) to scrape timedtext directly."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--url", help="YouTube URL (any form: watch?v=, youtu.be/, embed/, shorts/, m.youtube.com)")
    g.add_argument("--video-id", dest="video_id", help="11-char YouTube videoId (e.g. dQw4w9WgXcQ)")
    p.add_argument("--lang", default="en", help="Language code, e.g. en, en-US, es (default: en)")
    p.add_argument("--format", dest="fmt", choices=["text", "json", "srt"], default="text", help="Output format (default: text)")
    p.add_argument("--output", "-o", help="Output file path (default: stdout)")
    p.add_argument("--retries", type=int, default=3, help="Max retries for 429/rate-limit (default: 3, exponential backoff)")
    p.add_argument("--verbose", "-v", action="store_true", help="Verbose stderr logging")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    video_id: str | None = None
    if args.url:
        video_id = extract_video_id(args.url)
        if not video_id:
            print(f"error: could not extract videoId from URL: {args.url}", file=sys.stderr)
            print("hint: expected forms: https://www.youtube.com/watch?v=VIDEOID, https://youtu.be/VIDEOID, https://www.youtube.com/embed/VIDEOID, https://www.youtube.com/shorts/VIDEOID", file=sys.stderr)
            return 6
    else:
        video_id = args.video_id.strip() if args.video_id else None
        if not video_id or not validate_video_id(video_id):
            print(f"error: invalid --video-id '{args.video_id}': must be 11 chars [A-Za-z0-9_-]", file=sys.stderr)
            return 6
    assert video_id is not None
    if args.verbose:
        print(f"fetching transcript for videoId={video_id} lang={args.lang} format={args.fmt}", file=sys.stderr)
    try:
        segments = fetch_transcript(video_id, lang=args.lang, max_retries=args.retries)
    except FetchError as fe:
        prefix = {
            2: "Transcripts disabled",
            3: "No transcript found",
            4: "Video unavailable",
            5: "Rate limited",
            6: "Invalid videoId",
        }.get(fe.exit_code, "Error")
        print(f"{prefix}: {fe} (videoId={video_id})", file=sys.stderr)
        if fe.exit_code == 2:
            print("hint: owner disabled captions; try manual notes or ask for captions to be enabled.", file=sys.stderr)
        elif fe.exit_code == 3:
            print(f"hint: no captions for lang '{args.lang}'; try --lang en or check auto-generated captions exist.", file=sys.stderr)
            if "translate" in str(fe).lower():
                print("hint: translation not available for this video/language pair.", file=sys.stderr)
        elif fe.exit_code == 4:
            print("hint: video is private, deleted, or region-blocked.", file=sys.stderr)
        elif fe.exit_code == 5:
            print(f"hint: rate limited after {args.retries} retries; wait and retry with --retries 5.", file=sys.stderr)
        elif "not installed" in str(fe):
            print("hint: install with: pip install youtube-transcript-api  or: uv add youtube-transcript-api", file=sys.stderr)
        return fe.exit_code
    except Exception as e:
        print(f"unexpected error: {e}", file=sys.stderr)
        return 1
    if not segments:
        print(f"No transcript found: empty result for {video_id}", file=sys.stderr)
        return 3
    # size validation vs duration proportional (words ≈ duration*2.5)
    try:
        # estimate duration from max end time for validation (no extra API call)
        est_duration = max((s.get("start", 0) + s.get("duration", 0) for s in segments), default=0)
        validate_transcript_size(segments, duration_sec=est_duration if est_duration > 0 else None)
    except Exception:
        pass
    if args.fmt == "json":
        output = format_json(segments)
        # json handles large without truncation, but warn if exceeds MAX_CHARS
        if len(output) > MAX_CHARS and args.verbose:
            print(f"Warning: transcript output {len(output)} chars exceeds MAX_CHARS={MAX_CHARS} (json not truncated)", file=sys.stderr)
        elif len(output) > MAX_CHARS:
            print(f"Warning: transcript output {len(output)} chars exceeds MAX_CHARS={MAX_CHARS}", file=sys.stderr)
    elif args.fmt == "srt":
        output = format_srt(segments)
        if len(output) > MAX_CHARS:
            output, truncated = truncate_if_needed(output)
            if truncated:
                print(f"Warning: transcript exceeds MAX_CHARS={MAX_CHARS}, truncated with notice", file=sys.stderr)
    else:
        output = format_text(segments)
        if len(output) > MAX_CHARS:
            output, truncated = truncate_if_needed(output)
            if truncated:
                print(f"Warning: transcript exceeds MAX_CHARS={MAX_CHARS}, truncated with notice", file=sys.stderr)
    if args.output:
        out_path = Path(args.output)
        try:
            # streaming write handles large transcripts efficiently (chunked)
            write_output_streaming(output, out_path)
            if args.verbose:
                print(f"wrote {len(output)} chars to {out_path}", file=sys.stderr)
        except OSError as e:
            print(f"error writing output file {out_path}: {e}", file=sys.stderr)
            return 1
        except RuntimeError as e:
            print(f"verify failed for {out_path}: {e}", file=sys.stderr)
            return 1
    else:
        # stdout: also streaming in chunks to avoid double buffering for huge
        chunk = 8192
        for i in range(0, len(output), chunk):
            sys.stdout.write(output[i : i + chunk])
        if not output.endswith("\n"):
            sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
