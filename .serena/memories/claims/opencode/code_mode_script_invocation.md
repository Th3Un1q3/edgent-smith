---
id: claims/opencode/code_mode_script_invocation
type: claims
L0: "code-mode is addressed as code-mode-<name> and takes arguments.script; await breaks inside the wrapper, tool identifiers resolve only at top level, and MCP returns may be JSON strings"
hotness: 0.8
ttl: 60d
version: 1
freshness: 2026-10-23
directory: claims/opencode
confidence: 0.9
status: active
provenance: live gateway session 2026-10-23, confirmed by read-back
---

# code_mode_script_invocation

fact: `gateway_code-mode({name, servers})` creates a session tool addressed as `code-mode-<name>`; call it through `gateway_mcp-exec` with the program under `arguments.script`. Inside the wrapper: `await` is a syntax error, tool identifiers (`read_memory`, `list_memories`, `write_memory`) resolve only as top-level script statements and not inside `try`/`catch` or callbacks, and the program must be a single line. Server tools are synchronous; `list_memories` and `read_memory` return JSON strings, so `JSON.parse` before reading fields.

scope: Any agent scripting the Docker MCP Gateway code-mode sandbox in this harness.

evidence: `return JSON.stringify(await list_memories({}))` failed with "SyntaxError: Unexpected identifier"; the same call without `await` returned a string containing `{"memories": [...]}`. A `read_memory` call placed inside `try` failed with "Unknown identifier 'read_memory'" while the identical top-level call succeeded. Invoking `mcp-exec` with `name: "list_memories"` returned "Tool not found in current session".

rule: Build the program as one line, bind results with top-level `var`, drop `await`, and address the sandbox as `code-mode-<name>`. Compose content with `JSON.stringify` so nested newlines survive.

Source: live session 2026-10-23; observed error strings above.