# Serena Memory System Overview

Serena provides 6 tools for persistent memory storage. Memories are stored as plain Markdown files in `.serena/memories/`. There is no semantic search - discovery relies on `list_memories` and navigation via `mem:` cross-references.

## The 6 Tools

### write_memory
- **Parameters**: `memory_name` (string), `content` (string), `max_chars` (optional int)
- **Returns**: Plain text string (NOT JSON). Contains the word "written" on success.
- **Note**: Do NOT use `JSON.parse()` on the result. Check with `result.indexOf("written") > -1`.

### read_memory
- **Parameters**: `memory_name` (string)
- **Returns**: The memory content as a string.
- **Behavior**: Does NOT throw on missing memory - returns an error string instead.

### list_memories
- **Parameters**: `topic` (optional string - filters by prefix)
- **Returns**: JSON string (not bare array). Parses as `{ memories: [...] }` or similar wrapped structure.
- **Note**: Must use `JSON.parse()` to read; the top-level is an object, not an array.

### edit_memory
- **Parameters**: `memory_name`, `needle` (string), `repl` (string), `mode` (literal|regex), `allow_multiple_occurrences` (optional bool)
- **Returns**: Success message on completion.
- **Behavior**: Throws FileNotFoundError if needle is not found or memory does not exist.

### rename_memory
- **Parameters**: `old_name`, `new_name`
- **Returns**: Success message.
- **Side effect**: Automatically updates `mem:` references in other memories pointing to the old name.

### delete_memory
- **Parameters**: `memory_name`
- **Returns**: Error string (not thrown as exception) if memory does not exist.
- **Behavior**: Returns a string describing the error rather than throwing.

## Key Limitations
- No semantic search - only prefix-based filtering via `list_memories(topic: "prefix")`
- No bulk operations - each write/read/edit/delete is a single call
- No atomic transactions - write one memory at a time

## Best Practices
- Use hierarchical naming with `/` for topic grouping (e.g., `skills/memory-system/conventions`)
- Use `mem:memory-name` in content for cross-references
- Keep memories granular - one concept per memory

See `mem:skills/memory-system/conventions` for detailed naming rules.