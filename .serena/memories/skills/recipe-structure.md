# Recipe Structure for Context-Gathering Skill

The standard template for context-gathering skill recipes. All recipes live in the `recipes/` directory, shared workflows in `workflows/`.

## Template Format

Every recipe follows this structure:

### 1. Overview Table

```
| Aspect | Details |
|--------|---------|
| Servers | MCP servers required (e.g., serena, tavily) |
| When to use | Clear trigger conditions |
| Combines with | Related recipes or workflows |
```

The Overview table is the first section after the title. It tells the reader:

- **Servers**: Which MCP servers must be activated in the code-mode sandbox
- **When to use**: The precise conditions that make this recipe applicable
- **Combines with**: Related recipes that can be chained or referenced

### 2. Prerequisites

Links to setup and scripting workflows. Typically:

- `mem:workflows/setup` - discovering MCP servers and creating a code-mode sandbox
- `mem:workflows/scripting-workflow` - writing effective code-mode scripts

### 3. Scripts Section

The main body of the recipe. Contains:

- Synchronous JavaScript code snippets
- Try/catch blocks for error handling
- Comments explaining each step
- Expected return values and their formats

Scripts must be synchronous (no async/await). All tool calls are blocking.

### 4. Best Practices

A bullet list of proven techniques for using this recipe effectively.

### 5. Common Pitfalls

Known failure modes and how to avoid them. Examples:

- Using `JSON.parse()` on `write_memory` results (returns plain text, not JSON)
- Forgetting to wrap writes in try/catch
- Using `list_memories` output as a bare array (it returns a wrapped object)

## File Organization

```
skills/context-gathering/
  SKILL.md              (routing table: Triggers | Actions | Recipe columns)
  recipes/
    _template.md        (the template itself)
    store-memories.md
    collect-relevant-memories.md
    manage-memories.md
    ...
  workflows/
    setup.md
    scripting-workflow.md
    refinement-discovery.md
    ...
```

## Routing Table in SKILL.md

The SKILL.md entry point uses a three-column routing table:

| I want to... | Action | Recipe |
|--------------|--------|--------|
| Do X | Description of approach | link to recipe file |

See `mem:skills/memory-system/write-patterns` for writing strategies.
See `mem:skills/testing` for testing methodology.