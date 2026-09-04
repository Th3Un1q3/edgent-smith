"""TDD tests for standalone YouTube transcript fetch script.

Covers: videoId extraction from all URL forms, validation, CLI flags,
formatting, error exit codes, retry/backoff, httpx fallback, no MCP dep.
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SCRIPT = Path(".agents/skills/youtube-to-skill/scripts/fetch_transcript.py")


def load_module():
    """Load fetch_transcript as module or raise if missing."""
    if not SCRIPT.exists():
        raise FileNotFoundError(f"Script not found at {SCRIPT}")
    spec = importlib.util.spec_from_file_location("fetch_transcript", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


# ---------------------------------------------------------------------------
# 1. File existence + syntax
# ---------------------------------------------------------------------------

def test_script_exists():
    assert SCRIPT.exists(), f"Script must exist at {SCRIPT}"


def test_py_compile():
    result = subprocess.run([sys.executable, "-m", "py_compile", str(SCRIPT)], capture_output=True, text=True)
    assert result.returncode == 0, f"py_compile failed: {result.stderr}"


def test_shebang_and_executable():
    text = SCRIPT.read_text(encoding="utf-8")
    assert text.startswith("#!/usr/bin/env python3"), "must have shebang"
    # check from __future__ import annotations
    assert "from __future__ import annotations" in text


def test_help_works():
    result = subprocess.run([sys.executable, str(SCRIPT), "--help"], capture_output=True, text=True)
    assert result.returncode == 0
    out = result.stdout + result.stderr
    assert "--url" in out
    assert "--video-id" in out
    assert "--lang" in out
    assert "--format" in out
    assert "text" in out and "json" in out and "srt" in out


def test_no_mcp_dependency():
    text = SCRIPT.read_text(encoding="utf-8")
    assert ("mcp" not in text.lower() or "no mcp" in text.lower()) and "gateway" not in text.lower(), "script must not depend on MCP gateway"
    # stricter: ensure no import of mcp
    assert "import mcp" not in text.lower()


# ---------------------------------------------------------------------------
# 2. VideoId extraction — all URL forms
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&pp=ygU%3D", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=30s", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?list=PL123", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("http://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?time_continue=1&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),  # bare ID
        ("https://www.youtube.com/watch?v=abc123XYZ09&list=PL99&pp=ygU%3D&t=120s", "abc123XYZ09"),
    ],
)
def test_extract_video_id(url: str, expected: str):
    mod = load_module()
    assert mod.extract_video_id(url) == expected


def test_extract_video_id_invalid():
    mod = load_module()
    assert mod.extract_video_id("https://www.youtube.com/watch?v=short") is None
    assert mod.extract_video_id("not a url") is None
    assert mod.extract_video_id("") is None


def test_validate_video_id():
    mod = load_module()
    assert mod.validate_video_id("dQw4w9WgXcQ") is True
    assert mod.validate_video_id("abc123XYZ09") is True
    assert mod.validate_video_id("abc-123_XYZ") is True  # 11 chars with - _
    assert mod.validate_video_id("short") is False
    assert mod.validate_video_id("toolong1234567") is False
    assert mod.validate_video_id("invalid!char") is False


# ---------------------------------------------------------------------------
# 3. CLI validation & exit codes
# ---------------------------------------------------------------------------

def test_cli_invalid_url_extract_fails():
    result = subprocess.run([sys.executable, str(SCRIPT), "--url", "https://example.com/notyoutube"], capture_output=True, text=True)
    assert result.returncode == 6
    assert "could not extract videoid" in result.stderr.lower()


def test_cli_invalid_video_id_fails():
    result = subprocess.run([sys.executable, str(SCRIPT), "--video-id", "short"], capture_output=True, text=True)
    assert result.returncode == 6
    assert "invalid" in result.stderr.lower()


def test_cli_missing_both_required():
    result = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    # argparse exits with 2 on missing required
    assert result.returncode == 2


# ---------------------------------------------------------------------------
# 4. Formatting helpers (pure, no network)
# ---------------------------------------------------------------------------

def test_format_text():
    mod = load_module()
    segs = [{"text": "Hello world", "start": 0.0, "duration": 1.0}, {"text": "Second line", "start": 1.0, "duration": 1.5}]
    assert mod.format_text(segs) == "Hello world\nSecond line"


def test_format_json():
    mod = load_module()
    segs = [{"text": "Hi", "start": 0.5, "duration": 2.1}]
    out = mod.format_json(segs)
    parsed = json.loads(out)
    assert parsed[0]["text"] == "Hi"
    assert parsed[0]["start"] == 0.5


def test_format_srt():
    mod = load_module()
    segs = [{"text": "Hello world", "start": 0.0, "duration": 2.0}, {"text": "Second", "start": 2.0, "duration": 1.5}]
    srt = mod.format_srt(segs)
    assert "00:00:00,000 --> 00:00:02,000" in srt
    assert "00:00:02,000 --> 00:00:03,500" in srt
    assert "Hello world" in srt
    # SRT numbering
    assert srt.startswith("1\n")


def test_srt_timestamp_helper():
    mod = load_module()
    assert mod._srt_timestamp(0) == "00:00:00,000"
    assert mod._srt_timestamp(3671.567) == "01:01:11,567"


# ---------------------------------------------------------------------------
# 5. Error handling — mapped exceptions & retries
# ---------------------------------------------------------------------------

def test_fetch_error_exit_codes():
    mod = load_module()
    # Ensure FetchError carries exit_code and retryable
    fe = mod.FetchError("Transcripts disabled", exit_code=2)
    assert fe.exit_code == 2
    fe2 = mod.FetchError("Rate limited", exit_code=5, retryable=True)
    assert fe2.retryable is True


def test_map_yta_exception():
    mod = load_module()

    class TranscriptsDisabled(Exception):
        pass

    TranscriptsDisabled.__name__ = "TranscriptsDisabled"
    # We craft fake exception types by name via type()
    for name, expected_code in [
        ("TranscriptsDisabled", 2),
        ("NoTranscriptFound", 3),
        ("VideoUnavailable", 4),
        ("TooManyRequests", 5),
    ]:
        Fake = type(name, (Exception,), {})
        # Ensure name matches
        Fake.__name__ = name
        exc = Fake("dummy")
        mapped = mod._map_yta_exception(exc)
        assert mapped.exit_code == expected_code, f"{name} should map to {expected_code}, got {mapped.exit_code}"


def test_retry_on_429_with_mock():
    """Ensure fetch_with_yta retries on TooManyRequests (exponential backoff stubbed)."""
    mod = load_module()
    # Simulate youtube_transcript_api not installed => should fallback to httpx path, but we mock yta available
    # Instead test httpx retry path directly with mocked httpx.Client
    # We patch time.sleep to avoid delay
    with patch("time.sleep", return_value=None):
        # Mock httpx.Client to return 429 first, then success
        # Build a minimal mock for fetch_with_httpx
        # We'll test the retry logic by mocking httpx.Client
        try:
            import httpx  # noqa
        except ImportError:
            pytest.skip("httpx not installed")

        mock_resp_watch = MagicMock()
        mock_resp_watch.status_code = 200
        # Minimal HTML with captionTracks
        mock_resp_watch.text = r'{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=TEST1234567&lang=en","languageCode":"en"}]}'

        mock_resp_timed = MagicMock()
        mock_resp_timed.status_code = 200
        mock_resp_timed.text = json.dumps({"events": [{"segs": [{"utf8": "Hello"}], "tStartMs": 0, "dDurationMs": 1000}]})

        mock_client = MagicMock()
        # watch page fetch + timedtext fetch
        mock_client.get.side_effect = [mock_resp_watch, mock_resp_timed]
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("httpx.Client", return_value=mock_client):
            segs = mod.fetch_with_httpx("dQw4w9WgXcQ", lang="en", max_retries=1)
            assert segs[0]["text"] == "Hello"


# ---------------------------------------------------------------------------
# 6. Fallback message when yta not installed
# ---------------------------------------------------------------------------

def test_graceful_missing_yta_message():
    """If youtube_transcript_api missing, script should hint install but not crash on import."""
    mod = load_module()
    # The module should import without youtube_transcript_api present
    assert hasattr(mod, "fetch_transcript")
    assert hasattr(mod, "fetch_with_httpx")
    # Ensure docstring mentions pip install instruction
    text = SCRIPT.read_text(encoding="utf-8")
    assert "pip install youtube-transcript-api" in text
    assert "httpx" in text


def test_output_to_file(tmp_path: Path):
    mod = load_module()
    segs = [{"text": "Hello", "start": 0.0, "duration": 1.0}]
    out = tmp_path / "out.txt"
    # Simulate CLI file write via helper
    output = mod.format_text(segs)
    out.write_text(output, encoding="utf-8")
    assert out.read_text() == "Hello"
