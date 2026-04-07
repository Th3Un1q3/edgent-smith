"""Protocol defining the minimum interface for agent dependencies."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class AgentDepsProtocol(Protocol):
    """Minimal interface required by all tools that accept agent context."""

    run_id: str
    max_tokens: int
    max_tool_calls: int
