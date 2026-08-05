# Dev-Container Workflows

Process learnings for modifying dev containers and shared dev environments inside orchestrator-driven sessions: change management and validation, secrets and dependency hygiene, and external-infra partitioning.

**Use when:** devcontainer.json, docker-compose, Dockerfile, environment setup, adding services to a dev environment, .env handling.

## Scope

- Change management and validation of devcontainer.json, docker-compose, and Dockerfile modifications.
- Secrets and dependency hygiene in shared dev environments (.env handling, dependency pinning).
- External-infra partitioning — which services run outside the dev container and how the container connects to them.

## Boundaries (out of scope)

- Generic Docker usage and Dockerfile authoring patterns not specific to this project's dev environment.
- Runtime application logic of services that run inside the dev environment.
- Docker MCP Gateway operations — see mem:docker-mcp-gateway/about.

## Related Domains

- mem:subagent-workflows/about — dispatching and verifying subagents that make devcontainer changes.
- mem:research-process/about — researching devcontainer behavior before modifying it.
