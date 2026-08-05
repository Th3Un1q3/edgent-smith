# Store Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-store`).
Serena memories are gateway-only: never read `.serena/memories/*` on disk — the `read` tool is denied there, and bypassing it (cat/sed/shell) is prohibited.

## BLOCKING GATE — Run Before Any `write_memory`

If ANY box is unchecked, DO NOT WRITE. Fix the item or skip the write. Writing with an unchecked box corrupts the store.

The 6 checks and the AFTER-WRITING verify step live in the [Memory Management Checklist](../references/memory-management-checklist.md) — open it and run the gate before EVERY write (including edits and rewrites; for a batch of related memories, run it once on the planned set, then verify the set).

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
// Helper: readMemoryContent / parseJson / success checks — see ../references/serena-memory-api.md

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

## Batch multiple writes in one call

Prefer ONE `mcp-exec` call for a fixed batch of related writes (several memories in a
domain, or a domain `about` plus its topic memories). Batching saves round trips and context: one script,
one per-memory status report, no intermediate returns to inspect. Each write gets its own
defensive check, and a failure does NOT abort sibling writes — the script continues and
reports per-memory status so a retry re-sends only the failed operation.

```javascript
// Helper: ok() success checks — see ../references/serena-memory-api.md
var report = [];
function w(name, content) {
  try {
    var r = write_memory({ memory_name: name, content: content });
    report.push((ok(r) ? 'OK   ' : 'FAIL ') + name + ': ' + r);
    return ok(r);
  } catch (e) { report.push('ERROR ' + name + ': ' + e.message); return false; }
}
function e(name, mode, needle, repl) {
  try {
    var r = edit_memory({ memory_name: name, mode: mode, needle: needle, repl: repl });
    report.push((ok(r) ? 'OK   ' : 'FAIL ') + name + ': ' + r);
    return ok(r);
  } catch (e) { report.push('ERROR ' + name + ': ' + e.message); return false; }
}

// 0. ensure/update the domain about (description + scope + boundaries)
w('my-domain/about', ['# My Domain', '', 'Covers [domain purpose].', '', '## Scope', '', '- What belongs in this domain.', '', '## Boundaries (out of scope)', '', '- What does not belong here — overlap rules with sibling domains.'].join('\n'));

// 1. write topic memories with self-describing <domain>/<subdomain>/<topic> names
w('my-domain/general/topic-a', ['# Topic A', '', 'Content about A.'].join('\n'));
w('my-domain/general/topic-b', ['# Topic B', '', 'Content about B.', '', 'Related: mem:my-domain/general/topic-a.'].join('\n'));

// 2. add mem: cross-references between related memories where useful
e('my-domain/general/topic-a', 'literal', 'Content about A.', 'Content about A. See mem:my-domain/general/topic-b.');

// 3. return the per-memory status report — never abort the batch on one failure
return report.join('\n');
```

Notes:
- Write the domain `about` before topic memories so the domain is always documented.
- Split into separate calls only when debugging a failing write, or when a later call depends on an earlier call's output.

## Domain-Based Writing

When a domain grows beyond a single memory, use the **domain/about** convention (defined in [Memory Convention](../references/memory-convention.md)): every domain has one `about` (description, scope, boundaries; not a table of contents; no index memory) — write it before topic memories.

### Pre-Step: Check Existing Domains

PRE-EXISTING DOMAINS FIRST (rule + steps in [Memory Convention](../references/memory-convention.md)): before creating a new domain, collect relevant memories from ALL existing domains and place the knowledge in the best fit. Create a new domain ONLY when no existing domain can reasonably contain the knowledge AND it is systematically useful.

### Steps

1. **Write or update `domain/about`** — the `about` must describe the domain, its SCOPE (what belongs), and BOUNDARIES (what does not belong). The `about` is the domain's single entry point. Use memory name `my-domain/about`.
2. **Write the topic memory** as `<domain>/<subdomain>/<topic>` with a self-describing, action-oriented name (e.g., `troubleshooting/software/finding-known-github-issues`). Run the [BLOCKING GATE](../references/memory-management-checklist.md) before writing.
3. **Add `mem:` cross-references** between related memories where useful.

### Example structure

Use memory names with hierarchical `/` separators:

| Memory Name | Purpose |
|---|---|
| `my-domain/about` | Domain scope + boundaries |
| `my-domain/<subdomain>/<topic>` | Self-describing topic memory (e.g., testing/typescript/mutation-testing) |

## Domain Writing Template

Use this template when writing code-mode scripts that create or update domain memories with the serena tools.

### Creating a new domain

```javascript
// 1. Write the domain's about entry (memory name: my-domain/about) — description + scope + boundaries
var about = write_memory({
  memory_name: "my-domain/about",
  content: [
    "# My Domain",
    "",
    "Covers [domain purpose].",
    "",
    "## Scope",
    "",
    "- What belongs in this domain.",
    "",
    "## Boundaries (out of scope)",
    "",
    "- What does not belong here — overlap rules with sibling domains."
  ].join("\n")
});

if (typeof about !== "string" || about.indexOf("written") < 0) {
  return "Error writing about: " + about;
}

// 2. Write topic memories with self-describing <domain>/<subdomain>/<topic> names
var topic = write_memory({
  memory_name: "my-domain/general/topic-name",
  content: [
    "# Topic Name",
    "",
    "Content about the topic.",
    "",
    "Related: mem:my-domain/general/other-topic."
  ].join("\n")
});

if (typeof topic !== "string" || topic.indexOf("written") < 0) {
  return "Error writing topic: " + topic;
}
```

### Adding a memory to an existing domain

```javascript
// Helper: readMemoryContent / parseJson / success checks — see ../references/serena-memory-api.md

// 1. Check the domain about's scope and boundaries before placing the new memory
var about = readMemoryContent("my-domain/about");

// 2. Write the new topic memory with a self-describing <domain>/<subdomain>/<topic> name
var topic = write_memory({
  memory_name: "my-domain/general/new-topic",
  content: [
    "# New Topic",
    "",
    "Content about the new topic.",
    "",
    "Related: mem:my-domain/general/other-topic."
  ].join("\n")
});

if (typeof topic !== "string" || topic.indexOf("written") < 0) {
  return "Error writing topic: " + topic;
}

// 3. Update the domain about if the new memory changes the domain's scope or boundaries
var updatedAbout = about + "\n\n- New topic extends the scope to cover ...";
var aboutResult = write_memory({
  memory_name: "my-domain/about",
  content: updatedAbout,
  max_chars: 5000
});

if (typeof aboutResult !== "string" || aboutResult.indexOf("written") < 0) {
  return "Error updating about: " + aboutResult;
}

return "OK — added new-topic to my-domain";
```

### Defensive write pattern with serena tools

Wrap every `write_memory` call with a success check. `write_memory` returns plain text like `"Memory <name> written."` — not JSON. Do not call `JSON.parse` on its return value.

```javascript
// Helper: writeMemoryDefensive(name, content, maxChars) — success-checked write wrapper; see ../references/serena-memory-api.md
var r = writeMemoryDefensive("my-domain/topic", "# Topic\n\nContent here.\n");
if (!r.ok) { return r.error; }
```

For `edit_memory` (literal/regex partial updates), the success string is `"...edited successfully."`, not `"written."` — check `res.indexOf('edited') >= 0` (the `ok()` helper in "Batch multiple writes in one call" handles both).

## Best practices

- **Use schema-driven self-describing naming** — `<domain>/<subdomain>/<topic>`, action-oriented, judgeable from the list (rule + examples in [Memory Convention](../references/memory-convention.md)).
- **Keep each memory granular** — one concept per file. If a memory describes both login flow and token expiry, split it into `auth/login` and `auth/tokens`.
- **Cross-reference with `mem:` prefix** so anyone reading one memory can navigate to related ones without searching. Serena has no semantic search — cross-references are the only navigation aid.
- **Start with an overview memory** that lists child memories and their cross-references. Treat it as a table of contents for a topic subtree.
- **Group related topics under shared subdomain prefixes** (e.g., `testing/typescript/*`). A flat list of names becomes unmanageable as the project grows.
- **Prefer one `mcp-exec` call for a batch of related writes** (e.g., a domain `about` plus its topic memories): fewer round trips, one per-memory status report, no intermediate returns. Each write gets its own defensive check and a failure does not abort siblings — split calls only when debugging a failing write.

## Common pitfalls

- Memory names are **case-sensitive**. `auth/Login` and `auth/login` are two distinct memories.
- The `/` character creates hierarchical memory names. Do not use `/` in a plain memory name unless you intend to create a hierarchy.
- `write_memory` **overwrites** existing content. For partial updates, use `edit_memory` with `mode: "literal"` or `mode: "regex"`.
- Content **must be valid Markdown**. Non-Markdown content will render poorly when read back and may confuse downstream tools.
- All tool calls must be **synchronous** — no `async/await`.
- The return format of `read_memory` is not guaranteed — it may return plain Markdown or a JSON string wrapping the content. Always use the defensive `readMemoryContent` helper pattern shown above.
- `write_memory` returns plain text like `"Memory <name> written."`, not JSON. Do not call `JSON.parse` on its return value; check for the substring `"written."` to confirm success.
