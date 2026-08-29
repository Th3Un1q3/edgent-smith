# Institutional Knowledge Stack (verified live 2026-08-24)

Knowledge graph: Graphiti (getzep/graphiti, Apache-2.0, ~30k stars) with built-in MCP server over Neo4j Community Edition (GPLv3); deployable through the existing catalog.yaml pipeline - UNIVERSAL org pick (Graphiti+Neo4j CE exposed via MCP). Runner-up: LightRAG (MIT, ~39k stars).

ADRs: current MADR-conformant layout is already machine-parseable - adr-tools and log4brains add nothing (log4brains dormant); keep plain files.

Pipeline: lightweight aggregator service (implementation stack follows the platform team; pydantic-ai noted as PER-STACK option - this repo's choice) writing into the central store: an ORG-level graph-backed store behind MCP. Serena remains THIS PROJECT's memory store (ADR-002 write gate), not an org standard; dedupe of bespoke knowledge remains custom work.

Session mining (generic): mine agent-session exports from any agent runtime; the mcp-session-insight schema is the starting point; OSS session miners are early-stage - plan bespoke.

Collector: github-mcp-server (MIT, ~32k stars) plus PR-Agent distillation routed through the MCP Gateway.