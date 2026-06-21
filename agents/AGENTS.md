# AGENTS KNOWLEDGE BASE (Runtime Agents)

**OVERVIEW**: Core runtime implementation of Pydantic AI edge agents and observability tracing instrumentation for the system.

## STRUCTURE
```text
agents/
├── edge.py               # Primary agent execution logic
└── edge_tracing.py       # Observability & telemetry (OpenTelemetry / Logfire integration)
```

## WHERE TO LOOK
- **Agent Logic**: `edge.py` contains the main Pydantic AI agent configuration, tools for arithmetic and web search stubs, and structured output definitions (`AgentOutput`).
- **Observability**: `edge_tracing.py` manages local tracing bootstrapping (Jaeger/OTLP) and provides telemetry utilities.

## CONVENTIONS
- **Structured Output**: Agents return data using Pydantic models to ensure type safety in downstream workflows.
- **Telemetry Hooking**: Instrumentation is bootstrapped via environment variables (`OTEL_*`) and managed through `edge_tracing`.
- **Fallback Behavior**: Tools like `web_search_stub` provide local fallback implementations for offline/edge environments.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not modify agent logic without updating the corresponding `tests/*.py` files in the project root.
- Avoid adding complex business logic directly into `edge.py`; delegate to external services or tools where possible.