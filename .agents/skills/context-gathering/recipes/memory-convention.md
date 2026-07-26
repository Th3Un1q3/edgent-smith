---
name: memory-convention
description: >
  Documents the domain/about/index pattern for organizing project knowledge.
  Use this recipe to understand the convention and create or update
  about and index entries for any domain.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
  tools: []
---

# Memory Convention

Every domain follows a strict **domain/about/index** pattern where each domain has an `about` entry (scope overview) and an `index` entry (table of contents). This recipe documents that convention and provides templates for creating and updating domain entries via `write_memory`. All memory names are used as identifiers — never as file paths.

## Convention Specification

Each domain is identified by a name prefix (e.g., `my-domain`). Every domain must have two mandatory entries at its root:

| Entry | Memory Name | Purpose |
|---|---|---|
| **about** | `my-domain/about` | Describes what the domain covers — scope, key concepts, and why the domain exists. |
| **index** | `my-domain/index` | A table of contents listing every memory in the domain via `mem:` cross-references. |

Topics within a domain use hierarchical naming with `/` as a separator. Memory names follow this pattern:

| Memory Name Pattern | Purpose |
|---|---|
| `<domain>/about` | Domain scope overview |
| `<domain>/index` | Table of contents with `mem:` cross-references |
| `<domain>/<topic-path>` | Individual topic memory (e.g., `subtopic/name`) |

- A domain is a **top-level name prefix** — never nested inside another domain.
- Topics use `/` for nesting (e.g., `architecture/decisions/db-choice`). Memory names are identifiers, not file paths.
- Parent topics that contain sub-topics must provide an **overview memory** that serves as a table of contents for those children, linking to each with a `mem:` reference.

## about Entry Template

Write via `write_memory({ memory_name: "my-domain/about", content: ... })`:

```markdown
# <Domain Name>

<One to two sentences describing what this domain covers.>

## Key Concepts

- **concept-a**: Brief description of concept A.
- **concept-b**: Brief description of concept B.

## Related Domains

- mem:related-domain — Description of how it relates.
```

**Guidelines for the `about` entry:**

- Keep the opening paragraph to two sentences or fewer.
- List only concepts that are central to the domain.
- Use `mem:` cross-references only when referring to another domain's memories; do not use them for the current domain's own memories (use the index for that).
- Do not list individual topic memories here — the index handles that.

## index Entry Template

Write via `write_memory({ memory_name: "my-domain/index", content: ... })`:

```markdown
# <Domain Name> Memories

<Brief description of what memories in this domain cover.>

## Topics

| Topic | Memory |
|---|---|
| overview | [mem:domain/overview](mem:domain/overview) |
| sub-topic | [mem:domain/sub-topic](mem:domain/sub-topic) |
| deep/nested | [mem:domain/deep/nested](mem:domain/deep/nested) |
```

**Guidelines for the `index` entry:**

- Include every memory in the domain — no omissions.
- Use `mem:` references in the format `mem:<domain>/<topic-path>`.
- Keep the table sorted alphabetically or by hierarchy (parents before children).
- Include an overview row if the domain has an overview memory at its root.
- Update the index whenever a new memory is added or removed.

## Example: Adding a New Domain

Suppose you are creating a domain for a project's authentication module.

**Step 1 — Write the `about` entry (memory name: `authentication/about`):**

```javascript
write_memory({
  memory_name: "authentication/about",
  content: [
    "# Authentication",
    "",
    "Covers all aspects of user authentication: login flow, token management,",
    "password policies, and session handling.",
    "",
    "## Key Concepts",
    "",
    "- **JWT tokens**: Stateless tokens issued after successful login.",
    "- **session-store**: Redis-backed session registry for active sessions."
  ].join("\n")
});
```

**Step 2 — Write the `index` entry (memory name: `authentication/index`):**

```javascript
write_memory({
  memory_name: "authentication/index",
  content: [
    "# Authentication Memories",
    "",
    "Landing page for all authentication-related domain memories.",
    "",
    "## Topics",
    "",
    "| Topic | Memory |",
    "|---|---|",
    "| overview | [mem:authentication/overview](mem:authentication/overview) |",
    "| token | [mem:authentication/token](mem:authentication/token) |"
  ].join("\n")
});
```

**Step 3 — Write topic memories:**

- Memory name `authentication/overview`
- Memory name `authentication/token`

After writing, verify that the index entry lists every memory and that every `mem:` reference resolves to an existing entry (use `list_memories({ topic: "authentication" })`).

## Example: Adding a Memory to an Existing Domain

Suppose the authentication domain exists and you need to add a password policy memory.

**Step 1 — Write the new topic memory:**

Memory name: `authentication/password-policy`

```javascript
write_memory({
  memory_name: "authentication/password-policy",
  content: [
    "# Password Policy",
    "",
    "... content about password requirements ..."
  ].join("\n")
});
```

**Step 2 — Update the domain's `index` entry:**

Read the existing index via `read_memory({ memory_name: "authentication/index" })`, append a row for the new memory, then write it back with `write_memory`. Insert a row like:

```markdown
| password-policy | [mem:authentication/password-policy](mem:authentication/password-policy) |
```

**Step 3 — Verify:**

- The `mem:` reference in the index points to an entry that exists (check via `list_memories`).
- The topic name is unique within the domain.
- If the domain has subdirectories, use the correct hierarchical memory name (e.g., `authentication/policies/password-policy`).

## Cross-Reference Patterns

Cross-references use the `mem:` protocol and follow this format:

```
mem:<domain>[/<topic-path>]
```

| Target | `mem:` Reference |
|---|---|
| Root overview of a domain | `mem:authentication` |
| A topic within a domain | `mem:authentication/token` |
| A deeply nested topic | `mem:authentication/policies/password` |
| A topic in another domain | `mem:sessions/redis-config` |

**Rules:**

- Always use `mem:` as the prefix — never a bare file path. Memory names are identifiers, not filesystem paths.
- The domain name must match exactly (case-sensitive).
- The topic path uses `/` for hierarchy (e.g., `my-domain/subtopic/name`). No extensions — memory names are plain identifiers.
- Do not create circular cross-references (A → B → A). If A and B are closely related, pick one as the primary reference.

## Common Pitfalls

### Forgetting to update the index entry

Adding a memory without adding its entry to the domain's `index` entry makes the memory undiscoverable through the collect-relevant-memories recipe. Always update the index at the same time as creating the memory (use memory name `my-domain/index`).

### Breaking mem: references

Renaming a topic or domain without updating `mem:` references in other memories will cause lookups to fail. Use the manage-memories recipe when renaming or moving memories to propagate reference changes via `rename_memory`.

### Missing about entry in a new domain

Every domain must have an `about` entry (memory name: `my-domain/about`). Without it, there is no entry point for understanding what the domain covers. Create it before writing any topic memories.

### Overview memory omitted for parent topics

If a topic has children, it must provide an overview that links to each child via `mem:`. Without this, the hierarchy is flat and the collect-relevant-memories recipe cannot traverse it correctly.

### Stale index after deletion

Deleting a memory without removing its row from the domain's `index` entry leaves a broken `mem:` reference. Update the index as the first step when removing memories.
