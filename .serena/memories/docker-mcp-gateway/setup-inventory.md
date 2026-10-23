---
id: docker-mcp-gateway/setup-inventory
type: entities
L0: "As-is inventory of the Docker MCP Gateway: launch flags, 9 catalog servers (6 remote / 3 docker), per-client tool naming, and observed registration overhead."
hotness: 0.6
ttl: 90d
freshness: 2026-10-23
directory: docker-mcp-gateway
provenance: read-only inventory of /workspace, 2026-10-23
---
# MCP setup inventory (as-is, 2026-10-23)
Read-only inspection of /workspace; no container started. Client under review: opencode v2.1.1.
## Gateway launch
- .devcontainer/docker-compose.yml:36-65 - service mcp_gateway, image docker/mcp-gateway:dind (l.37), compose profile infra (l.38), host port 8080:8080 (l.41).
- Mounts: catalog read-only (l.43), docker config (l.44), repo rw (l.45).
- Flags (l.51-58): --transport=streaming, --catalog=/mcp/catalog.yaml, --enable-all-servers, --port=8080, --secrets=/run/secrets/mcp_creds, --block-secrets, --log-calls.
- Secret mcp_creds from ../secrets/mcp_creds (l.49-50, l.105-107); bind allowlist env (l.47-48).
- Aggregated client endpoint: http://mcp_gateway:8080/mcp.
## Catalog - 9 servers (mcp/catalog.yaml, name: local, l.1)
Remote HTTP (6):
- tavily l.3 - web search plus page extraction; bearer TAVILY_API_KEY (l.11).
- deepwiki l.20 - docs and wiki knowledge search; no auth.
- serena l.28 - symbol search and code intelligence; http://serena:9121/mcp (l.33).
- devtools l.36 - Chrome DevTools via mcp-proxy on host port 9223 (l.41-42).
- context7 l.44 - library docs lookup; bearer (l.52).
- github l.58 - read-only GitHub API (l.63-64); bearer (l.66).
Docker type: server (3):
- fetch l.72 - image mcp/fetch:latest (l.76) - public page fetch.
- youtube-transcript l.78 - image (l.82) - video transcripts.
- filesystem l.84 - digest-pinned rust-mcp-filesystem (l.88), ALLOW_WRITE, ten allowed roots, disableNetwork (l.105).
Entry schema rules live in mem:docker-mcp-gateway/catalog-schema - single authority, not restated here.
## Client-side naming (observed)
- opencode: one remote server named gateway (opencode.jsonc:89-94); tools surface as gateway_<method> - gateway_mcp-find, gateway_code-mode, gateway_mcp-exec (opencode.jsonc:82-84; .agents/skills/context-gathering/SKILL.md:26). No codemode key is set.
- DSH: mcp__gateway__<tool> (.dsh/cordis.patch.yml:48); active client in .dsh/child-runtime/cordis.yml:90-92; host-side bridge commented out with a FIXME (.dsh/cordis.patch.yml:50-59).
- VS Code routes through the gateway: .vscode/mcp.json:18-21 (container-docker to the gateway URL).
- Copilot bypasses the gateway: .copilot/mcp-config.json:3-19 lists only context7 and deepwiki with direct URLs.
## Observed usage (session records)
.opencode/plugins/sessions/*.json keeps one last-call timestamp per tool name. Across 6357 files: gateway_mcp-find 981, gateway_code-mode 928, gateway_mcp-exec 927; direct server tools (serena_*, tavily_*, filesystem_*) 0. These are sessions where a tool was used, not call totals. The gateway wrapper is the only MCP path in use.
## Registration and duplication overhead
1. Per-method permission enumeration: opencode.jsonc:81-84 (gateway_* deny plus three explicit allows).
2. Per-tool declaration in the catalog: mcp/catalog.yaml:16-18 (tavily tools), tool names in prose at l.5 and l.38.
3. Servers re-enumerated in skill prose: context-gathering/SKILL.md:82, references/server-selection.md:6, workflows/setup.md:7.
4. serena exists twice: catalog entry l.28-34 and compose service .devcontainer/docker-compose.yml:77-95.
5. Server count duplicated in docs: docs/deepseek-harness/03-tool-separation.md:41; the gate counts type: lines in justfile:87.
## Unverified
[unverified] Per-method tool inventory the gateway publishes at runtime - the gateway was not started, so only config-level facts above are verified. [unverified] Per-call totals - session files keep only last-call timestamps.
## Refs
mem:docker-mcp-gateway/about, mem:docker-mcp-gateway/security-controls, mem:docker-mcp-gateway/catalog-schema, mem:docker-mcp-gateway/server-enablement; proposal docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md; decision architecture/adr/ADR-013-native-code-mode-mcp-access.