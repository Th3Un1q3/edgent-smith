"""Minimal stub for zstandard — satisfies mypy strict without ignore_missing_imports.

Provides only the surface used in scripts/tail_sessions.py.
Full library has many more APIs; add as needed.
"""

from __future__ import annotations

from typing import IO, Any

class ZstdDecompressor:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
    def stream_reader(self, source: IO[bytes], closefd: bool = True) -> IO[bytes]: ...

# Common extra symbols to avoid false positives if imported elsewhere
class ZstdCompressor:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
