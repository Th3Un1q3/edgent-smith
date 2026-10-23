# OpenCode v2 Code Mode - Mechanics

Summary: opencode 2.1.1 exposes MCP tools through one default-on execute({code}) JavaScript interpreter; disable per server with codemode: false, or deny execute/* to remove Code Mode entirely.

## 1. Version and install seam
- Installed: opencode v2.1.1 at /home/vscode/.opencode/bin/opencode [verified: opencode --version output].
- Install is unpinned by design: setup-dev.sh leaves VERSION unset so the installer resolves the latest release at build time [verified: .devcontainer/setup-dev.sh:39-51]. The CLI version can therefore drift on rebuild; no lockfile pins it.
- Plugin SDK packages are pinned separately and disagree: @opencode/plugin ^2.0.24 and @opencode-ai/sdk ^1.18.34 [verified: .opencode/package.json:12-13]; @opencode-ai/plugin 1.18.18 [verified: .opencode/.opencode/package.json:3].

## 2. Enablement
- No global code-mode key exists in the installed schema; the only switch is per-MCP-server codemode [verified: installed binary, Mcp.ServerConfig field, description "Expose this server's tools through Code Mode. Defaults to true."].
- Default is on; opt out by setting codemode: false on the server entry [verified: same schema field; https://opencode.ai/v2/docs/mcp-servers].
- V2 config shape is mcp.servers.<name>. The repo still declares the v1 flat shape mcp.gateway [verified: opencode.jsonc:89-94]; opencode debug config normalizes it to mcp.servers.gateway [verified: CLI output].
- Denying permission execute with resource * removes Code Mode and every tool reached only through it, including MCP tools from servers that did not set codemode: false [verified: binary gate uv("execute","*").effect !== "deny"; https://opencode.ai/v2/docs/tools/].
- The repo declares no execute permission entry today, only gateway_* entries [verified: opencode.jsonc:54-84].

## 3. Runtime surface
- Single tool: execute, input {code}, "Run JavaScript in a confined Code Mode runtime to script tool calls and HTTP requests and compose their results." [verified: installed binary tool description].
- Callable inside: the tools catalog, fetch, and an opencode namespace holding session/worktree/MCP-resource helpers [verified: installed binary tool description and pinned tool registrations].
- Not available inside: imports, direct filesystem access, timers [verified: installed binary tool description]. Network access is fetch only.
- Docs conflict on fetch: https://dev.opencode.ai/v2/docs/tools says the runtime has no fetch; https://opencode.ai/v2/docs/tools/ says it provides fetch; the installed 2.1.1 binary advertises fetch [verified: binary and both URLs]. Trust the binary for 2.1.1.

## 4. MCP addressing
- Call shape: tools.<normalizedServer>["<tool>"](args) [verified: execute description, "Call tools through tools using only exact paths and signatures from the catalog"].
- Server namespace normalization: replace(/[^a-zA-Z0-9_-]/g, "_") [verified: installed binary namespace function].
- The same character rule is applied to tool names when building the permission action: normalizedServer + "_" + normalizedTool [verified: installed binary].
- Concrete example (wrapper path, still works but no longer recommended): tools.gateway["code-mode"]({name: "serena-x", servers: ["serena"]}); the direct form is tools.gateway["list_memories"]({}) with a plain argument object [verified: this session's tool catalog; .opencode/instructions/serena-gateway.instructions.md:25].
- Permission action shape for MCP tools is server_tool with resource * [verified: installed binary; https://opencode.ai/v2/docs/tools/].

## 5. Context cost
- The injected catalog is namespace-level: a name plus a count per server, not full tool schemas [verified: installed binary catalog render and "New tool namespaces are available: name (N tools)" strings].
- Schemas are discovered on demand through a search function in the sandbox [verified: execute description, "returned by the search function"]; whether search actually works in 2.1.1 is [unverified]: issue https://github.com/anomalyco/opencode/issues/45349 reports the dispatcher missing it in 2.0.29, and I did not exercise it.
- Size ratio: roughly 1 line per namespace versus roughly 10-30 lines per tool schema, so cost scales with server count rather than method count [unverified: estimate, not measured on this repo].

## 6. Limits
- Output truncation uses config tool_output.max_lines and tool_output.max_bytes, schema description "Tool output truncation thresholds" [verified: opencode.jsonc:8-11; installed binary config schema]; repo values are 200 and 8192.
- Interpreter options maxToolCalls and maxOutputBytes default to 0 (unbounded) and are not exposed as config keys [verified: installed binary limits helper].
- No per-turn Code Mode call budget was found in schema or binary [unverified].

## 7. Mixed exposure of built-ins
- read, edit, glob and grep are registered with codemode: false, so they stay direct provider tools; session, worktree and MCP-resource helpers are registered with codemode: true, so they exist only in the catalog [verified: installed binary tool registrations].

## 8. Current double indirection
- The docker MCP gateway is one MCP server named gateway and ships its own code-mode tool, so native execute reaches tools.gateway["code-mode"], which creates a second JavaScript tool that then calls serena [verified: .opencode/instructions/serena-gateway.instructions.md:25,34; this session's tool catalog].
- That double indirection is now avoidable: bare upstream names such as tools.gateway["list_memories"]({}) address the tools directly in one layer, and the nested gateway-code-mode script is an optional legacy path [verified: this session].

## Cross-links
- Proposal: docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md
- Decision record: architecture/adr/ADR-013-native-code-mode-mcp-access. This note records supporting facts only; the ADR holds the decision.
## Correction (2026-10-23) — verified current position, supersedes the old three-wrapper claim
Under OpenCode v2.1.1 with the Docker MCP gateway, the gateway namespace holds 255 tools at session start and bare names are directly callable: `tools.gateway["list_memories"]({})`, `["read_memory"]`, `["find_symbol"]`, `["tavily_search"]`, `["get_file_contents"]` and `["write_file"]` all work with a plain argument object. No wrapper is needed — `list_memories({})` returns its memory-name JSON and `get_current_config({})` returns the serena config.

The earlier claim (in the withdrawn note `mem:researches/opencode/code-mode-gateway-addressing-falsified`) that the gateway declares only `code-mode`, `mcp-exec` and `mcp-find` is **historical and wrong**. It was an observation artefact: a wildcard `gateway_*` deny removes tools from the catalog, so a denied tool is invisible rather than merely blocked.

- The permission map filters the catalog. Each `gateway_<tool>` permission gates its own tool, and allowing `execute` does NOT grant these tools.
- The old `mcp-find` → gateway `code-mode` (per-server JS tool) → `mcp-exec` chain still exists and still works, but it is no longer the recommended path.
