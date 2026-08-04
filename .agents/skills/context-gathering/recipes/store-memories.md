# Store Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-store`).

## Store a single memory

Writes a markdown document describing one concept.

```javascript
// Write a single memory about the application's build setup.
var result = write_memory({
  memory_name: "build-setup",
  content: "# Build Setup\n\nThis project uses `just` as the task runner.\n\n- `just test` — run the unit test suite\n- `just lint` — static analysis and formatting checks\n- `just format` — code auto-formatting\n- `just typecheck` — Python type checking\n\n## Dependencies\n\nManaged via `uv`. Lockfile: `uv.lock`.\n"
});

// write_memory returns plain text like "Memory build-setup written."
// Check if it contains "written." to confirm success
if (typeof result === "string" && result.indexOf("written") > 0) {
  return "OK — " + result;
} else {
  return "Error writing memory: " + result;
}
```

## Store multiple interrelated memories with hierarchical naming

Write several granular memories for the same domain and cross-reference them. Each memory covers one concept. Use hierarchical naming with `/` separators (e.g., `auth/tokens`) to organize related memories.

```javascript
// 1. Overview memory — describes the module and links to child memories.
var overview = write_memory({
  memory_name: "auth/overview",
  content: [
    "# Authentication Module",
    "",
    "The auth module handles user authentication and authorization.",
    "",
    "## Memories",
    "",
    "- Login flow: mem:auth/login",
    "- Token management: mem:auth/tokens",
    "- Role-based permissions: mem:auth/permissions/roles",
  ].join("\n")
});

if (typeof overview !== "string" || overview.indexOf("written") < 0) { return "Error: " + overview; }

// 2. Login flow — specific to how users authenticate.
var login = write_memory({
  memory_name: "auth/login",
  content: [
    "# Login Flow",
    "",
    "Users authenticate via email + password or OAuth (GitHub, Google).",
    "",
    "## Endpoints",
    "",
    "- `POST /api/auth/login` — email/password login",
    "- `GET /api/auth/oauth/:provider` — OAuth redirect",
    "",
    "Token issuance is documented in mem:auth/tokens.",
  ].join("\n")
});

if (typeof login !== "string" || login.indexOf("written") < 0) { return "Error: " + login; }

// 3. Token management — JWT structure, expiry, refresh logic.
var tokens = write_memory({
  memory_name: "auth/tokens",
  content: [
    "# Token Management",
    "",
    "Access tokens are JWTs signed with RS256.",
    "",
    "- **Expiry**: 15 minutes (access), 7 days (refresh)",
    "- **Refresh**: `POST /api/auth/refresh` with valid refresh token",
    "",
    "Roles and scopes are documented in mem:auth/permissions/roles.",
  ].join("\n")
});

if (typeof tokens !== "string" || tokens.indexOf("written") < 0) { return "Error: " + tokens; }

// 4. Role-based permissions — hierarchical: auth/permissions/roles.
var roles = write_memory({
  memory_name: "auth/permissions/roles",
  content: [
    "# Roles & Permissions",
    "",
    "| Role | Permissions |",
    "|---|---|",
    "| `admin` | read, write, delete, manage_users |",
    "| `editor` | read, write |",
    "| `viewer` | read |",
    "",
    "See mem:auth/tokens for how roles are encoded in JWT claims.",
  ].join("\n")
});

if (typeof roles !== "string" || roles.indexOf("written") < 0) { return "Error: " + roles; }

return "OK — wrote auth/overview, auth/login, auth/tokens, auth/permissions/roles";
```

## Append to an existing memory

Use `write_memory` with `max_chars` to read, append content, and write back. Note that `edit_memory` (regex/literal replacement) is the preferred way for partial updates.

```javascript
// Helper: get memory content, handling both JSON-wrapped and plain-text returns
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

// Read the current memory content.
var currentContent = readMemoryContent("build-setup");

// Append a new section about deployment.
var updatedContent = currentContent + "\n\n## Deployment\n\n- Staging: `staging.example.com`\n- Production: `prod.example.com`\n- Deploy via `just deploy`\n";

// Write back with max_chars to cap the total size.
var writeResult = write_memory({
  memory_name: "build-setup",
  content: updatedContent,
  max_chars: 5000
});

// write_memory returns plain text like "Memory build-setup written."
// Check if it contains "written." to confirm success
if (typeof writeResult === "string" && writeResult.indexOf("written") > 0) {
  return "OK — appended deployment info, " + writeResult;
} else {
  return "Error writing memory: " + writeResult;
}
```

## Domain-Based Writing

When a domain grows beyond a single memory, use the **domain/about/index** convention to keep it navigable.

### Pre-Step: Check Existing Domains

Before creating any new domain, collect relevant memories from ALL existing domains and attempt to place new knowledge in an existing one. See [Memory Convention](../recipes/memory-convention.md) — "PRE-EXISTING DOMAINS FIRST" and [Memory Quality Checklist](../references/memory-quality.md).

```javascript
// List all existing domains to find the best fit
var allMemories = list_memories({});
// Parse to get domains, then read each domain's /about entry
// to find one whose scope covers the new knowledge.
```

Create a new domain ONLY when no existing domain can reasonably contain the new knowledge AND the knowledge is systematically useful.

### Steps

1. **Write or update `domain/about`** if adding a new domain. This entry describes the domain's scope and purpose. Use memory name `my-domain/about`.
2. **Write or update `domain/index`** to include the new memory in the table of contents. The index lists all topic memories in the domain with `mem:` cross-references. Memory name: `my-domain/index`.
3. **Write the topic memory** as `domain/topic-name`. Add `mem:` cross-references from the topic back to its domain index (e.g., `mem:my-domain/index`). Validate the memory against the [Memory Quality Checklist](../references/memory-quality.md) before writing.
4. **Add `mem:` cross-references** from the domain index to the new topic, and from the topic to the domain index.

### Example structure

Use memory names with hierarchical `/` separators:

| Memory Name | Purpose |
|---|---|
| `my-domain/about` | Domain scope overview |
| `my-domain/index` | Table of contents listing all topics |
| `my-domain/topic-name` | Individual topic memory |

## Domain Writing Template

Use this template when writing code-mode scripts that create or update domain memories with the serena tools.

### Creating a new domain

```javascript
// 1. Write the domain's about entry (memory name: my-domain/about)
var about = write_memory({
  memory_name: "my-domain/about",
  content: [
    "# My Domain",
    "",
    "Covers [domain purpose].",
    "",
    "## Subtopics",
    "",
    "- [Topic Name](mem:my-domain/topic-name)"
  ].join("\n")
});

if (typeof about !== "string" || about.indexOf("written") < 0) {
  return "Error writing about: " + about;
}

// 2. Write the domain's index entry (memory name: my-domain/index)
var index = write_memory({
  memory_name: "my-domain/index",
  content: [
    "# My Domain Index",
    "",
    "| Topic | Description |",
    "|---|---|",
    "| [topic-name](mem:my-domain/topic-name) | Brief description of the topic |"
  ].join("\n")
});

if (typeof index !== "string" || index.indexOf("written") < 0) {
  return "Error writing index: " + index;
}
```

### Adding a memory to an existing domain

```javascript
// Helper: read memory content defensively
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

// 1. Read the existing domain index
var currentIndex = readMemoryContent("my-domain/index");

// 2. Append the new topic entry to the index
var updatedIndex = currentIndex + "\n| [new-topic](mem:my-domain/new-topic) | Description of new topic |";

// 3. Write the updated index back
var indexResult = write_memory({
  memory_name: "my-domain/index",
  content: updatedIndex,
  max_chars: 5000
});

if (typeof indexResult !== "string" || indexResult.indexOf("written") < 0) {
  return "Error updating index: " + indexResult;
}

// 4. Write the new topic memory with a cross-reference to the domain index
var topic = write_memory({
  memory_name: "my-domain/new-topic",
  content: [
    "# New Topic",
    "",
    "Content about the new topic.",
    "",
    "See mem:my-domain/index for an overview of all domain topics."
  ].join("\n")
});

if (typeof topic !== "string" || topic.indexOf("written") < 0) {
  return "Error writing topic: " + topic;
}

return "OK — added new-topic to my-domain";
```

### Defensive write pattern with serena tools

Wrap every `write_memory` call with a success check. `write_memory` returns plain text like `"Memory <name> written."` — not JSON. Do not call `JSON.parse` on its return value.

```javascript
function writeMemoryDefensive(name, content, maxChars) {
  var opts = { memory_name: name, content: content };
  if (maxChars) { opts.max_chars = maxChars; }
  var result = write_memory(opts);
  if (typeof result !== "string" || result.indexOf("written") < 0) {
    return { ok: false, error: "Failed to write memory " + name + ": " + result };
  }
  return { ok: true, message: result };
}

var r = writeMemoryDefensive("my-domain/topic", "# Topic\n\nContent here.\n");
if (!r.ok) { return r.error; }
```

## Best practices

- **Use hierarchical naming** (`topic/subtopic/name`) so memories are discoverable via `list_memories({ topic: "..." })`. A flat list of names becomes unmanageable as the project grows.
- **Keep each memory granular** — one concept per file. If a memory describes both login flow and token expiry, split it into `auth/login` and `auth/tokens`.
- **Cross-reference with `mem:` prefix** so anyone reading one memory can navigate to related ones without searching. Serena has no semantic search — cross-references are the only navigation aid.
- **Start with an overview memory** that lists child memories and their cross-references. Treat it as a table of contents for a topic subtree.
- **Group related memories under shared topic prefixes**. For example, all auth-related memories under `auth/`, all API endpoint docs under `api/`.

## Common pitfalls

- Memory names are **case-sensitive**. `auth/Login` and `auth/login` are two distinct memories.
- The `/` character creates hierarchical memory names. Do not use `/` in a plain memory name unless you intend to create a hierarchy.
- `write_memory` **overwrites** existing content. For partial updates, use `edit_memory` with `mode: "literal"` or `mode: "regex"`.
- Content **must be valid Markdown**. Non-Markdown content will render poorly when read back and may confuse downstream tools.
- All tool calls must be **synchronous** — no `async/await`.
- The return format of `read_memory` is not guaranteed — it may return plain Markdown or a JSON string wrapping the content. Always use the defensive `readMemoryContent` helper pattern shown above.
- `write_memory` returns plain text like `"Memory <name> written."`, not JSON. Do not call `JSON.parse` on its return value; check for the substring `"written."` to confirm success.
