# DevContainer Ports & Services
This section lists the primary network ports and services exposed by the devcontainer environment.

- **8000**: edgent-smith API
- **11434**: Ollama (Local LLM API)
- **16686**: Jaeger UI (Tracing Dashboard)
- **4318**: Jaeger OTLP HTTP Endpoint

Example: Access the Jaeger UI at `http://localhost:16686`.

Reference: .devcontainer/docker-compose.yml
