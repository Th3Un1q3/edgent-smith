# Memory Convention

Every domain follows a strict **domain/about** pattern. Every domain has exactly one `about` memory (`my-domain/about`) with three parts: (1) a description of the domain (what it covers, why it exists); (2) SCOPE — what belongs in the domain; (3) BOUNDARIES — what does NOT belong (out-of-scope, overlap rules with sibling domains). The `about` is NOT a table of contents — there is no index memory; discoverability comes from self-describing memory names plus the `about` scope/boundaries. This recipe documents that convention and provides templates for creating and updating domain entries via `write_memory`. All memory names are used as identifiers — never as file paths.

## PRE-EXISTING DOMAINS FIRST

Before creating a new domain, you MUST attempt to place the knowledge in an existing domain:

1. **Collect relevant memories from ALL existing domains** — use `list_memories({})` to see every domain, then read the `about` entry for each relevant one.
2. **Find the best-fitting domain** — does an existing domain's scope already cover this topic? Even partially?
3. **Contribute to an existing domain** when possible — extend its `about` if the new knowledge changes the domain's scope or boundaries, and add a topic memory. Do NOT create a new domain just because a topic is new.
4. **Create a new domain ONLY when** no existing domain can reasonably contain the new knowledge AND the knowledge is systematically useful (see [Memory Management Checklist](./memory-management-checklist.md)).

A new domain is justified when:
- The knowledge crosses multiple existing domains without fitting cleanly into any one of them.
- The knowledge covers a distinct system, framework, or convention that would be misleading to place elsewhere.
- The domain would contain at least 3+ topic memories (not just one or two).

When a topic fits an existing domain, contribute to it — add a topic memory, updating its `about` only if the scope or boundaries change. Do NOT create a new domain just because a topic is new.

## Convention Specification

Each domain is identified by a name prefix (e.g., `my-domain`). Every domain must have exactly one mandatory entry at its root:

| Entry | Memory Name | Purpose |
|---|---|---|
| **about** | `my-domain/about` | Describes the domain — what it covers, its scope (what belongs), and its boundaries (what does NOT belong, overlap rules with sibling domains). |

There is no `index` memory. The `about` is not a table of contents; discoverability comes from self-describing memory names plus the `about` scope/boundaries.

Topics within a domain use hierarchical naming with `/` as a separator. Memory names follow this pattern:

| Memory Name Pattern | Purpose |
|---|---|
| `my-domain/about` | Domain description, scope, boundaries |
| `my-domain/<subdomain>/<topic>` | Self-describing topic memory |

- A domain is a **top-level name prefix** — never nested inside another domain.
- Topics use `/` for nesting (e.g., `troubleshooting/software/finding-known-github-issues`). Memory names are identifiers, not file paths.
- Parent topics that contain sub-topics must provide an **overview memory** that serves as a table of contents for those children, linking to each with a `mem:` reference.

## Naming Rule

Memory names follow `<domain>/<subdomain>/<topic>`. `<domain>` is a top-level prefix (e.g., `troubleshooting`, `testing`, `refactoring`). `<subdomain>` groups an area/tech (e.g., `software`, `ts-libraries`, `python`, `general`, `typescript`). `<topic>` is action-oriented and self-describing — states what the memory helps with (e.g., `finding-known-github-issues`, `exploring-official-documentation`, `learning-current-versions`, `iterative-design`, `process-breakdown`, `import-convention`, `known-issues`, `mutation-testing`).

Full-prefix examples: `troubleshooting/software/finding-known-github-issues`, `troubleshooting/ts-libraries/learning-current-versions`, `troubleshooting/python/exploring-official-documentation`, `testing/general/iterative-design`, `testing/general/process-breakdown`, `testing/typescript/import-convention`, `testing/typescript/known-issues`, `testing/typescript/mutation-testing` — the same schema works for tests.

Test: cover the name — would a reader with your task pick this memory from the list? BAD example: `Issue & Docs Analysis` (title-style; hides content).

## Public vs Private Namespaces

Domains are public by default — their memories are project knowledge and may be committed to version control. The `private` domain is the sole exception: content there never fits a public domain (exempt from PRE-EXISTING DOMAINS FIRST) and must never be committed.

- PUBLIC info → `researches/{topic}` syntheses + `cache/{source}/...` raw caches (default for fetch/tavily/deepwiki/github/context7 on public content).
- PRIVATE info → `private/{subdomain}/{topic}` + `private/cache/{source}/...` — ONLY devtools-derived output from authenticated sessions, PII, job/application data. When unsure whether devtools-derived content is public, default to private.
- Extraction recipes (selectors, URL templates, quirks — no PII) are NOT private; they stay in `browser-automation/<site>/`.
- Private memories remain readable by agents — the privacy concern is storage and version control, not read access. Public domains never `mem:`-reference `private/*`; private entries reference only `private/*`.

## about Entry Template

Write via `write_memory({ memory_name: "my-domain/about", content: ... })`:

```markdown
# <Domain Name>

<One to two sentences describing what this domain covers.>

## Scope

- What belongs in this domain.
- Kinds of knowledge accepted here.

## Boundaries (out of scope)

- What does NOT belong — topics that live in sibling domains.
- Overlap rules: when a topic could fit here or elsewhere, where does it go?

## Related Domains

- mem:related-domain — Description of how it relates.
```

**Guidelines for the `about` entry:**

- Keep the opening paragraph to two sentences or fewer.
- List only concepts that are central to the domain.
- The `about` covers scope and boundaries; it is not a table of contents.
- Use `mem:` cross-references only when referring to another domain's memories.

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
    "## Scope",
    "",
    "- Login flows, token management, password policies, session handling.",
    "",
    "## Boundaries (out of scope)",
    "",
    "- User profiles and preferences (see mem:users).",
    "- TLS and network security configuration (see mem:infrastructure)."
  ].join("\n")
});
```

**Step 2 — Write topic memories:**

- Memory name `authentication/overview`
- Memory name `authentication/token`

After writing, verify via `list_memories({ topic: "authentication" })` that all memories exist and their names are self-describing (a reader scanning the list can judge each one's relevance).

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

**Step 2 — Update the `about` if the new memory changes the domain's scope or boundaries:**

Read `authentication/about` via `read_memory`, adjust the SCOPE or BOUNDARIES sections if the new memory expands or narrows what the domain covers, then write it back with `write_memory`.

**Step 3 — Verify:**

- The topic name is unique within the domain and self-describing.
- If the domain has subdomains, use the correct hierarchical memory name (e.g., `authentication/policies/password-policy`).

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

### Title-style names

A memory named like a title (`Issue & Docs Analysis`) hides its content; the reader cannot judge relevance from the list. Use `<domain>/<subdomain>/<topic>` action-oriented names.

### Missing or stale about

Every domain must have an `about` (description + scope + boundaries); update it when the domain's scope or boundaries change.

### Breaking mem: references

Renaming a topic or domain without updating `mem:` references in other memories will cause lookups to fail. Use the manage-memories recipe when renaming or moving memories to propagate reference changes via `rename_memory`.

### Missing about entry in a new domain

Every domain must have an `about` entry (memory name: `my-domain/about`) describing the domain's scope and boundaries. Without it, there is no entry point for understanding what the domain covers. Create it before writing any topic memories.

### Overview memory omitted for parent topics

If a topic has children, it must provide an overview that links to each child via `mem:`. Without this, the hierarchy is flat and the collect-relevant-memories recipe cannot traverse it correctly.
