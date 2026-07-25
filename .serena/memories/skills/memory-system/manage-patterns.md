# Manage Patterns for Serena Memory System

Patterns for editing, renaming, and deleting memories with proper guards.

## 1. Edit with Literal Mode

Replace a single exact string in a memory. Use when you know the exact text to change.

```javascript
var em = globalThis["edit_memory"];
try {
  var result = em({
    memory_name: "topic/memory",
    needle: "Old text to replace",
    repl: "New replacement text",
    mode: "literal"
  });
  // On success: returns success message
} catch(e) {
  // On failure: throws FileNotFoundError
  // Handle: memory not found or needle not found
  console.error("Edit failed: " + e.message);
}
```

**Key points**:
- `edit_memory` THROWS on failure (FileNotFoundError).
- Unlike `read_memory` (returns error string) and `delete_memory` (returns error string).
- Always wrap in try/catch.

## 2. Edit with Regex Mode

Replace patterns across a memory using regex. Use `allow_multiple_occurrences` for multi-replace.

```javascript
try {
  var result = em({
    memory_name: "topic/memory",
    needle: "section\d+",
    repl: "section",
    mode: "regex",
    allow_multiple_occurrences: true
  });
} catch(e) {
  // Handle failure
}
```

**Caution**: If `allow_multiple_occurrences` is false (default) and multiple matches exist, edit_memory throws.

## 3. Rename Memory

Rename or move a memory in the hierarchy. Automatically updates `mem:` references.

```javascript
var rnm = globalThis["rename_memory"];
try {
  var result = rnm({
    old_name: "topic/old-name",
    new_name: "topic/new-name"
  });
  // Also moves subtopics: renaming "topic" to "new-topic"
  // makes "topic/child" become "new-topic/child"
} catch(e) {
  // Handle failure
}
```

**Side effects**:
- All `mem:topic/old-name` references in other memories become `mem:topic/new-name`.
- Read-only memories are NOT updated.

## 4. Delete Memory with Guard

Always check existence before deleting, because delete_memory returns errors as strings (not throws).

```javascript
var dm = globalThis["delete_memory"];
var rm = globalThis["read_memory"];

// Step 1: Verify memory exists
var check = rm({memory_name: "topic/memory"});
if (check.indexOf("Error") === 0) {
  // Memory does not exist, no need to delete
  return;
}

// Step 2: Delete
var result = dm({memory_name: "topic/memory"});
// result is a string - check if it indicates success

// Step 3: Verify deletion
var verify = rm({memory_name: "topic/memory"});
if (verify.indexOf("Error") === 0) {
  // Confirmed deleted
} else {
  // Still exists - deletion may have failed silently
}
```

## Error Behavior Summary

| Operation | On Missing Memory | On Other Failure |
|-----------|------------------|------------------|
| `read_memory` | Returns error string (no throw) | Returns error string |
| `edit_memory` | Throws FileNotFoundError | Throws FileNotFoundError |
| `delete_memory` | Returns error string (no throw) | Returns error string |
| `rename_memory` | Throws error | Throws error |

## Best Practices

1. Always wrap edit/rename/delete in try/catch
2. Before deleting, verify memory exists via read_memory
3. After deleting, verify removal via read_memory
4. When editing with regex, test the pattern on a copy first
5. Use literal mode for single targeted changes, regex for bulk updates

See `mem:skills/memory-system/write-patterns` for write strategies.
See `mem:skills/memory-system/overview` for tool reference.