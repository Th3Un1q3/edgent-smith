# ForwardPorts entries must match real compose publishes

Every entry in .devcontainer/devcontainer.json forwardPorts needs a backing compose service or published port. Audit 2026-08-22 found orphans [8000, 11434, 3080]: no ollama service exists even though compose environment references http://ollama:11434 and an unused ollama_data volume is declared.

## Stale world model

AGENTS.md claims an Ollama sidecar plus Python 3.13; devcontainer features pin Python 3.14. Both claims are stale.

## Real publishes and rule

Real publishes: 8080 mcp_gateway, 16686 + 4318 jaeger, all unpinned (0.0.0.0). Rule: when adding or removing services, sync forwardPorts and the AGENTS.md world model in the same change.