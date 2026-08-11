# Collect Relevant Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-collect`).

**Prerequisite: load [references/serena-memory-api.md](../references/serena-memory-api.md) first — it defines the helper scripts (`readMemoryContent`, `parseJson`, etc.) this recipe uses.**

Follow the [Setup workflow](../workflows/setup.md) and [Scripting workflow](../workflows/scripting-workflow.md) before using this recipe.

## List memories by topic

Discover what memories exist under a given topic. `list_memories` returns a JSON **string** — parse it first, then access the `.memories` property (an array of strings).

```javascript
// Helper: parseJson — see ../references/serena-memory-api.md

try {
  var result = list_memories({ topic: "agents" });
  var parsed = parseJson(result, "list_memories");
  var memories = parsed.memories || [];
  if (!Array.isArray(memories)) return "No memories found for topic 'agents'.";
  var lines = "";
  for (var i = 0; i < memories.length; i++) {
    lines += (i + 1) + ". " + (memories[i] || "unnamed") + "\n";
  }
  return lines.trim();
} catch (e) {
  return "Error: " + e.message;
}
```

## Read a specific memory

Read a single memory by its name. The memory name is case-sensitive and includes any subdirectory prefix.

```javascript
// Helper: readMemoryContent — see ../references/serena-memory-api.md

var memName = "modules/frontend";
try {
  var content = readMemoryContent(memName);
  return "## " + memName + "\n\n" + content;
} catch (e) {
  return "Error reading memory '" + memName + "': " + e.message;
}
```

`read_memory` returns an error string (not an exception) if the memory does not exist. Always check the return value for `"not found"` and throw explicitly.

## Collect all memories for a topic

Full pipeline: list, iterate, read, and aggregate. Partial failures are handled per memory so one failure does not lose the rest.

```javascript
// Helper: readMemoryContent — see ../references/serena-memory-api.md

// Helper: parseJson — see ../references/serena-memory-api.md

var result = list_memories({ topic: "agents" });
var parsed;
try { parsed = parseJson(result, "list_memories"); }
catch (e) { return "Error: " + e.message; }

var memories = parsed.memories || [];
if (!Array.isArray(memories)) return "No memories found for topic 'agents'.";

var summary = "";
for (var i = 0; i < memories.length; i++) {
  var name = memories[i];
  summary += "## " + name + "\n\n";
  try {
    summary += readMemoryContent(name) + "\n\n";
  } catch (e) {
    summary += "[ERROR: " + e.message + "]\n\n";
  }
}
return summary.trim();
```

## Follow cross-references to discover related memories

Memories reference each other using `mem:NAME` in their content. This script lists and reads direct memories for a topic, then scans for `mem:` references and fetches those too.

```javascript
// Helper: readMemoryContent — see ../references/serena-memory-api.md

// Helper: parseJson — see ../references/serena-memory-api.md

// Scan content for mem:NAME cross-references.
// Tight regex: alphanumeric, underscore, forward slash, dot, hyphen
function extractRefs(content) {
  var refs = [];
  var regex = /mem:([a-zA-Z0-9_\/.-]+)/g;
  var match;
  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

// Step 1: list memories for topic.
var listResult = list_memories({ topic: "agents" });
var parsed = parseJson(listResult, "list_memories");
var memories = parsed.memories || [];
if (!Array.isArray(memories)) return "No memories found.";

var direct = {};
var related = {};
var seen = {};

// Step 2: read each direct memory and find cross-references.
for (var i = 0; i < memories.length; i++) {
  var name = memories[i];
  seen[name] = true;
  try {
    var content = readMemoryContent(name);
    direct[name] = content;
    var refs = extractRefs(content);
    // Step 3: read referenced memories.
    for (var j = 0; j < refs.length; j++) {
      var refName = refs[j];
      if (seen[refName]) continue;
      seen[refName] = true;
      try {
        related[refName] = readMemoryContent(refName);
      } catch (e) {
        related[refName] = "[ERROR: " + e.message + "]";
      }
    }
  } catch (e) {
    direct[name] = "[ERROR: " + e.message + "]";
  }
}

return JSON.stringify({ direct: direct, related: related }, null, 2);
```

## Common pitfalls

- `list_memories` returns a JSON **string**, not an array — parse it first with a helper function like `parseJson`.
- `list_memories` returns `{"memories": [string, ...]}` — the `memories` key holds an array of plain strings, not objects. Access memory names directly as strings.
- `list_memories` topic filtering is **prefix-based** (matches memories under that directory prefix). It is also case-sensitive.
- `read_memory` returns an error string (not an exception) if the memory does not exist. Always check the return value for `"not found"` and throw explicitly.
- The return format of `read_memory` is not guaranteed — it may return plain Markdown or a JSON string wrapping the content. Always use the defensive `readMemoryContent` helper pattern shown above.
- `mem:` references in memory content are plain text. They are not resolved automatically — you must scan content manually with a regex.
- All tool calls must be **synchronous** — no `async/await`.
- Memory names are case-sensitive. `"Modules/Frontend"` and `"modules/frontend"` are different names.
- `/` in a memory name creates hierarchical naming (e.g., `modules/frontend`). Use `list_memories({ topic: "modules" })` to discover all memories under that prefix.
- **Bad memory found on read** — if a memory reads as session framing or unverified claims, do not propagate it into your summary. Fix it (see manage-memories) or flag it for the operator.

## Domain-Based Discovery

Memory names are the discovery surface — self-describing `<domain>/<subdomain>/<topic>` names make relevance obvious when scanning the list. There is no domain-level table-of-contents or `index` memory to read; use `list_memories` plus each domain's `about` (scope + boundaries) instead. Exception: a topic with nested children carries a `<topic>/overview` memory that serves as that subtree's table of contents — when a listed name ends in `/overview`, read it to enumerate the children (see [Memory Convention](../references/memory-convention.md)).

### Conventional entry points

Domain structure — one `about` (scope + boundaries) plus self-describing `<domain>/<subdomain>/<topic>` topic names — is defined in [Memory Convention](../references/memory-convention.md).

### Discovery strategy

1. **List first** — run `list_memories({})` and scan NAMES; self-describing names make relevance obvious for your task.
2. **Read the domain `about`** for candidate domains — its SCOPE and BOUNDARIES confirm whether the domain covers your topic. For any listed name ending in `/overview`, read it to enumerate that topic's children.
3. **Follow `mem:` cross-references** from selected memories to find related ones across domains.
4. **Prefix-filter** with `list_memories({ topic: "<prefix>" })` to narrow to a domain or subdomain.
5. **Read `private/*` freely** — private memories are readable by agents; the `private` domain only means "never commit to version control". Discovery, gate, and `mem:` rules apply unchanged.

### Code-mode script

This script reads a domain's `about` (scope and boundaries), discovers all memories via `list_memories`, extracts `mem:` cross-references from each memory to find related memories across domains, and aggregates everything into a single report.

```javascript
// Helper: readMemoryContent — see ../references/serena-memory-api.md

// Helper: parseJson — see ../references/serena-memory-api.md

// Scan content for mem:NAME cross-references.
function extractRefs(content) {
  var refs = [];
  var regex = /mem:([a-zA-Z0-9_\/.-]+)/g;
  var match;
  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

var domain = "my-domain";
var report = "";

try {
  report += "## " + domain + "/about\n\n";
  report += readMemoryContent(domain + "/about") + "\n\n";
} catch (e) {
  report += "[No about found: " + e.message + "]\n\n";
}

// Step 2: list all memories under the domain prefix.
var listResult = list_memories({ topic: domain });
var parsed;
try { parsed = parseJson(listResult, "list_memories"); }
catch (e) { return "Error: " + e.message; }

var memories = parsed.memories || [];
if (!Array.isArray(memories)) return "No memories found for domain '" + domain + "'.";

report += "## All memories in " + domain + "\n\n";

var seen = {};
var related = {};

for (var i = 0; i < memories.length; i++) {
  var name = memories[i];
  seen[name] = true;
  try {
    var content = readMemoryContent(name);
    report += "### " + name + "\n\n" + content + "\n\n";
    // Collect mem: references from each memory for cross-domain discovery.
    var refs = extractRefs(content);
    for (var j = 0; j < refs.length; j++) {
      if (!seen[refs[j]]) {
        related[refs[j]] = true;
      }
    }
  } catch (e) {
    report += "### " + name + "\n\n[ERROR: " + e.message + "]\n\n";
  }
}

// Step 3: follow cross-domain mem: links discovered from memories.
if (Object.keys(related).length > 0) {
  report += "## Related memories across domains\n\n";
  var relatedNames = Object.keys(related);
  for (var k = 0; k < relatedNames.length; k++) {
    var refName = relatedNames[k];
    // Skip memories already covered in the domain.
    if (seen[refName]) continue;
    try {
      report += "### " + refName + "\n\n";
      report += readMemoryContent(refName) + "\n\n";
      seen[refName] = true;
    } catch (e) {
      report += "### " + refName + "\n\n[ERROR: " + e.message + "]\n\n";
    }
  }
}

return report.trim();
```

### Common pitfalls

- `list_memories` topic filtering is **prefix-based** and case-sensitive. Use the exact domain prefix as written in memory names (e.g., `"my-domain"`, not `"My-Domain"`).
- Names are the discovery surface — prefer `list_memories` and self-describing names over any domain-level table of contents. A `<topic>/overview` memory is the one sanctioned table of contents (for topics-with-children only); read it when a listed name ends in `/overview`.
- `mem:` references in memories may point to memories in other domains. The script above handles cross-domain discovery automatically.
- Follow the same defensive `readMemoryContent` pattern used throughout this document to handle both JSON-wrapped and plain-text returns from `read_memory`.

## Acceptance criteria

- [ ] `list_memories` output parsed with `parseJson(result, "list_memories")` before `.memories` is accessed; `.memories` holds plain name strings, not objects.
- [ ] Every memory read goes through `readMemoryContent`; a missing memory's `"not found"` error string is handled explicitly (thrown/reported), never propagated as content.
- [ ] Output matches the documented format: "List memories by topic" returns numbered `1. <name>` lines; "Collect all memories" returns `## <name>` sections, with failed reads shown as `[ERROR: <message>]`, not silently dropped.
- [ ] Cross-reference script ran `extractRefs` on every direct memory and each discovered `mem:` name was fetched or flagged `[ERROR: ...]` — no reference skipped.
- [ ] All tool calls are synchronous (no `async`/`await`).
