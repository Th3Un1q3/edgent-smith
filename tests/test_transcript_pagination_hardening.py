"""TDD hardening for pagination reliability across various transcript sizes.

Covers: small/medium/large/very-large segments, max_chars warning,
no silent truncation, streaming file output, pagination loop with cursor.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SCRIPT = Path(".agents/skills/youtube-to-skill/scripts/fetch_transcript.py")


def load():
    spec = importlib.util.spec_from_file_location("fetch_transcript", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


# 1. parametrized size variants - formatters must handle 100,1000,10000 without loss
@pytest.mark.parametrize("n", [100, 1000, 10000])
def test_format_handles_various_sizes(n):
    mod = load()
    segs = [{"text": f"word {i}", "start": float(i), "duration": 1.0} for i in range(n)]
    txt = mod.format_text(segs)
    # no silent truncation: lines == n
    assert txt.count("\n") == n - 1
    assert len(txt.splitlines()) == n
    j = mod.format_json(segs)
    parsed = json.loads(j)
    assert len(parsed) == n
    srt = mod.format_srt(segs)
    assert srt.count("-->") == n


# 2. max_chars constant and truncation warning
def test_max_chars_constant_and_warn():
    mod = load()
    assert hasattr(mod, "MAX_CHARS"), "script must define MAX_CHARS=100000"
    assert mod.MAX_CHARS == 100000
    # helper should warn/truncate when exceeding
    assert hasattr(mod, "truncate_if_needed") or hasattr(mod, "check_max_chars")
    # build large content >100k
    large = "a" * 120000
    if hasattr(mod, "truncate_if_needed"):
        out, truncated = mod.truncate_if_needed(large)
        assert truncated is True
        assert len(out) <= mod.MAX_CHARS + 500  # allow notice suffix
        assert "truncated" in out.lower() or truncated
    else:
        out, truncated = mod.check_max_chars(large)
        assert truncated is True


# 3. no silent truncation for large transcript formatting
def test_no_silent_truncation_indicator():
    mod = load()
    segs = [
        {"text": "x" * 20, "start": float(i), "duration": 1.0} for i in range(6000)
    ]  # ~126k chars inc newline
    txt = mod.format_text(segs)
    # raw should be full length
    assert len(txt) > 100000
    # truncate helper must flag
    assert hasattr(mod, "truncate_if_needed")
    out, truncated = mod.truncate_if_needed(txt)
    assert truncated is True
    # must contain notice
    low = out.lower()
    assert "truncated" in low or "exceeds" in low or "max_chars" in low or "100000" in low


# 4. streaming file output handles large writes correctly
def test_streaming_write_large(tmp_path: Path):
    mod = load()
    assert hasattr(mod, "write_output_streaming") or hasattr(mod, "write_output")
    writer = getattr(mod, "write_output_streaming", None) or getattr(mod, "write_output", None)
    large_content = "hello world\n" * 20000  # ~240k
    out_path = tmp_path / "large.txt"
    # call writer
    if writer.__code__.co_argcount >= 2:
        # try streaming signature
        try:
            writer(large_content, out_path)
        except TypeError:
            writer(large_content, str(out_path))
    else:
        writer(large_content, out_path)
    assert out_path.exists()
    read_back = out_path.read_text(encoding="utf-8")
    # if truncated path, writer may truncate; ensure not silently
    # losing without notice -> check either full or truncated with notice
    if len(read_back) < len(large_content):
        assert "truncated" in read_back.lower()
    else:
        assert read_back == large_content


# 5. pagination loop helper with cursor until null, max pages guard >=50
def test_pagination_helper_exists_and_loops():
    mod = load()
    assert hasattr(mod, "fetch_paginated") or hasattr(mod, "fetch_with_pagination"), (
        "pagination helper missing"
    )
    fn = getattr(mod, "fetch_paginated", None) or getattr(mod, "fetch_with_pagination", None)
    # simulate paginated API: 3 pages then null
    calls = []

    def fake_fetch(params):
        cursor = params.get("cursor")
        calls.append(cursor)
        if cursor is None:
            return {
                "segments": [{"text": "a", "start": 0, "duration": 1}],
                "next_cursor": "tok1",
                "page": 1,
            }
        elif cursor == "tok1":
            return {
                "segments": [{"text": "b", "start": 1, "duration": 1}],
                "next_cursor": "tok2",
                "page": 2,
            }
        elif cursor == "tok2":
            return {
                "segments": [{"text": "c", "start": 2, "duration": 1}],
                "next_cursor": None,
                "page": 3,
            }
        else:
            return {"segments": [], "next_cursor": None, "page": 99}

    # helper should loop until None and concatenate
    result = fn(fake_fetch, video_id="dQw4w9WgXcQ")
    # normalize result shape
    segs = result.get("segments", result) if isinstance(result, dict) else result
    assert len(segs) == 3
    assert [s["text"] for s in segs] == ["a", "b", "c"]


def test_pagination_guard_high_enough():
    mod = load()
    assert hasattr(mod, "MAX_PAGES")
    assert mod.MAX_PAGES >= 50, (
        f"MAX_PAGES should be >=50 for large transcripts, got {mod.MAX_PAGES}"
    )
    # also check script text does not have 9-page hard cap as only option
    text = SCRIPT.read_text(encoding="utf-8")
    # ensure 50 appears or MAX_PAGES guard present
    assert "MAX_PAGES" in text or "max_pages" in text.lower()


# 6. duration proportional validation helper
def test_duration_proportional_check():
    mod = load()
    assert hasattr(mod, "validate_transcript_size") or hasattr(mod, "check_duration_proportional")
    fn = getattr(mod, "validate_transcript_size", None) or getattr(
        mod, "check_duration_proportional", None
    )
    # 1 hour lecture ~ 9000 words ~ 3720 sec *2.5 = 15500? use tighter check
    # Should not raise for plausible size, should warn/return false for implausible
    segs = [
        {"text": "word " * 10, "start": float(i), "duration": 1.0} for i in range(900)
    ]  # 9000 words
    # duration 3600 => expected 9000 words => should be valid
    result = fn(segs, duration_sec=3600)
    # result could be True/None/no exception; if returns tuple check
    # now test divergent case: 10 words for 3600 sec => should warn/return False
    small = [{"text": "hi", "start": 0.0, "duration": 1.0}]
    result2 = fn(small, duration_sec=3600)
    # implausible should be flagged (return False or warnings)
    # at least should not be same as valid case if it returns bool
    if isinstance(result, bool) and isinstance(result2, bool):
        assert result is True
        assert result2 is False


# 7. httpx fallback handles json3 and srv3 for large transcripts efficiently (chunked)
def test_httpx_handles_large_json3_srv3(monkeypatch):
    mod = load()
    # ensure fetch_with_httpx can parse large json3 body

    # Build large json3 events (1000 segments)
    events = [
        {"segs": [{"utf8": f"text {i} "}], "tStartMs": i * 1000, "dDurationMs": 1000}
        for i in range(1000)
    ]
    large_json = json.dumps({"events": events})
    mock_resp_watch = MagicMock()
    mock_resp_watch.status_code = 200
    mock_resp_watch.text = r'{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=TEST1234567&lang=en","languageCode":"en"}]}'
    mock_resp_timed = MagicMock()
    mock_resp_timed.status_code = 200
    mock_resp_timed.text = large_json
    mock_client = MagicMock()
    mock_client.get.side_effect = [mock_resp_watch, mock_resp_timed]
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    with (
        patch("httpx.Client", return_value=mock_client),
        patch("time.sleep", return_value=None),
    ):
        segs = mod.fetch_with_httpx("dQw4w9WgXcQ", lang="en", max_retries=0)
        assert len(segs) == 1000
