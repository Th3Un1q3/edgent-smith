# MCP Tool Usage Instructions

## 1. Phase I - Discovery (The Search)
Identify capabilities missing from the active toolset.

* **Search Strategy:** Run `mcp_find` with broad keywords such as "web", "filesystem", or "sqlite".
* **Analysis:** Look at the `servers` array. Note each server's `name` and `description`.
* **Secret Awareness:** When respons contains "credential requires" it's purely informational and does not affect registration or usage.

## 2. Phase II - Registration (The Integration)
Add the chosen server to the session.

1. **Add Server:** Call `mcp_add(name: "SERVER_NAME", activate: true)`.
2. **Configure:** If the catalog provides a config schema, set it with `mcp_config_set(server: "SERVER_NAME", config: { … })`.

## 3. Phase III - Code‑Mode Activation (The Factory)
Create a multi‑tool scripting tool.

* **Factory Tool:** Use the `code_mode` utility.
* **Action:** Call `code_mode(name: "CUSTOM_NAME", servers: ["SERVER_1", "SERVER_2"])`.
* This call creates a new tool. Naming it `"context7"` yields the tool **`code-mode-context7`**; naming it `"web-search"` yields **`code-mode-web-search`**.
* **Naming Convention:** Choose clear, hyphen‑separated names like `data-processing` or `web-research`.

## 4. Phase IV - Execution (The Scripting)
Run the Code‑Mode tool with a JavaScript string.

### How to Execute
* **Direct Call:** Invoke the generated tool (e.g., `code-mode-context7`).
* **Input:** Provide a JSON object `{ "script": "…" }`.
* **Environment Rules**
  * Use only synchronous code - no `async` or `await`.
  * Variables do not persist between calls.
  * Tools from registered servers appear on `globalThis`.

### Script Template & Best Practices
For a task such as "Find the library ID for 'Next.js' and get its docs", write a script like:

```javascript
// Map tools safely
const resolveLibId = globalThis["resolve-library-id"];
const queryDocs   = globalThis["query-docs"];

// Resolve the library
const libInfo = resolveLibId({
  libraryName: 'Next.js',
  query: 'How to set up auth?'
});

// Extract the ID from the response
let libraryId = null;
const idMatch = libInfo.match(/Selected Library ID:\s*([^\s\n]+)/);
if (idMatch) {
  libraryId = idMatch[1];
} else {
  const fallback = libInfo.match(/(\/[a-zA-Z0-9.\-\/]+)/);
  if (fallback) libraryId = fallback[1];
}
if (!libraryId) return "ERROR: Could not parse ID: " + libInfo;

// Query the documentation
const docs = queryDocs({
  libraryId: libraryId,
  query: 'How to set up auth?'
});

return docs;
```

## 5. Agent Logic Tree (Example: Web Research Task)

**User Request:** "Search the web for the latest React docs and summarize them."

1. Discover: `mcp_find(query: "web")` → finds `tavily`.  
2. Register: `mcp_add(name: "tavily", activate: true)`.  
3. Initialize: `code_mode(name: "web-research", servers: ["tavily", "context7"])`.  
4. Identify: the tool `code-mode-web-research` appears.  
5. Execute: call `code-mode-web-research` with a script that
   * uses `globalThis["tavily"]` to search,
   * extracts URLs,
   * calls `globalThis["query-docs"]` on the top URL,
   * returns the summary.

## 6. Troubleshooting Protocol
* **ReferenceError (Tool Name):** You called a tool directly instead of via `globalThis`. Fix: use `globalThis["tool-name"]()`.
* **ReferenceError (Variable Name):** You tried to reuse a variable from a previous script. Fix: combine all logic into one script call.
* **Tool Not Found:** The server was omitted from the `servers` list in the `code_mode` call. Fix: re‑run `code_mode` with the correct list.
