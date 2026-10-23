> **Correction (2026-10-23):** The V5 and namespace findings below are an artefact of the
> `gateway_*` deny rule hiding the catalog. See [before-after-proposal.md](before-after-proposal.md).

# R1 contract probe: gateway invocation forms

Status: evidence record
Date: 2026-10-23
Scope: invocation forms exposed by the Docker MCP gateway under OpenCode v2.1.1. No configuration was changed.

| Probe | Call as made | Exact output | Verdict |
|---|---|---|---|
| Namespace listing | `Object.keys(tools.gateway)` | `[code-mode, mcp-exec, mcp-find]` | PASS — the namespace exposes three wrapper methods and no upstream tool |
| Discovery by server name | `mcp-find({query: "serena"})` | Top-level keys `prompt`, `servers`, `total_matches`; returns server names such as `serena` and `filesystem`, not tool names | PARTIAL — server discovery works, tool discovery does not |
| Bare upstream name | `mcp-exec({name: "list_memories", arguments: {}})` | `Error: Tool list_memories not found in current session. Make sure the server providing this tool is added to the session.` | FAIL — upstream names are not resolvable |
| Prefixed upstream name | `mcp-exec({name: "serena_list_memories", arguments: {}})` | The same error, naming `serena_list_memories` | FAIL — prefixing does not make an upstream name resolvable |
| Working form, step 1 | Gateway `code-mode` tool with `{name, servers: ["serena"]}` | Creates the sandbox tool | PASS |
| Working form, step 2 | `mcp-exec({name: "code-mode-<x>", arguments: {script: ...}})` | The script runs; the `script` parameter is required, and a wrong key returns no output | PASS |

## Conclusion

The only working invocation form is two-step: first call the gateway's `code-mode` tool with a `name` and a
`servers` list to register a named sandbox, then call `mcp-exec` with `name: "code-mode-<x>"` and
`arguments: {script: ...}`. Bare upstream names, including server-prefixed names, fail with the error quoted above.

This finding holds for OpenCode v2.1.1 with this gateway as configured on 2026-10-23, and must be re-probed after any
harness or gateway upgrade.
