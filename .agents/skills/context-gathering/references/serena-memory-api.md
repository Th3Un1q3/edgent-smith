# Reference: Serena Memory API — Helpers & Return Formats

Canonical helper functions and return formats for scripting the **serena** MCP server in code-mode. The recipes point here instead of re-defining the helpers, so there is a single source of truth. All tool calls must be **synchronous** — no `async`/`await`.

## parseJson(str, label)

`list_memories` returns a JSON **string**, not an array. Parse it defensively with a label naming the tool so errors are diagnosable:

```javascript
const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};
```

## readMemoryContent(name)

`read_memory` may return plain Markdown **or** a JSON string wrapping the content, and it does NOT throw on a missing memory — it returns an error string. Two documented variants; pick the one matching the recipe:

**Variant (a) — returns the content string; throws on "not found"** (use when a missing memory is an error worth surfacing):

```javascript
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (raw.indexOf("not found") >= 0) {
    throw new Error("Memory not found: " + name);
  }
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}
```

**Variant (b) — returns `null` on "not found"** (use when a missing memory is a normal condition, e.g., validation):

```javascript
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (typeof raw === "string" && raw.indexOf("not found") >= 0) return null;
  try { var parsed = JSON.parse(raw); return parsed.content || raw; } catch (e) { return raw; }
}
```

## Return-Format Table

| Tool | Success substring | Notes |
|---|---|---|
| `write_memory` | `"written."` | Plain text like `"Memory <name> written."` — do NOT `JSON.parse` it; check `result.indexOf("written") > 0` |
| `edit_memory` | `"edited successfully"` | Plain text; throws an exception (`FileNotFoundError`) when the memory does not exist — wrap in try/catch |
| `rename_memory` | `"renamed from"` | Plain text |
| `delete_memory` | `"deleted"` | Plain text; a missing memory returns an error string containing `"not found"` — check the return value |
| `list_memories` | — | Returns a JSON string whose `.memories` is an array of plain name strings; parse with `parseJson` |

Note the asymmetry: `edit_memory` throws on a missing memory, while `delete_memory` returns a plain-text error string. A generic success check (e.g., `ok(res)` returning true when the string contains `"written"` or `"edited"`) works for `write_memory` and `edit_memory`; `rename_memory` and `delete_memory` need their own substrings.

## writeMemoryDefensive(name, content, maxChars)

Success-checked `write_memory` wrapper. Returns a result object instead of a raw string, so callers never parse `write_memory` output themselves. On success returns `{ ok: true, result: <raw string> }`; on failure returns `{ ok: false, error: <message> }`. `maxChars` is optional — omit it to write without a size cap:

```javascript
function writeMemoryDefensive(name, content, maxChars) {
  var params = { memory_name: name, content: content };
  if (maxChars !== undefined) { params.max_chars = maxChars; }
  try {
    var result = write_memory(params);
    if (typeof result === "string" && result.indexOf("written") > 0) {
      return { ok: true, result: result };
    }
    return { ok: false, error: "write_memory did not confirm write: " + result };
  } catch (e) {
    return { ok: false, error: "write_memory threw: " + e.message };
  }
}
```

## Common Pitfalls

- All tool calls must be **synchronous** — no `async`/`await`; variables do not persist between `mcp_exec` calls.
- `read_memory` return format is not guaranteed — always go through `readMemoryContent`.
- `list_memories` topic filtering is **prefix-based** and case-sensitive.
- Memory names are **case-sensitive** (`auth/Login` and `auth/login` are distinct memories).
- `write_memory` **overwrites** existing content — for partial updates use `edit_memory` with `mode: "literal"` or `mode: "regex"`.
