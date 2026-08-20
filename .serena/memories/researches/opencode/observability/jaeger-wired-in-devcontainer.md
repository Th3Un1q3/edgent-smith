# Jaeger Already Wired in This Repo’s Devcontainer

Verified live. .devcontainer/docker-compose.yml already has a `jaeger` service (cr.jaegertracing.io/jaegertracing/jaeger:2.17.0, profile: infra, ports 16686 UI / 4318 OTLP HTTP). The devcontainer service sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, `JAEGER_QUERY_URL`/`JAEGER_UI_URL`. devcontainer.json forwards ports 16686 (Jaeger UI) and 4318 (Jaeger OTLP HTTP). .env.example documents the vars.

Live check: Jaeger UI returns 200, service `opencode` registered, traces arriving. This is the sanctioned way to see opencode traces — it already works, no changes needed.

Related: `mem:researches/opencode/observability/otel-export-env-var-only`.