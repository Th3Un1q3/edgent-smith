# Collect Relevant Memories

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-memory-collect`).

## List memories by topic

Discover what memories exist under a given topic. `list_memories` returns a JSON **string** — parse it first, then access the `.memories` property (an array of strings).

```javascript
const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};

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
// Helper: get memory content, handling both JSON-wrapped and plain-text returns
// read_memory does not throw on missing memories — it returns an error string.
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (raw.indexOf("not found") >= 0) {
    throw new Error("Memory not found: " + name);
  }
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

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
// Helper: get memory content, handling both JSON-wrapped and plain-text returns
// read_memory does not throw on missing memories — it returns an error string.
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (raw.indexOf("not found") >= 0) {
    throw new Error("Memory not found: " + name);
  }
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};

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
// Helper: get memory content, handling both JSON-wrapped and plain-text returns
// read_memory does not throw on missing memories — it returns an error string.
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (raw.indexOf("not found") >= 0) {
    throw new Error("Memory not found: " + name);
  }
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};

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

## Domain-Based Discovery

Use the **domain/about/index** convention to discover all memories in a domain systematically. This approach combines listing, index reading, and cross-reference following to build a complete picture of a domain.

### Conventional entry points

| File | Role |
|---|---|
| `domain/about` | Describes the domain's scope and purpose. |
| `domain/index` | Table of contents listing all topic memories with `mem:` cross-references. |
| `domain/topic-name` | Individual topic memory referencing the domain index. |

### Discovery strategy

1. **Start with `domain/index`** as the entry point for a domain. The index lists every topic memory and provides `mem:` links to each one.
2. **Follow `mem:` links** from the index to read individual memories. Each memory may in turn reference other memories across domains.
3. **Use `list_memories` with a domain prefix** to discover all memories in the domain that may not be listed in the index (e.g., memories created since the index was last updated).
4. **Aggregate findings** across all memories in the domain, combining the structured overview from the index with the full content of each topic memory and any cross-domain references.

### Code-mode script

This script reads a domain's about and index files, discovers all memories via `list_memories`, extracts `mem:` cross-references from the index to find related memories across domains, and aggregates everything into a single report.

```javascript
// Helper: get memory content, handling both JSON-wrapped and plain-text returns
function readMemoryContent(name) {
  var raw = read_memory({ memory_name: name });
  if (raw.indexOf("not found") >= 0) {
    throw new Error("Memory not found: " + name);
  }
  try {
    var parsed = JSON.parse(raw);
    return parsed.content || raw;
  } catch (e) {
    return raw;
  }
}

const parseJson = (str, src) => {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + src + ": " + e.message); }
};

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

// Step 2: read the domain's index entry for the table of contents.
var indexContent = "";
try {
  indexContent = readMemoryContent(domain + "/index");
  report += "## " + domain + "/index\n\n" + indexContent + "\n\n";
} catch (e) {
  report += "[No index entry found: " + e.message + "]\n\n";
}

// Step 3: list all memories under the domain prefix.
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

// Step 4: follow cross-domain mem: links discovered from memories.
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
- The index may not list every memory — always verify with `list_memories` to catch memories added since the last index update.
- `mem:` references in the index or memories may point to memories in other domains. The script above handles cross-domain discovery automatically.
- Follow the same defensive `readMemoryContent` pattern used throughout this document to handle both JSON-wrapped and plain-text returns from `read_memory`.
