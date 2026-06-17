# Workflow: Scripting with Code-Mode

Follow this workflow to create and execute multi-tool JavaScript scripts using the `code_mode` environment.

## Steps

1. **Tool Registration**: Ensure all required MCP servers are added to the session (see `workflows/setup-and-discover.md`).
2. **Initialize Code-Mode**: Create the multi-tool scripting tool using `code_mode`.
   - Provide a unique name and a list of active server names.
   - *Example*: `code_mode(name: "web-research", servers: ["tavily", "context7"])`
3. **Identify Tool Handles**: Note that tools appear on `globalThis` with a hyphenated name based on the server name and tool name.
   - *Example*: Server `context7` tool `query-docs` becomes `globalThis["query-docs"]`.
4. **Write Script**: Construct a synchronous JavaScript string.
   - **Rule**: Do NOT use `async` or `await`.
   - **Rule**: Variables do not persist between script calls.
   - **Rule**: Use `globalThis` to access tools.
5. **Execute Script**: Call the generated tool with the `{ "script": "..." }` JSON object.

## Examples

**Scenario**: Find a library ID and fetch its documentation.

```javascript
// Step 1: Initialize (done in your session)
code_mode(name: "doc-fetcher", servers: ["context7"])

// Step 2: Execute
call code-mode-doc-fetcher({
  script: `
    const resolveLibId = globalThis["resolve-library-id"];
    const queryDocs   = globalThis["query-docs"];

    const libInfo = resolveLibId({
      libraryName: 'Next.js',
      query: 'How to set up auth?'
    });

    let libraryId = null;
    const idMatch = libInfo.match(/Selected Library ID:\s*([^\s\n]+)/);
    if (idMatch) {
      libraryId = idMatch[1];
    } else {
      const fallback = libInfo.match(/(\/[a-zA-Z0-9.\-\/]+)/);
      if (fallback) libraryId = fallback[1];
    }

    if (!libraryId) return "ERROR: Could not parse ID: " + libInfo;

    const docs = queryDocs({
      libraryId: libraryId,
      query: 'How to set up auth?'
    });

    return docs;
  `
});
```

## Clarification Triggers

Ask the user before proceeding if:
- The script is returning a `ReferenceError` for a tool name (ensure the tool is in the `servers` list in the `code_mode` call).
- The user is trying to use `await` or `async` (remind them that scripts must be synchronous).
- The user wants to persist variables between multiple script executions (explain that they must be combined into a single script).
