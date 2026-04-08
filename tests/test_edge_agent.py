"""Tests for agents/edge.py using pydantic-ai's TestModel (no real LLM needed)."""

from __future__ import annotations

from datetime import UTC

import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from agents.edge import AgentOutput, agent, run_agent

# Prevent accidental real model requests in CI
models.ALLOW_MODEL_REQUESTS = False

pytestmark = pytest.mark.anyio


# ── Agent construction ─────────────────────────────────────────────────────────


def test_agent_has_tools() -> None:
    """The agent must expose its three inline tools."""
    toolset = agent._function_toolset  # type: ignore[attr-defined]
    tool_names = set(toolset.tools)  # dict keyed by name
    assert "calculator" in tool_names
    assert "current_datetime" in tool_names
    assert "web_search_stub" in tool_names


# ── Run with TestModel ─────────────────────────────────────────────────────────


async def test_run_returns_agent_output() -> None:
    """A run with TestModel must return an AgentOutput instance."""
    with agent.override(model=TestModel()):
        result = await run_agent("Hello")
    assert isinstance(result, AgentOutput)
    assert isinstance(result.answer, str)
    assert result.confidence in {"high", "medium", "low", "abstain"}


async def test_calculator_tool_valid_expression() -> None:
    """calculator() should evaluate safe arithmetic correctly."""
    # Import directly so we can unit-test the tool function in isolation
    from agents.edge import calculator

    assert calculator("2 + 2") == "4"
    assert calculator("10 * 3") == "30"
    assert calculator("100 / 4") == "25.0"


async def test_calculator_tool_rejects_unsafe() -> None:
    """calculator() must reject expressions with non-arithmetic characters."""
    from agents.edge import calculator

    result = calculator("__import__('os')")
    assert result.startswith("Error")


async def test_current_datetime_tool_is_iso() -> None:
    """current_datetime() must return a valid ISO 8601 string."""
    from datetime import datetime

    from agents.edge import current_datetime

    ts = current_datetime()
    # Must parse without error
    dt = datetime.fromisoformat(ts)
    assert dt.tzinfo is not None
    assert dt.tzinfo == UTC


async def test_web_search_stub_returns_message() -> None:
    """web_search_stub() must return a non-empty informational message."""
    from agents.edge import web_search_stub

    result = web_search_stub("latest news")
    assert "web_search_stub" in result
    assert "latest news" in result
