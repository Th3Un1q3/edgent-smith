# [WITHDRAWN] Gateway Code Mode Addressing Falsified (2026-10-23)

> **Correction, same day — WITHDRAWN, do not cite as a finding.** The count was three because a wildcard `gateway_*` deny in the permission map removed tools from the catalog, not because the gateway declares three tools. With `gateway_*` allowed the namespace holds 255 tools at session start, and `tools.gateway["list_memories"]({})`, `["find_symbol"]`, `["tavily_search"]`, `["get_file_contents"]` and `["write_file"]` are all directly callable with a plain argument object. The corrected finding is `mem:researches/opencode/code-mode-mechanics`. Everything below is the original text, retained unchanged for audit only.

Summary: in OpenCode v2.1.1 with the Docker MCP gateway, the gateway namespace exposes only code-mode, mcp-exec and mcp-find; addressing a gateway server tool does not reach the nine catalogued servers, and the per-server codemode opt-out has no effect. ADR-013 phases P3-P6 are NO-GO; one reduced option remains.

## Harness version this holds for
OpenCode v2.1.1 with this repository's Docker MCP gateway (`mcp/catalog.yaml`, nine servers), probed 2026-10-23.

## Evidence — two probe results
- V5 FAIL: enumerating the gateway namespace from native `execute` lists exactly `["code-mode", "mcp-exec", "mcp-find"]`. No upstream server tool appears, so addressing a gateway server tool cannot reach the nine catalogued servers directly.
- V3 FAIL: `codemode: false` is stripped during config normalization in both the legacy flat `mcp.gateway` shape and the `mcp.servers.gateway` shape. No opt-out survives normalization, so the key has no observable effect in this build.

## Consequence for ADR-013
`mem:architecture/adr/ADR-013-native-code-mode-mcp-access` rests on the addressing assumption these probes falsify. P3 (explicit `execute` permission entry) is NO-GO because the execute-permission probe (V6) is BLOCKED, not because of V3 or V5. V3 and V5 falsify the addressing and opt-out assumptions behind P4 (direct endpoint prose), P5 (per-upstream-tool gating) and P6 (wrapper removal), which are NO-GO on that evidence. The ADR is not amended here; the decision change is pending user authorisation.

## Viable reduced option
Native `execute` can call the gateway namespace's `mcp-find` and `mcp-exec` methods directly, bypassing the gateway-hosted `code-mode` JavaScript layer (which nests a script inside a script today) while all nine servers stay reachable through `mcp-exec`. It buys no per-upstream-tool permissions, no per-server attribution (a row still records one `mcp-exec`), and no call reduction. This is an option, not an approved decision.

## Version scoping
**This finding is version-scoped.** It holds only for OpenCode v2.1.1 with the Docker MCP gateway as configured on 2026-10-23; re-probe both results after any harness or gateway upgrade, and re-check whether an upstream tool ever appears in the gateway namespace.

Source: `docs/plan/2026-10-23-mcp-code-mode-optimization/phase0-baseline.md` §2-§5 (probes V3 and V5, go/no-go table, reduced migration).
Related: `mem:researches/opencode/code-mode-mechanics` (corrected 2026-10-23), `mem:architecture/adr/ADR-013-native-code-mode-mcp-access`.