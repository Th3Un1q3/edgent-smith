# Store Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-store`).
Serena memories are gateway-only: never read `.serena/memories/*` on disk — the `read` tool is denied there, and bypassing it (cat/sed/shell) is prohibited.

**Prerequisite: load [references/serena-memory-api.md](../references/serena-memory-api.md) first — it defines the helper scripts (`readMemoryContent`, `parseJson`, etc.) this recipe uses.**

Follow the [Setup workflow](../workflows/setup.md) and [Scripting workflow](../workflows/scripting-workflow.md) before using this recipe.

## BLOCKING GATE — Run Before Any `write_memory`

If ANY box is unchecked, DO NOT WRITE. Fix the item or skip the write. Writing with an unchecked box corrupts the store.

The 7 checks and the AFTER-WRITING verify step live in the [Memory Management Checklist](../references/memory-management-checklist.md) — open it and run the gate before EVERY content write or edit (`write_memory` and `edit_memory`, including rewrites and appends; for a batch of related memories, run it once on the planned set, then verify the set). Renames and deletes skip the full gate but must keep the domain consistent (see [manage-memories](manage-memories.md)).

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
// 1. Login flow — specific to how users authenticate.
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

// 2. Token management — JWT structure, expiry, refresh logic.
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

// 3. Role-based permissions — hierarchical: auth/permissions/roles.
// Cross-references form a one-directional chain (login -> tokens -> roles).
// No backlink (roles -> tokens): memory-convention.md forbids circular
// references (A -> B -> A) — pick one primary direction.
var roles = write_memory({
  memory_name: "auth/permissions/roles",
  content: [
    "# Roles & Permissions",
    "",
    "| Role | Permissions |",
    "|---|---|",
    "| `admin` | read, write, delete, manage_users |",
    "| `editor` | read, write |",
    "| `viewer` | read |"
  ].join("\n")
});

if (typeof roles !== "string" || roles.indexOf("written") < 0) { return "Error: " + roles; }

// No auth/overview at the domain root: auth is a domain with root-level topics
// and no topic has children, so the overview rule does not apply (see
// references/memory-convention.md). Topic-to-topic mem: references navigate the set.
return "OK — wrote auth/login, auth/tokens, auth/permissions/roles";
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

// 0. ensure the domain about (description + scope + boundaries) — write it ONLY
//    when ABSENT: list_memories topic filtering is PREFIX-based — an exact-name
//    lookup ({topic: 'my-domain/about'}) returns {} and never matches; list the
//    DOMAIN PREFIX and test membership instead. New-domain creation never
//    overwrites an existing about (see "Creating a new domain" below); routine
//    about updates in an existing domain proceed directly (see manage-memories.md).
var dom = JSON.parse(list_memories({ topic: 'my-domain' }));
if ((dom.memories || []).indexOf('my-domain/about') < 0) {
  w('my-domain/about', ['# My Domain', '', 'Covers [domain purpose].', '', '## Scope', '', '- What belongs in this domain.', '', '## Boundaries (out of scope)', '', '- What does not belong here — overlap rules with sibling domains.'].join('\n'));
}

// 1. write topic memories with self-describing <domain>/<subdomain>/<topic> names
w('my-domain/general/topic-a', ['# Topic A', '', 'Content about A.'].join('\n'));
w('my-domain/general/topic-b', ['# Topic B', '', 'Content about B.'].join('\n'));

// 2. add a one-directional mem: cross-reference where useful — no circular
//    refs (A -> B -> A); see references/memory-convention.md
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

### Domain collision check (MANDATORY before research writes)

**Trigger:** storing or correcting research memory entries. Memory domains with near-identical stems are DISTINCT domains — `research/` and `researches/` coexisted and hid the canonical domain until a user pointed it out. Before writing into any research domain (or any domain whose stem could collide), run the collision check:

1. **Run `list_memories({})`** — note every existing domain prefix. Same sanctioned full-store exception class as the manage-memories pre-correction scan: collisions can sit in any domain, so topic-scoping the list misses them.
2. **Compare stems** — normalize (strip trailing plural `s`/`es`, hyphen/underscore variants) and flag domains that share a stem, e.g. `research` vs `researches`.
3. **Consolidate into the canonical domain** — pick the existing domain that already holds the bulk of the topic's entries (or the best-fit domain per PRE-EXISTING DOMAINS FIRST above); write new entries there. Never create or write into a second stem-variant domain.
4. **Store a SUPERSEDED pointer in the orphan** — any entry living in the non-canonical domain becomes a pointer first: rewrite its content to `# SUPERSEDED` + `mem:` links to the canonical entries + a note on why it moved (provenance preserved). Delete the orphan only after the pointer is in place — see the [manage-memories](manage-memories.md) delete verification standard.
5. **Record outcomes** — domain list, canonical choice, and any SUPERSEDED pointer go into the delivery notes.

### Capture lessons immediately

Capture lessons immediately — after any discovery, batch, or quirk, append lessons to the relevant domain's lessons-learned entry right away; never defer to campaign end. Harness quirks (sync-only scripts, wait_for-as-sleep, evaluate_script {function: js} signature, ~4KB payload cap, MCP -32001 timeouts on large batches) are prime candidates and were re-learned by multiple agents when deferred.

### Private memories

Only devtools-derived output from authenticated sessions (and PII / job / application data) is private. Such content goes to the `private` domain — never to a public domain. Public-source research and caches remain in `researches/{topic}` and `cache/{source}/...`. Write `private/about` first (see [Memory Convention](../references/memory-convention.md)), then `private/{subdomain}/{topic}` and `private/cache/{source}/...`. Run the same BLOCKING GATE before every write.

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
// 0. EXISTENCE CHECK FIRST: list_memories topic filtering is PREFIX-based, so
// an exact-name lookup ({topic: 'my-domain/about'}) returns {} and never
// matches. List the DOMAIN PREFIX, then test membership; only write when
// ABSENT — an existing domain about is NEVER overwritten without operator
// approval. Do NOT skip this check: write_memory overwrites by default.
// Tool call pattern: list_memories({ topic: 'my-domain' }) — prefix list
// Response format: JSON STRING — {"memories": ["my-domain/about", ...]}; parse and test membership
var dom = JSON.parse(list_memories({ topic: 'my-domain' }));
if ((dom.memories || []).indexOf('my-domain/about') >= 0) {
  return "SKIP — my-domain/about already exists; do not overwrite without operator approval";
}
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

// 3. Update the domain about if the new memory changes the domain's scope or boundaries.
//    Routine maintenance in an existing domain — writing the updated about directly
//    is allowed here; the never-overwrite-without-operator-approval rule applies
//    only to new-domain creation (see "Creating a new domain" below).
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
- **For a topic that has nested children, add an overview memory** that lists the child memories and their cross-references — a table of contents for that topic subtree (only topics with children get an overview; domain roots and subdomain groupings never do).
- **Group related topics under shared subdomain prefixes** (e.g., `testing/typescript/*`). A flat list of names becomes unmanageable as the project grows.
- **Prefer one `mcp-exec` call for a batch of related writes** (e.g., a domain `about` plus its topic memories): fewer round trips, one per-memory status report, no intermediate returns. Each write gets its own defensive check and a failure does not abort siblings — split calls only when debugging a failing write.
- **Scope every list_memories with a topic prefix** (e.g., {topic:'cache/youtube-videos'} or {topic:'researches'}) — topic-scope to exactly the domains you need instead of enumerating the whole store. The one exception is the PRE-EXISTING DOMAINS FIRST survey ([Memory Convention](../references/memory-convention.md)): that step intentionally runs `list_memories({})` (the whole ~140-name store) to decide domain placement before creating a new domain. Outside that survey, an untopic'd full-store enumeration is pure context waste.

## Common pitfalls

- Memory names are **case-sensitive**. `auth/Login` and `auth/login` are two distinct memories.
- The `/` character creates hierarchical memory names. Do not use `/` in a plain memory name unless you intend to create a hierarchy.
- `write_memory` **overwrites** existing content. For partial updates, use `edit_memory` with `mode: "literal"` or `mode: "regex"`.
- Content **must be valid Markdown**. Non-Markdown content will render poorly when read back and may confuse downstream tools.
- All tool calls must be **synchronous** — no `async/await`.
- The return format of `read_memory` is not guaranteed — it may return plain Markdown or a JSON string wrapping the content. Always use the defensive `readMemoryContent` helper pattern shown above.
- `write_memory` returns plain text like `"Memory <name> written."`, not JSON. Do not call `JSON.parse` on its return value; check for the substring `"written."` to confirm success.

## Acceptance criteria

- [ ] BLOCKING GATE ran before every write: all 7 checklist boxes checked and the after-writing verify step executed — any unchecked box means no write.
- [ ] **Domain collision check** — before writing/correcting research (or stem-collidable) domains, `list_memories({})` enumerated all domains, stems were compared for collisions (`research` vs `researches`), entries were consolidated into the canonical domain, and any orphan carried a SUPERSEDED pointer before deletion.
- [ ] Every `write_memory`/`edit_memory` return is confirmed by substring check (`indexOf("written") > 0` for writes, `indexOf("edited") >= 0` for edits); `JSON.parse` is never applied to these plain-text returns.
- [ ] New-domain creation ran the existence check first: `list_memories({topic: '<domain>'})` parsed and membership-tested for `<domain>/about`; an existing about returned SKIP (never overwritten during new-domain creation without operator approval). Routine about updates in existing domains (scope/boundaries changed) ran directly.
- [ ] Batch script returns one status line per write/edit (OK/FAIL/ERROR) and the line count equals the number of operations attempted — a sibling failure did not abort the batch.
- [ ] Size caps respected: `max_chars` set on `about`/append writes (e.g., 5000); cross-references use `mem:NAME` format.
