# Recipe: Manage Memories

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `serena` |
| **When to use** | Needing to update, reorganize, or clean up existing memories |
| **Combines with** | [`store-memories`](store-memories.md) — creating new memories; [`collect-relevant-memories`](collect-relevant-memories.md) — finding which memories need management |

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `code_mode({"name": "memory-manage", "servers": ["serena"]})`

## Scripts

### Edit memory content (literal mode)

Replace specific text in a memory using exact string matching. Safer than regex mode — no special characters to escape.

```javascript
// Replace a specific text string in a memory.
// edit_memory returns plain text like "Memory <name> edited successfully."
var result = edit_memory({
  memory_name: "build-setup",
  needle: "`just typecheck` — Python type checking",
  repl: "`just typecheck` — Python type checking with mypy",
  mode: "literal"
});

if (typeof result === "string" && result.indexOf("edited successfully") > 0) {
  return "OK — " + result;
} else {
  return "Error editing memory: " + result;
}
```

To replace all occurrences of a literal string, set `allow_multiple_occurrences: true`:

```javascript
// Replace every occurrence of "example.com" with "example.org".
var result = edit_memory({
  memory_name: "deploy-config",
  needle: "example.com",
  repl: "example.org",
  mode: "literal",
  allow_multiple_occurrences: true
});

if (typeof result === "string" && result.indexOf("edited successfully") > 0) {
  return "OK — " + result;
} else {
  return "Error editing memory: " + result;
}
```

### Edit memory content (regex mode)

Use regular expressions for flexible search/replace. Useful when the exact text varies — for example, updating multiple version numbers or email addresses.

```javascript
// Replace version numbers matching a pattern.
// Regex mode matches varying content like "v1.2.3", "v2.0.1", etc.
var result = edit_memory({
  memory_name: "dependencies",
  needle: "v\\d+\\.\\d+\\.\\d+",
  repl: "v3.0.0",
  mode: "regex"
});

if (typeof result === "string" && result.indexOf("edited successfully") > 0) {
  return "OK — " + result;
} else {
  return "Error editing memory: " + result;
}
```

For multi-occurrence regex replacement, add `allow_multiple_occurrences: true`:

```javascript
// Replace all email addresses with a placeholder.
var result = edit_memory({
  memory_name: "contacts",
  needle: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  repl: "redacted@example.com",
  mode: "regex",
  allow_multiple_occurrences: true
});

if (typeof result === "string" && result.indexOf("edited successfully") > 0) {
  return "OK — " + result;
} else {
  return "Error editing memory: " + result;
}
```

### Rename a memory

Reorganize memory structure without losing content. Renaming preserves all `mem:` cross-references — Serena automatically updates references in other memories pointing to the old name.

```javascript
// Rename a memory from an old name to a new one.
// rename_memory returns plain text like "Memory renamed from X to Y."
var result = rename_memory({
  old_name: "auth/permissions",
  new_name: "auth/permissions/roles"
});

if (typeof result === "string" && result.indexOf("renamed from") > 0) {
  return "OK — " + result;
} else {
  return "Error renaming memory: " + result;
}
```

To move a memory to a different topic subtree, change the prefix:

```javascript
// Move a memory from one topic subtree to another.
var result = rename_memory({
  old_name: "auth/old-token-logic",
  new_name: "auth/tokens"
});

if (typeof result === "string" && result.indexOf("renamed from") > 0) {
  return "OK — " + result;
} else {
  return "Error renaming memory: " + result;
}
```

### Delete a memory

Permanently remove a memory file. Check that the memory exists first and verify its removal afterward.

```javascript
// Step 1: Confirm the memory exists by listing its parent topic.
const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};

var listResult = list_memories({ topic: "auth" });
var parsed = parseJson(listResult, "list_memories");
var memories = parsed.memories || [];
if (memories.indexOf("auth/legacy-config") < 0) {
  return "Memory auth/legacy-config not found — nothing to delete.";
}

// Step 2: Delete the memory.
// delete_memory returns plain text like "Memory <name> deleted."
var delResult = delete_memory({ memory_name: "auth/legacy-config" });
if (typeof delResult !== "string" || delResult.indexOf("deleted") < 0) {
  return "Delete failed: " + delResult;
}

// Step 3: Verify the memory is gone by listing again.
var verifyList = list_memories({ topic: "auth" });
var verifyParsed = parseJson(verifyList, "list_memories");
var remaining = verifyParsed.memories || [];
if (remaining.indexOf("auth/legacy-config") < 0) {
  return "OK — deleted auth/legacy-config. " + remaining.length + " memory(s) remain in auth/.";
} else {
  return "WARNING — delete reported success but memory still appears in listing.";
}
```

## Best practices

- **Check existence before acting** — use `read_memory` or `list_memories` to confirm a memory exists before editing, renaming, or deleting it.
- **Prefer literal mode over regex** — literal mode is safer because special characters need no escaping and there are no surprises from regex engine quirks.
- **Verify each operation** — check the return value for success substrings (`"edited successfully"`, `"renamed from"`, `"deleted"`) immediately after each call.
- **Rename instead of delete+rewrite** — renaming preserves `mem:` references in other memories. Delete+rewrite breaks those links.
- **Use hierarchical naming** — `topic/subtopic/name` keeps memories discoverable and makes rename moves intuitive.

## Common pitfalls

- `edit_memory` with `allow_multiple_occurrences: false` (default) replaces only the **first** match. To replace all occurrences, explicitly set `allow_multiple_occurrences: true`.
- Regex mode uses the tool's built-in regex engine — test your pattern on small content first by reading and inspecting the memory before editing.
- `delete_memory` is **permanent**. There is no undo. Always list the memory contents first if you might need the data later.
- `rename_memory` automatically updates `mem:` references in other memories, but does **not** update plain-text references (e.g., hand-written mentions of the old name).
- All tool calls must be **synchronous** — no `async/await`.
- Return values are plain text for most tools (`write_memory`, `read_memory`, `edit_memory`, `rename_memory`, `delete_memory`) — check for success substrings like `"written."`, `"edited successfully"`, `"renamed from"`, `"deleted"`.  
- **Exception**: `list_memories` returns a JSON string (`{"memories": [string, ...]}`) — use `JSON.parse` to access the `.memories` array.
- Memory names are **case-sensitive**. `Auth/Tokens` and `auth/tokens` are distinct memories.
- Error behavior differs by tool: `edit_memory` throws an exception (`FileNotFoundError`) when the memory doesn't exist, while `delete_memory` returns a plain-text error string (`"Memory <name> not found."`). Always wrap `edit_memory` in try/catch; for `delete_memory`, check the return value for `"not found"`.
