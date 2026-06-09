# DevContainer Concepts
The development environment is a multi-service containerized sandbox based on Ubuntu Noble. It provides a unified workspace with pre-configured runtimes, AI tools, and tracing infrastructure.

- **Runtime**: Python 3.14 and Node 24.
- **AI Stack**: Includes Ollama for local LLM hosting and an MCP gateway.
- **Observability**: Integrated Jaeger for distributed tracing.
- **Tools**: Includes `uv` for Python, `just` for task running, and `github-cli`.

Example: `python --version` should return 3.14.

Reference: .devcontainer/devcontainer.json
