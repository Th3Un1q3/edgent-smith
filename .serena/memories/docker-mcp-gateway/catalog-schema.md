# Catalog Schema for Docker Server Entries

Docker-backed entries in `mcp/catalog.yaml` use flat top-level keys: `type: server`, `image`, `command []` (positional server args), `volumes ["source:target:mode"]`, `env [{name, value}]`, `disableNetwork`, `tools`, plus `description`/`title`. `env` is how server settings such as `ALLOW_WRITE` reach the container. Verified against the gateway source (`docker/mcp-gateway` `pkg/catalog/types.go`) and the live catalog. (Source: gateway source + catalog inspection.)

The docker-mcp-gateway skill documents an older nested form (`type: docker` with a `docker:` block); the running gateway build expects the flat `type: server` form. Trust the flat form for this build, and re-verify against `pkg/catalog/types.go` after a gateway upgrade. (Source: skill docs vs. gateway source — documented drift.)

Refs: mem:docker-mcp-gateway/bind-and-mount-mechanics (volumes semantics), mem:docker-mcp-gateway/security-controls (disableNetwork, digest pinning).
Adding a server triggers the decision-tree rule (mem:docker-mcp-gateway/server-addition): update the context-gathering decision tree if the server can serve a context-gathering need.