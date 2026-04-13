"""Tests for agents/edge.py using pydantic-ai's TestModel (no real LLM needed)."""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

# Ensure config import-time builders that require env vars don't fail during
# test collection by providing a harmless default token for Copilot.
os.environ.setdefault("GITHUB_COPILOT_API_TOKEN", "test-token")

from agents.edge import AgentOutput, build_edge_agent
from config import ModelConfig

# Prevent accidental real model requests in CI
models.ALLOW_MODEL_REQUESTS = False

pytestmark = pytest.mark.anyio


# ── Agent construction ─────────────────────────────────────────────────────────


def test_agent_has_tools() -> None:
    """The agent must expose its three inline tools."""
    # Construct an agent backed by TestModel to avoid real network calls.
    test_cfg = ModelConfig(alias="test", model=TestModel(), model_settings=None)
    a = build_edge_agent(edge_model_config=test_cfg)
    toolset = a._function_toolset
    tool_names = set(toolset.tools)  # dict keyed by name
    assert "calculator" in tool_names
    assert "current_datetime" in tool_names
    assert "web_search_stub" in tool_names


# ── Run with TestModel ─────────────────────────────────────────────────────────


async def test_run_returns_agent_output() -> None:
    """A run with TestModel must return an AgentOutput instance."""
    test_cfg = ModelConfig(alias="test", model=TestModel(), model_settings=None)
    a = build_edge_agent(edge_model_config=test_cfg)
    res = await a.run("Hello")
    result = res.output
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
