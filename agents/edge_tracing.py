from __future__ import annotations

import contextlib
import importlib
import json
import os
import time
from http import client
from typing import Any
from urllib import parse

_DEFAULT_TRACE_COLLECTOR = "http://jaeger:4318"
_DEFAULT_TRACE_QUERY_URL = "http://jaeger:16686"
_DEFAULT_TRACE_VIEWER_URL = "http://localhost:16686"
_DEFAULT_TRACE_SERVICE = "edge-agent"

logfire: Any | None = None
_TRACING_BOOTSTRAPPED = False


def bootstrap_local_tracing() -> None:
    """Enable official Logfire instrumentation for local OTLP backends."""
    global logfire, _TRACING_BOOTSTRAPPED

    if _TRACING_BOOTSTRAPPED:
        return

    collector = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", _DEFAULT_TRACE_COLLECTOR).rstrip("/")

    os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", collector)
    os.environ.setdefault("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", f"{collector}/v1/traces")
    os.environ.setdefault("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    os.environ.setdefault("OTEL_SERVICE_NAME", _DEFAULT_TRACE_SERVICE)

    if logfire is None:
        logfire = importlib.import_module("logfire")

    logfire.configure(
        metrics=False,
        send_to_logfire=False,
        service_name=os.getenv("OTEL_SERVICE_NAME", _DEFAULT_TRACE_SERVICE),
    )
    logfire.instrument_pydantic_ai()
    _TRACING_BOOTSTRAPPED = True


def flush_tracing() -> None:
    """Flush spans before the process exits so the local backend can query them."""
    from opentelemetry import trace

    tracer_provider = trace.get_tracer_provider()
    force_flush = getattr(tracer_provider, "force_flush", None)
    if callable(force_flush):
        force_flush()


def print_trace_context() -> None:
    """Emit the local trace lookup details a validating agent can follow."""
    collector = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    if collector is None:
        collector = (
            os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", _DEFAULT_TRACE_COLLECTOR).rstrip("/")
            + "/v1/traces"
        )
    service_name = os.getenv("OTEL_SERVICE_NAME", _DEFAULT_TRACE_SERVICE)
    query_url = os.getenv("JAEGER_QUERY_URL", _DEFAULT_TRACE_QUERY_URL).rstrip("/")
    viewer_url = os.getenv("JAEGER_UI_URL", _DEFAULT_TRACE_VIEWER_URL).rstrip("/")

    print("Trace collector:", collector.rstrip("/"))
    print("Trace service:", service_name)
    print("Trace query:", f"{query_url}/api/traces?service={service_name}")
    print("Trace UI:", viewer_url)


def _pretty_json(payload: Any) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=True)


def _trace_start_us(trace_payload: dict[str, Any]) -> int | None:
    spans = trace_payload.get("spans") or []
    start_times: list[int] = []
    for span in spans:
        try:
            start_times.append(int(span.get("startTime")))
        except (TypeError, ValueError):
            continue
    if not start_times:
        return None
    return min(start_times)


def _select_trace(
    traces: list[dict[str, Any]], invocation_started_at_us: int | None
) -> dict[str, Any] | None:
    if not traces:
        return None
    if invocation_started_at_us is None:
        return traces[0]

    for trace_payload in traces:
        start_us = _trace_start_us(trace_payload)
        if start_us is not None and start_us >= invocation_started_at_us:
            return trace_payload
    return None


def render_full_trace(trace_payload: dict[str, Any]) -> str:
    return _pretty_json(trace_payload)


def fetch_trace_details(invocation_started_at_us: int | None = None) -> str:
    service_name = os.getenv("OTEL_SERVICE_NAME", _DEFAULT_TRACE_SERVICE)
    query_url = os.getenv("JAEGER_QUERY_URL", _DEFAULT_TRACE_QUERY_URL).rstrip("/")
    parsed_query_url = parse.urlsplit(query_url)
    if parsed_query_url.scheme not in {"http", "https"}:
        scheme = parsed_query_url.scheme or "missing"
        return f"unavailable (unsupported Jaeger query URL scheme: {scheme})"

    base_path = parsed_query_url.path.rstrip("/")
    trace_path = f"{base_path}/api/traces" if base_path else "/api/traces"
    params = parse.urlencode({"service": service_name, "limit": 20})
    connection_type = (
        client.HTTPSConnection if parsed_query_url.scheme == "https" else client.HTTPConnection
    )
    last_payload: dict[str, Any] | None = None

    for _ in range(5):
        connection: client.HTTPConnection | client.HTTPSConnection | None = None
        try:
            connection = connection_type(parsed_query_url.netloc, timeout=2)
            connection.request("GET", f"{trace_path}?{params}")
            response = connection.getresponse()
            if response.status >= 400:
                return f"unavailable (Jaeger query returned HTTP {response.status})"
            payload = json.loads(response.read().decode())
        except Exception as exc:
            return f"unavailable ({exc})"
        finally:
            if connection is not None:
                with contextlib.suppress(Exception):
                    connection.close()

        last_payload = payload
        traces = payload.get("data") or []
        selected_trace = _select_trace(traces, invocation_started_at_us)
        if selected_trace is not None:
            return render_full_trace(selected_trace)
        time.sleep(0.2)

    if last_payload is not None:
        return _pretty_json(last_payload)
    return "unavailable (no traces returned by Jaeger)"
