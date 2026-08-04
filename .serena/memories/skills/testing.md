# Testing Methodology for Skills

Live-testing approach for verifying skill recipes, MCP server interactions, and memory operations against real servers.

## Core Principles

1. **Test against actual servers**: Never assume API behavior. Test every script against the real MCP server.
2. **Check actual return formats**: Documented behavior may differ from reality. Verify return types (JSON string vs plain text, array vs wrapped object).
3. **Anti-cheat validation**: Independently verify results using a different tool or path.
4. **Iterate on findings**: When a test reveals unexpected behavior, fix the recipe and re-test.

## Live-Testing Methodology

### Step 1: Write the test script

```javascript
// Test write_memory return format
var wm = globalThis["write_memory"];
var result = wm({memory_name: "test/foo", content: "Test content"});
// Is it JSON? Try parsing:
try { JSON.parse(result); } catch(e) { /* It's plain text! */ }
```

### Step 2: Execute against real server

Run the script via code-mode sandbox. Observe the actual output.

### Step 3: Anti-cheat verification

Verify results using a different method:

```javascript
// After writing, verify by reading
var rm = globalThis["read_memory"];
var readback = rm({memory_name: "test/foo"});
if (readback.indexOf("Test content") > -1) {
  // Confirmed written correctly
}

// After deleting, verify removal
var check = rm({memory_name: "test/foo"});
if (check.indexOf("Error") === 0) {
  // Confirmed deleted
}
```

### Step 4: Iterate

If the real behavior differs from assumptions:

1. Document the actual behavior in the recipe
2. Fix the recipe code to handle the real format
3. Re-test to confirm the fix

## Key Discoveries from Live Testing

Return-format and error behavior of the memory tools is documented in `recipes/store-memories.md` and `recipes/manage-memories.md` in the context-gathering skill.

## Anti-Cheat Patterns

- **Write then read**: After writing a memory, immediately read it back and verify content matches.
- **Delete then read**: After deleting, read to verify the memory is gone.
- **Cross-tool verification**: Verify memory operations using both read_memory and list_memories.
- **Independent assertion**: Never trust that the tool's success message is sufficient. Verify with a separate call.