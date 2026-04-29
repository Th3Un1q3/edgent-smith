#!/usr/bin/env python3
from __future__ import annotations

import os
import time
from urllib.parse import urlparse, urlunparse

import httpx


def _build_ollama_root_url(base_url: str | None) -> str:
    # Accept None and fall back to the same default used by get_ollama_status.
    base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://ollama:11434/v1")
    parsed = urlparse(base_url)
    # Ensure we operate on and return plain str to satisfy type checkers.
    path = str(parsed.path).rstrip("/")
    if path.endswith("/v1"):
        path = ""
    # Build a normalized components tuple to avoid ParseResult type ambiguities
    normalized_parts = (
        str(parsed.scheme),
        str(parsed.netloc),
        path,
        str(parsed.params),
        "",
        "",
    )
    return urlunparse(normalized_parts).rstrip("/")


def get_ollama_status(base_url: str | None = None) -> tuple[str, float | None]:
    base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://ollama:11434/v1")
    root_url = _build_ollama_root_url(base_url)
    status_url = f"{root_url}/api/status"
    ps_url = f"{root_url}/api/ps"

    start = time.monotonic()
    try:
        status_resp = httpx.get(status_url, timeout=3.0)
        latency = time.monotonic() - start
        if status_resp.status_code != 200:
            return f"unhealthy (HTTP {status_resp.status_code})", latency
    except Exception as exc:
        return f"unreachable ({exc})", None

    try:
        ps_resp = httpx.get(ps_url, timeout=3.0)
        if ps_resp.status_code != 200:
            return (
                (
                    f"reachable, latency {latency * 1000:.0f}ms, "
                    f"/api/ps unavailable (HTTP {ps_resp.status_code})"
                ),
                latency,
            )
        payload = ps_resp.json()
        models = payload.get("models") if isinstance(payload, dict) else None
        if not models:
            return f"reachable, latency {latency * 1000:.0f}ms, no models loaded (idle)", latency
        names = [m.get("name") or m.get("model") or "unknown" for m in models[:3]]
        summary = ", ".join(names)
        suffix = "warm"
        if len(models) > 3:
            summary += f" (+{len(models) - 3} more)"
        return (
            (
                f"reachable, latency {latency * 1000:.0f}ms, "
                f"{len(models)} loaded model(s): {summary} ({suffix})"
            ),
            latency,
        )
    except Exception as exc:
        return f"reachable, latency {latency * 1000:.0f}ms, /api/ps failed ({exc})", latency


def main() -> None:
    status, _ = get_ollama_status()
    print(f"Ollama status: {status}")


if __name__ == "__main__":
    main()
