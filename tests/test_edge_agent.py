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

from agents import edge as edge_module
from agents.edge import AgentOutput, ConfidenceEnum, build_edge_agent
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


async def test_run_edge_agent_bootstraps_official_logfire_tracing_before_agent_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CLI runs must bootstrap Logfire's official Pydantic AI tracing hooks."""

    calls: list[tuple[str, object]] = []

    class _FakePart:
        tool_name = "calculator"

    class _FakeMessage:
        parts = [_FakePart()]

    class _FakeResult:
        output = AgentOutput(answer="4", confidence=ConfidenceEnum.high)

        def all_messages(self) -> list[object]:
            return [_FakeMessage()]

    class _FakeAgent:
        async def run(self, prompt: str) -> _FakeResult:
            calls.append(("agent_run", prompt))
            assert prompt == "What is 2 + 2?"
            return _FakeResult()

    class _FakeTracing:
        def bootstrap_local_tracing(self) -> None:
            calls.append(("bootstrap_local_tracing", None))

        def flush_tracing(self) -> None:
            calls.append(("flush_tracing", None))

        def print_trace_context(self) -> None:
            calls.append(("print_trace_context", None))

        def fetch_trace_details(self, invocation_started_at_us: int) -> str:
            calls.append(("fetch_trace_details", invocation_started_at_us > 0))
            return '{\n  "traceID": "test",\n  "spans": []\n}'

    monkeypatch.setenv("PROMPT", "What is 2 + 2?")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318")
    monkeypatch.delenv("DRY_RUN_LOCAL_LOOP", raising=False)
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", raising=False)
    monkeypatch.setattr(edge_module, "build_edge_agent", lambda: _FakeAgent())
    monkeypatch.setattr(edge_module, "edge_tracing", _FakeTracing())

    await edge_module.run_edge_agent()

    assert calls == [
        ("bootstrap_local_tracing", None),
        ("agent_run", "What is 2 + 2?"),
        ("flush_tracing", None),
        ("print_trace_context", None),
        ("fetch_trace_details", True),
    ]


async def test_run_edge_agent_prints_inline_trace_details(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """CLI runs must include inline trace details in addition to trace URLs."""

    seen_started_at: list[int] = []

    class _FakeResult:
        output = AgentOutput(answer="done", confidence=ConfidenceEnum.medium)

        def all_messages(self) -> list[object]:
            return []

    class _FakeAgent:
        async def run(self, prompt: str) -> _FakeResult:
            assert prompt == "Summarize the trace"
            return _FakeResult()

    class _FakeTracing:
        def bootstrap_local_tracing(self) -> None:
            pass

        def flush_tracing(self) -> None:
            pass

        def print_trace_context(self) -> None:
            print("Trace query:", "http://jaeger:16686/api/traces?service=edge-agent")

        def fetch_trace_details(self, invocation_started_at_us: int) -> str:
            seen_started_at.append(invocation_started_at_us)
            return '{\n  "traceID": "abc123",\n  "spans": []\n}'

    monkeypatch.setenv("PROMPT", "Summarize the trace")
    monkeypatch.delenv("DRY_RUN_LOCAL_LOOP", raising=False)
    monkeypatch.setattr(edge_module, "build_edge_agent", lambda: _FakeAgent())
    monkeypatch.setattr(edge_module, "edge_tracing", _FakeTracing())

    await edge_module.run_edge_agent()

    captured = capsys.readouterr().out
    assert len(seen_started_at) == 1
    assert seen_started_at[0] > 0
    expected_trace = 'Trace details:\n{\n  "traceID": "abc123",\n  "spans": []\n}'
    assert "Trace query:" in captured
    assert expected_trace in captured


async def test_run_edge_agent_prints_trace_details_when_agent_run_fails(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """CLI runs must still print trace context when the model call fails."""

    class _FakeAgent:
        async def run(self, prompt: str) -> object:
            assert prompt == "What is 2+2?"
            raise RuntimeError("model provider failed")

    class _FakeTracing:
        def bootstrap_local_tracing(self) -> None:
            pass

        def flush_tracing(self) -> None:
            pass

        def print_trace_context(self) -> None:
            print("Trace query:", "http://jaeger:16686/api/traces?service=edge-agent")

        def fetch_trace_details(self, invocation_started_at_us: int) -> str:
            assert invocation_started_at_us > 0
            return '{\n  "traceID": "abc123",\n  "spans": []\n}'

    monkeypatch.setenv("PROMPT", "What is 2+2?")
    monkeypatch.delenv("DRY_RUN_LOCAL_LOOP", raising=False)
    monkeypatch.setattr(edge_module, "build_edge_agent", lambda: _FakeAgent())
    monkeypatch.setattr(edge_module, "edge_tracing", _FakeTracing())

    with pytest.raises(RuntimeError, match="model provider failed"):
        await edge_module.run_edge_agent()

    captured = capsys.readouterr().out
    assert "Trace query:" in captured
    assert 'Trace details:\n{\n  "traceID": "abc123",\n  "spans": []\n}' in captured
