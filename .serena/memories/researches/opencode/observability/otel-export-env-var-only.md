# OpenCode OTel Export: Env-Var Only, Process-Level Spans

Verified against installed opencode binary 1.18.13 and source at v1.18.18. OTel export is env-var-only, gated on `OTEL_EXPORTER_OTLP_ENDPOINT` (+ optional `OTEL_EXPORTER_OTLP_HEADERS`); traces go to `${endpoint}/v1/traces`.

There is NO config key for telemetry. The v2 config spec explicitly removed `experimental.openTelemetry` with: “Do not port; observability is process-level and should use standard OpenTelemetry environment”.

Only process-level spans are emitted — observed live in Jaeger: `ControlHttpApi.log`, `http.server` GET/POST, `Session.get`, `sql.execute`. No call-site instrumentation of tool or LLM calls: llm.ts/tool.ts have zero telemetry references; no `gen_ai.*` spans, no payload spans through v1.18.18. Tool-level/trace-level detail for tools is NOT available in Jaeger and cannot be enabled by config.