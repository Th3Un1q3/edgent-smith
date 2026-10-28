---
id: conventions/opencode-tavily-tool-deny
L0: "Only gateway_tavily_research is denied to OpenCode sessions; the four sibling tavily tools stay allowed by the gateway_* allow, and the single-gateway proxy is why the catalog and per-server switches were rejected."
freshness: 2026-10-27
provenance: /workspace/opencode.jsonc; /workspace/mcp/catalog.yaml
---

# gateway_tavily_research is denied to OpenCode sessions

Source: `/workspace/opencode.jsonc`, permission block lines 87-88, read 2026-10-27. One entry sits directly after `"gateway_*": "allow"`:

```jsonc
"gateway_tavily_research": "deny",
```

The block holds no other tavily key. `tavily_search`, `tavily_extract`, `tavily_crawl`, and `tavily_map` are allowed by the pre-existing `"gateway_*": "allow"` on the line above, so the denial covers exactly one tool.

## Why the permission map is the right seam

Tavily is not a separate MCP server here. It is one registry entry in `/workspace/mcp/catalog.yaml` (`registry.tavily`, lines 3-18), and OpenCode declares a single remote MCP server, `"gateway"`, at `http://mcp_gateway:8080/mcp` (opencode.jsonc lines 103-106). Disabling that server would remove every gateway tool, serena reads and memory writes included. Editing the catalog instead would also change DSH, which reads the same file. Neither seam can remove one tavily tool.

## Why the earlier family-wide deny was wrong

An earlier revision of this memory recorded a wildcard deny for the whole family. The request named one tool, and that wildcard also removed four tools nobody asked to remove, so the block was wider than the decision it recorded. The corrected map denies `gateway_tavily_research` alone.

## Residual risk

Permission glob and precedence support is unproven in this repo. The single exact key does not depend on a wildcard match, so it carries the guarantee by itself; precedence between `gateway_*` and a more specific key is still assumed rather than measured. DSH and GitHub Copilot sessions still reach tavily by design; this denial binds OpenCode sessions.

scope: conventions — a config fact with file evidence, not a user preference and not a single failure case.
