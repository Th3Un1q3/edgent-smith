from __future__ import annotations

import subprocess
from dataclasses import dataclass, field

__all__ = [
    "DISCOVER_SEARCHES",
    "HfPapersResult",
    "fetch_papers",
    "format_papers_context",
]

DISCOVER_SEARCHES: list[str] = [
    "edge agent",
    "on-device inference",
    "model routing",
    "lightweight evaluator",
    "continual learning",
    "quantization pruning",
    "guardrails safety",
    "agentic system",
]


@dataclass
class HfPapersResult:
    trending: str
    searches: dict[str, str] = field(default_factory=dict)


def _run_hf(args: list[str], hf_binary: str) -> str:
    """Run hf CLI with the given args, returning stdout or an error string."""
    try:
        result = subprocess.run(
            [hf_binary, *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except FileNotFoundError as exc:
        return f"[unavailable: {exc}]"
    except subprocess.TimeoutExpired as exc:
        return f"[unavailable: timeout after {exc.timeout}s]"

    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "non-zero exit"
        return f"[error: exit {result.returncode} – {detail}]"

    return result.stdout


def fetch_papers(hf_binary: str = "hf", limit: int = 20) -> HfPapersResult:
    """Run trending + per-query paper searches and return the combined result."""
    trending = _run_hf(["papers", "ls", "--sort=trending", f"--limit={limit}"], hf_binary)
    searches: dict[str, str] = {}
    for query in DISCOVER_SEARCHES:
        searches[query] = _run_hf(["papers", "search", query, f"--limit={limit}"], hf_binary)
    return HfPapersResult(trending=trending, searches=searches)


def format_papers_context(result: HfPapersResult) -> str:
    """Format an HfPapersResult as a markdown string with one section per search."""
    sections: list[str] = [
        "## Trending papers",
        result.trending,
    ]
    for query, output in result.searches.items():
        sections.append("---")
        sections.append(f'## Search: "{query}"')
        sections.append(output)
    return "\n\n".join(sections)
