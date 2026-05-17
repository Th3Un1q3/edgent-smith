from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

from cli.services.hf_papers import (
    DISCOVER_SEARCHES,
    HfPapersResult,
    fetch_papers,
    format_papers_context,
)


def _make_run_result(stdout: str = "", returncode: int = 0) -> MagicMock:
    return MagicMock(stdout=stdout, stderr="", returncode=returncode)


# ---------------------------------------------------------------------------
# fetch_papers – subprocess calls
# ---------------------------------------------------------------------------


def test_fetch_papers_calls_trending() -> None:
    with patch("subprocess.run", return_value=_make_run_result("trending output")) as mock_run:
        fetch_papers(hf_binary="hf", limit=5)

    calls = [c.args[0] for c in mock_run.call_args_list]
    assert any(
        "hf" in cmd and "papers" in cmd and "ls" in cmd and "--sort=trending" in cmd
        for cmd in calls
    )


def test_fetch_papers_calls_all_searches() -> None:
    with patch("subprocess.run", return_value=_make_run_result("search output")) as mock_run:
        fetch_papers(hf_binary="hf", limit=5)

    called_commands = [c.args[0] for c in mock_run.call_args_list]
    for query in DISCOVER_SEARCHES:
        assert any("hf" in cmd and "search" in cmd and query in cmd for cmd in called_commands), (
            f"Missing search call for query: {query!r}"
        )


def test_fetch_papers_handles_missing_binary() -> None:
    with patch("subprocess.run", side_effect=FileNotFoundError("hf not found")):
        result = fetch_papers(hf_binary="hf")

    assert "[unavailable:" in result.trending
    for query in DISCOVER_SEARCHES:
        assert "[unavailable:" in result.searches[query]


def test_fetch_papers_handles_timeout() -> None:
    with patch(
        "subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd="hf", timeout=30),
    ):
        result = fetch_papers(hf_binary="hf")

    assert "[unavailable:" in result.trending
    for query in DISCOVER_SEARCHES:
        assert "[unavailable:" in result.searches[query]


def test_fetch_papers_handles_nonzero_exit() -> None:
    with patch("subprocess.run", return_value=_make_run_result("error output", returncode=1)):
        result = fetch_papers(hf_binary="hf")

    assert "[error:" in result.trending
    for query in DISCOVER_SEARCHES:
        assert "[error:" in result.searches[query]


def test_fetch_papers_passes_limit_to_trending() -> None:
    with patch("subprocess.run", return_value=_make_run_result("output")) as mock_run:
        fetch_papers(hf_binary="hf", limit=7)

    trending_call = next(c.args[0] for c in mock_run.call_args_list if "ls" in c.args[0])
    assert "--limit=7" in trending_call or "--limit" in trending_call


def test_fetch_papers_returns_hf_papers_result() -> None:
    with patch("subprocess.run", return_value=_make_run_result("output")):
        result = fetch_papers(hf_binary="hf")

    assert isinstance(result, HfPapersResult)
    assert isinstance(result.trending, str)
    assert isinstance(result.searches, dict)
    assert set(result.searches.keys()) == set(DISCOVER_SEARCHES)


# ---------------------------------------------------------------------------
# format_papers_context – output structure
# ---------------------------------------------------------------------------


def test_format_papers_context_has_trending_section() -> None:
    result = HfPapersResult(
        trending="Paper A\nPaper B",
        searches={q: f"result for {q}" for q in DISCOVER_SEARCHES},
    )
    output = format_papers_context(result)
    assert "## Trending papers" in output
    assert "Paper A" in output


def test_format_papers_context_has_all_search_sections() -> None:
    result = HfPapersResult(
        trending="trending",
        searches={q: f"result for {q}" for q in DISCOVER_SEARCHES},
    )
    output = format_papers_context(result)
    for query in DISCOVER_SEARCHES:
        assert f'## Search: "{query}"' in output
        assert f"result for {query}" in output


def test_format_papers_context_separates_sections() -> None:
    result = HfPapersResult(
        trending="trending",
        searches={q: f"result for {q}" for q in DISCOVER_SEARCHES},
    )
    output = format_papers_context(result)
    assert "---" in output


def test_discover_searches_is_non_empty_list_of_strings() -> None:
    assert isinstance(DISCOVER_SEARCHES, list)
    assert len(DISCOVER_SEARCHES) >= 1
    for item in DISCOVER_SEARCHES:
        assert isinstance(item, str)
        assert item.strip() != ""
