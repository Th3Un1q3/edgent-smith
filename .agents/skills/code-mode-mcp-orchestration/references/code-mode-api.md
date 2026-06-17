# Reference: Code-Mode API & Environment Rules

Technical reference for using the `code_mode` utility and its environment constraints.

## Tool Initialization

Use the `code_mode` tool to create a multi-tool scripting environment.

**Syntax:**
`code_mode(name: "CUSTOM_NAME", servers: ["SERVER_1", "SERVER_2", ...])`

**Naming Convention:**
The resulting tool will be named `code-mode-CUSTOM_NAME`.
Tools from registered servers appear on `globalThis` as `globalThis["tool-name"]`.

## Environment Constraints

To ensure reliability in the multi-tool scripting sandbox, the following rules apply:

| Constraint | Requirement | Reason |
|---|---|---|
| **Concurrency** | Synchronous only | The environment does not support `async` or `await`. |
| **Persistence** | No state persistence | Variables do not persist between separate tool calls. |
| **Tool Access** | `globalThis` | Tools must be accessed via `globalThis` to ensure proper mapping. |
| **Error Handling** | Script-level | Handle errors within the script string to avoid sandbox crashes. |

## Example Logic Tree

**User Request**: "Search the web for React docs and summarize them."

1. **Discovery**: `mcp_find(query: "web")` $\rightarrow$ finds `tavily` server.
2. **Initialization**: `code_mode(name: "web-research", servers: ["tavily"])` creates an environment with all tools from the specified servers. Describes the tools available from `tavily` (e.g., `tavily_search`, `tavily_extract`).
3. **Execution**: Call `mcp-exec` with a script that:
   - Uses `globalThis["tavily_search"]` to search.
   - Extracts URLs.
   - Returns the summary.
