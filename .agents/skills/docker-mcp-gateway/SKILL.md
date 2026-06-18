---
name: docker-mcp-gateway
description: >
  Provides expert guidance on configuring and managing the Docker MCP Gateway.
  Covers secret management in Docker Compose, multi-server catalog configuration,
  and orchestration of remote vs. local container-based MCP servers.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
---

# Docker MCP Gateway Skill

This skill provides a structured workflow for leveraging the Docker MCP Gateway to host and orchestrate MCP servers. It helps you manage complex configurations involving both remote endpoints and local Docker containers.

## When to Use This Skill

Invoke this skill when:
- You need to set up a Docker MCP Gateway using Docker Compose.
- You are struggling with secret management (e.g., AWS keys, API tokens) in a containerized gateway.
- You need to create a complex `mcp/catalog.yaml` for multiple remote and local servers.
- You want to understand the correct nesting of `headers` and `transport_type` in the MCP catalog.

## When Not to Use This Skill

Do not use this skill for:
- General Docker image building or basic container management (use standard Docker docs).
- Developing MCP servers in Python or Node.js (use the respective language-specific skills).
- Simple MCP configurations that do not involve a gateway architecture.

## Principles

- **Security First**: Prefer Docker Secrets over Environment Variables whenever possible to prevent credential leakage in logs.
- **Explicit Configuration**: Always explicitly define `transport_type` to avoid gateway defaults that may not suit your network topology.
- **Modular Catalog**: Break down complex catalogs into logical sections for remote, local, and cloud-based tools.

## Task Routing Table

| I want to... | File |
|---|---|
| Set up the Docker MCP Gateway with Docker Compose and secrets | [workflows/setup.md](./workflows/setup.md) |
| Configure `mcp/catalog.yaml` for remote and local servers | [workflows/catalog.md](./workflows/catalog.md) |
| Review technical specs and secret injection patterns | [reference/docker-mcp-gateway.md](./reference/docker-mcp-gateway.md) |
