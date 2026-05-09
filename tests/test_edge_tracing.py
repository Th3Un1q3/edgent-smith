from __future__ import annotations

import json
import os
from types import SimpleNamespace

import pytest


def test_bootstrap_local_tracing_configures_logfire_and_otlp_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import agents.edge_tracing as edge_tracing

    calls: list[tuple[str, object]] = []

    def fake_configure(**kwargs: object) -> None:
        calls.append(("configure", kwargs))

    def fake_instrument_pydantic_ai() -> None:
        calls.append(("instrument_pydantic_ai", None))

    fake_logfire = SimpleNamespace(
        configure=fake_configure,
        instrument_pydantic_ai=fake_instrument_pydantic_ai,
    )

    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318")
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", raising=False)
    monkeypatch.setattr(edge_tracing, "logfire", fake_logfire, raising=False)
    monkeypatch.setattr(edge_tracing, "_TRACING_BOOTSTRAPPED", False)

    edge_tracing.bootstrap_local_tracing()

    assert calls == [
        (
            "configure",
            {
                "metrics": False,
                "send_to_logfire": False,
                "service_name": "edge-agent",
            },
        ),
        ("instrument_pydantic_ai", None),
    ]
    assert os.environ["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] == "http://jaeger:4318/v1/traces"


def test_print_trace_context_emits_query_and_ui(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    import agents.edge_tracing as edge_tracing

    monkeypatch.setenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://jaeger:4318/v1/traces")
    monkeypatch.setenv("OTEL_SERVICE_NAME", "edge-agent")
    monkeypatch.setenv("JAEGER_QUERY_URL", "http://jaeger:16686")
    monkeypatch.setenv("JAEGER_UI_URL", "http://localhost:16686")

    edge_tracing.print_trace_context()

    captured = capsys.readouterr().out
    assert "Trace collector: http://jaeger:4318/v1/traces" in captured
    assert "Trace query: http://jaeger:16686/api/traces?service=edge-agent" in captured
    assert "Trace UI: http://localhost:16686" in captured


def test_render_full_trace_returns_pretty_raw_json() -> None:
    from agents.edge_tracing import render_full_trace

    trace_payload = {
        "traceID": "abc123",
        "spans": [
            {
                "operationName": "agent.run",
                "duration": 1500,
                "tags": [
                    {"key": "otel.status_code", "value": "OK"},
                    {
                        "key": "gen_ai.input.messages",
                        "value": '[{"role":"user","content":"What is 2 + 2?"}]',
                    },
                    {
                        "key": "gen_ai.output.messages",
                        "value": '[{"role":"assistant","content":"4"}]',
                    },
                ],
            },
            {
                "operationName": "tool.calculator",
                "duration": 250,
                "tags": [
                    {"key": "otel.status_code", "value": "OK"},
                    {"key": "tool_arguments", "value": '{"expression":"2 + 2"}'},
                    {"key": "tool_response", "value": '"4"'},
                ],
            },
        ],
    }

    rendered = render_full_trace(trace_payload)
    assert json.loads(rendered) == trace_payload
    assert rendered.startswith("{\n")
    assert '  "traceID": "abc123"' in rendered


def test_fetch_trace_details_waits_for_current_invocation_trace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import agents.edge_tracing as edge_tracing

    stale_trace = {
        "traceID": "stale-trace",
        "spans": [
            {
                "operationName": "agent.run",
                "startTime": 1_000,
                "duration": 1_500,
                "tags": [{"key": "otel.status_code", "value": "OK"}],
            }
        ],
    }
    current_trace = {
        "traceID": "current-trace",
        "spans": [
            {
                "operationName": "agent.run",
                "startTime": 2_500,
                "duration": 2_000,
                "tags": [{"key": "otel.status_code", "value": "OK"}],
            }
        ],
    }
    responses = [{"data": [stale_trace]}, {"data": [stale_trace, current_trace]}]

    class _FakeResponse:
        status = 200

        def __init__(self, payload: dict[str, object]) -> None:
            self._payload = payload

        def read(self) -> bytes:
            return json.dumps(self._payload).encode()

    class _FakeConnection:
        def __init__(self, netloc: str, timeout: int) -> None:
            assert netloc == "jaeger:16686"
            assert timeout == 2

        def request(self, method: str, path: str) -> None:
            assert method == "GET"
            assert path.startswith("/api/traces?")

        def getresponse(self) -> _FakeResponse:
            return _FakeResponse(responses.pop(0))

        def close(self) -> None:
            return None

    monkeypatch.setenv("OTEL_SERVICE_NAME", "edge-agent")
    monkeypatch.setenv("JAEGER_QUERY_URL", "http://jaeger:16686")
    monkeypatch.setattr(edge_tracing.client, "HTTPConnection", _FakeConnection)
    monkeypatch.setattr(edge_tracing.time, "sleep", lambda _seconds: None)

    trace_details = edge_tracing.fetch_trace_details(invocation_started_at_us=2_000)
    trace_json = json.loads(trace_details)

    assert trace_json == current_trace


def test_fetch_trace_details_returns_pretty_full_payload_when_no_matching_trace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import agents.edge_tracing as edge_tracing

    payload = {"data": [], "total": 0, "limit": 20, "offset": 0}

    class _FakeResponse:
        status = 200

        def read(self) -> bytes:
            return json.dumps(payload).encode()

    class _FakeConnection:
        def __init__(self, netloc: str, timeout: int) -> None:
            assert netloc == "jaeger:16686"
            assert timeout == 2

        def request(self, method: str, path: str) -> None:
            assert method == "GET"
            assert path.startswith("/api/traces?")

        def getresponse(self) -> _FakeResponse:
            return _FakeResponse()

        def close(self) -> None:
            return None

    monkeypatch.setenv("OTEL_SERVICE_NAME", "edge-agent")
    monkeypatch.setenv("JAEGER_QUERY_URL", "http://jaeger:16686")
    monkeypatch.setattr(edge_tracing.client, "HTTPConnection", _FakeConnection)

    trace_details = edge_tracing.fetch_trace_details(invocation_started_at_us=2_000)

    assert json.loads(trace_details) == payload
