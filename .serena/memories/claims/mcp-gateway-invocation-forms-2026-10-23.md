# Gateway invocation forms (2026-10-23)

Summary: **SUPERSEDED 2026-10-23 — do not cite the conclusion below as current.** Under OpenCode v2.1.1 with this Docker MCP gateway the gateway namespace holds 255 tools at session start and bare tool names are directly callable: `tools.gateway["list_memories"]({})` works with a plain argument object. The three-method count and the `mcp-exec` bare-name failure recorded here were caused by a wildcard `gateway_*` deny that removed tools from the catalog. The wrapper chain still exists and still works, but it is neither the only path nor the recommended one. Original text retained below for audit.

## Namespace (historical — recorded under a wildcard gateway_* deny)
Object.keys(tools.gateway) returned [code-mode, mcp-exec, mcp-find] **because the deny removed every other gateway tool from the catalog**. With `gateway_*` allowed, the namespace exposes 255 tools at session start. A denied tool is invisible rather than merely blocked; `execute` being allowed is not a grant.

## Discovery
mcp-find({query: "serena"}) returns top-level keys prompt, servers and total_matches, and server names such as serena and filesystem. It does not return tool names.

## Failure mode for bare upstream names (superseded — the failure is real but irrelevant)
This is an `mcp-exec` lookup failure, not evidence that direct addressing is unavailable: `mcp-exec` takes the *name of a code-mode tool*, not an upstream tool. Once the tool is permitted, it is addressed directly instead of through `mcp-exec` at all.
mcp-exec({name: "list_memories", arguments: {}}) returns:
Error: Tool list_memories not found in current session. Make sure the server providing this tool is added to the session.
mcp-exec({name: "serena_list_memories", arguments: {}}) returns the same error naming serena_list_memories, so server prefixing does not help.

## Working form (one option, not the only path)
Use this only for multi-step scripts. Direct addressing is the default: `tools.gateway["list_memories"]({})`.
1. Call the gateway code-mode tool with {name, servers: ["serena"]}.
2. Call mcp-exec with {name: "code-mode-<x>", arguments: {script: ...}}.
The script parameter is named script. A wrong key returns no output.

## Version scoping
Holds for OpenCode v2.1.1 with this gateway as configured on 2026-10-23. Re-probe after any harness or gateway upgrade.

## References
- ADR-014: mem:architecture/adr/ADR-014-gateway-wrapper-methods-as-mcp-path
- Probe record: docs/plan/2026-10-23-mcp-code-mode-optimization/r1-contract-probe.md
- The bare-name mcp-exec failure is real but irrelevant, because tools are addressed directly once permitted.
