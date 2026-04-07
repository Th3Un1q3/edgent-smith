"""Tool registry and built-in tools for edge agents."""

from __future__ import annotations

from pydantic_ai import Tool

from edgent_smith.tools.base_tools import (
    calculator_tool,
    current_datetime_tool,
    web_search_stub_tool,
)


def get_default_tools() -> list[Tool]:  # type: ignore[type-arg]
    """Return the default tool set for edge agents."""
    return [
        Tool(current_datetime_tool, takes_ctx=True),
        Tool(calculator_tool, takes_ctx=True),
        Tool(web_search_stub_tool, takes_ctx=True),
    ]


__all__ = [
    "get_default_tools",
    "current_datetime_tool",
    "calculator_tool",
    "web_search_stub_tool",
]
