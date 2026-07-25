# Write Patterns for Serena Memory System

Proven patterns for writing memories to Serena, from single writes to structured hierarchies.

## 1. Single Memory Write

The simplest case: write one memory.

```javascript
var wm = globalThis["write_memory"];
var result = wm({
  memory_name: "my-topic/detail",
  content: "# My Topic

Detailed content here."
});
// result is plain text, NOT JSON. Check with:
if (result.indexOf("written") > -1) { /* success */ }
```

**Key points**:
- `write_memory` returns plain text (not JSON). Do NOT use `JSON.parse()`.
- Check success with `result.indexOf("written") > -1`.
- Always wrap in try/catch for error handling.

## 2. Batch Write with Hierarchy

Write an overview memory first, then child memories. The overview acts as a table of contents.

```javascript
// 1. Write the overview (parent)
wm({memory_name: "topic/overview", content: "# Topic See child memories below."});

// 2. Write child memories
wm({memory_name: "topic/child-a", content: "# Child A Details for child A."});
wm({memory_name: "topic/child-b", content: "# Child B Details for child B."});
```

**Benefits**:
- Discoverable via `list_memories(topic: "topic")`
- The overview provides a navigation hub with `mem:` links to children
- Children can reference each other and the parent

## 3. Append to Existing Memory

Use `max_chars` to append content to an existing memory:

```javascript
// First read the current content
var existing = rm({memory_name: "topic/memory"});

// Append with max_chars to avoid truncation
wm({
  memory_name: "topic/memory",
  content: existing + "

## Additional Section

New content here.",
  max_chars: 10000
});
```

**Note**: `write_memory` overwrites, so you must read the existing content and concatenate if you want to append.

## 4. Overview + Children Pattern

The standard pattern for a new topic group:

1. Write the overview: `topic/overview`
2. Write each child: `topic/child-1`, `topic/child-2`, etc.
3. Update the overview to include `mem:` links to children
4. Have each child link back: "See `mem:topic/overview` for context."

## Defensive Pattern

Always wrap writes in try/catch and validate:

```javascript
function safeWrite(name, content) {
  try {
    var result = wm({memory_name: name, content: content});
    if (result.indexOf("written") > -1) {
      return {ok: true, msg: result};
    }
    return {ok: false, msg: "Unexpected: " + result};
  } catch(e) {
    return {ok: false, msg: e.message};
  }
}
```

See `mem:skills/memory-system/overview` for tool reference.
See `mem:skills/memory-system/manage-patterns` for edit/rename/delete patterns.