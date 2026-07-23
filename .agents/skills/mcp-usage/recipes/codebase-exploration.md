# Codebase Exploration Recipes

All recipes use the **serena** MCP server via a code-mode environment (`code-mode-codebase-exploration`).

## Identify usages of a symbol

Finds all references to a specific symbol across the project.

```javascript
// Find all references to a symbol in one call.
// Result format: {file: {kind: [{name_path, body_location: {start_line}, content_around_reference}]}}
const result = find_referencing_symbols({
  name_path: "build_edge_agent",
  relative_path: "agents/edge.py"
});

try {
  const refs = JSON.parse(result);
  var lines = "";
  for (var file in refs) {
    if (refs.hasOwnProperty(file)) {
      for (var kind in refs[file]) {
        if (refs[file].hasOwnProperty(kind)) {
          for (var i = 0; i < Math.min(refs[file][kind].length, 2); i++) {
            var ref = refs[file][kind][i];
            lines += file + " (" + kind + ") line:" + ref.body_location.start_line + "\n";
            lines += "  " + ref.content_around_reference.replace(/\n/g, "\\n").trim() + "\n\n";
          }
        }
      }
    }
  }
  return lines.trim();
} catch (e) {
  return "Error: " + result;
}
```

## Analyze a file

Get symbol tree, find specific symbols by name pattern, and check diagnostics in one call.

```javascript
// Get symbol tree — returns JSON-as-string, must parse it.
var overviewStr = get_symbols_overview({ relative_path: "agents/edge.py" });
var overview;
try { overview = JSON.parse(overviewStr); } catch(e) { overview = {}; }

// Find symbols by name pattern (substring_matching required for partial matches).
var symbolsRaw = find_symbol({
  name_path_pattern: "EdgeAgent",
  max_matches: -1,
  include_info: true,
  substring_matching: true
});
var symbols;
try { symbols = JSON.parse(symbolsRaw); } catch(e) { symbols = []; }

// Check diagnostics — result format: {file: {SeverityLevel: {symbolKey: [diagnostics]}}}
var diagnosticsStr = get_diagnostics_for_file({
  relative_path: "agents/edge.py",
  min_severity: 4
});
var diagnostics;
try { diagnostics = JSON.parse(diagnosticsStr); } catch(e) { diagnostics = {}; }

return JSON.stringify({
  symbols: overview,
  found: symbols.length + " symbol(s) matching 'EdgeAgent'",
  errors: (diagnostics["agents/edge.py"] && diagnostics["agents/edge.py"].Error ? Object.keys(diagnostics["agents/edge.py"].Error).length : 0) + " error(s)"
}, null, 2);
```

## Search codebase for a pattern

Regex search across all project files in one call.

```javascript
// Find all files and lines matching a pattern in one call.
// Result format: {file: ["  > LINE_NUM:content", ...]} (formatted strings with embedded line numbers)
const result = search_for_pattern({
  substring_pattern: "sessionTracker",
  max_answer_chars: -1,
  restrict_search_to_code_files: false
});

try {
  const matches = JSON.parse(result);
  let lines = "";
  for (const file of Object.keys(matches)) {
    const items = matches[file];
    if (!Array.isArray(items)) continue;
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      lines += file + ": " + items[i].replace(/</g, "&lt;") + "\n";
    }
  }
  return lines.trim();
} catch (e) {
  return "Error: " + result;
}
```

## Common pitfalls

- `get_symbols_overview` returns a JSON **string**, not an object — parse it first.
- `find_symbol` requires `substring_matching: true` for partial name matches (default is exact).
- `search_for_pattern` values are arrays of formatted strings (`"  > LINE_NUM:content"`), not objects with separate fields.
- All tool calls must be **synchronous** — no `async/await`.
