<!-- Copy this file to create a new recipe. Fill in all <placeholders>. -->

# Recipe: <Recipe Name>

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `<server1>`, `<server2>` — what each provides |
| **When to use** | `<trigger conditions for reaching for this recipe>` |
| **Combines with** | `<related-recipe>` — `<how they compose (e.g., fetch data → store to memory)>` |

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `code_mode({"name": "<descriptive-sandbox-name>", "servers": ["<server1>", "<server2>"]})`

## Scripts

### <Action Name>

`<brief description of what this script does>`

```javascript
// <explain what this script does>
// Tool call pattern: <tool-name>({<key-params>})
// Response format: <what to expect back>
// Note: Use single quotes for all JS strings to avoid JSON escaping issues in mcp-exec

// For multi-line content, build with array-join pattern:
// var content = ['line1', 'line2'].join('\\n');

try {
  var result = <tool-name>({ '<param>': '<value>' });
  // <handle response>
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## Best practices

- `<practice 1>`
- `<practice 2>`

## Common pitfalls

- `<pitfall 1>`
- `<pitfall 2>`
