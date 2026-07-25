# Store Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-store`).

## Store a single memory

Writes a markdown document describing one concept.

```javascript
// Write a single memory about the application's build setup.
// Memory name maps to .serena/memories/build-setup.md
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

Write several granular memories for the same domain and cross-reference them. Each memory covers one concept. The `/` separator in memory names creates subdirectory structure inside `.serena/memories/`.

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

## Best practices

- **Use hierarchical naming** (`topic/subtopic/name`) so memories are discoverable by listing the directory structure under `.serena/memories/`. A flat list of names becomes unmanageable as the project grows.
- **Keep each memory granular** — one concept per file. If a memory describes both login flow and token expiry, split it into `auth/login` and `auth/tokens`.
- **Cross-reference with `mem:` prefix** so anyone reading one memory can navigate to related ones without searching. Serena has no semantic search — cross-references are the only navigation aid.
- **Start with an overview memory** that lists child memories and their cross-references. Treat it as a table of contents for a topic subtree.
- **Group related memories under shared topic prefixes**. For example, all auth-related memories under `auth/`, all API endpoint docs under `api/`.

## Common pitfalls

- Memory names are **case-sensitive**. `auth/Login` and `auth/login` are two distinct memories.
- The `/` character creates directory structure inside `.serena/memories/`. Do not use `/` in a plain memory name unless you intend to create a hierarchy.
- `write_memory` **overwrites** existing content. For partial updates, use `edit_memory` with `mode: "literal"` or `mode: "regex"`.
- Content **must be valid Markdown**. Non-Markdown content will render poorly when read back and may confuse downstream tools.
- All tool calls must be **synchronous** — no `async/await`.
- The return format of `read_memory` is not guaranteed — it may return plain Markdown or a JSON string wrapping the content. Always use the defensive `readMemoryContent` helper pattern shown above.
- `write_memory` returns plain text like `"Memory <name> written."`, not JSON. Do not call `JSON.parse` on its return value; check for the substring `"written."` to confirm success.
