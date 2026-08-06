# Recipe: Filesystem Access through the Gateway

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `filesystem` — the Rust `rust-mcp-filesystem` server; reads, lists, searches, and writes files, restricted to its configured allowed directories |
| **When to use** | Reading, listing, searching, or writing files on disk through the gateway when direct `read`/`grep` access is unavailable or you want server-side path enforcement (allowed-directory sandboxing) |
| **Combines with** | [codebase-exploration](./codebase-exploration.md) — use serena for symbol/reference queries and this recipe for raw file content; [store-memories](./store-memories.md) — read project files, then persist findings as memories |

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `code_mode({"name": "code-mode-filesystem-access", "servers": ["filesystem"]})` — the tool is exposed to mcp-exec under the returned prefixed name

## Scripts

### List allowed directories

`Run this before anything else — the server denies every path outside the returned list, so know your sandbox first.`

```javascript
// Print every directory the server may access.
// Tool call pattern: list_allowed_directories()
// Response format: plain text — 'Allowed directories:' header, then one absolute path per line
// Note: Use single quotes for all JS strings to avoid JSON escaping issues in mcp-exec
try {
  var result = list_allowed_directories();
  if (result.indexOf('Allowed directories:') < 0) {
    return 'ERROR: unexpected response: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Read a file

`Reads one text file. The path must resolve under an allowed directory — /workspace itself, dot-dirs, and root-level files are denied.`

```javascript
// Read a single text file. Path must resolve under an allowed directory.
// Tool call pattern: read_text_file({ path: '/workspace/<allowed-dir>/<file>' })
// Response format: plain text file content; denied and missing paths return an
// error STRING ('Access denied - path is outside allowed directories: ...',
// 'No such file or directory (os error 2)'), not an exception
try {
  var result = read_text_file({ path: '/workspace/mcp/catalog.yaml' });
  if (result.indexOf('Access denied') === 0 || result.indexOf('No such file') === 0) {
    return 'ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Read multiple files

`Reads several files in one call. Failures are per-file and inline — the call does not throw. Pass ABSOLUTE paths: relative names resolve against / and are denied.`

```javascript
// Read several files at once; per-file failures are reported inline, not thrown.
// Tool call pattern: read_multiple_text_files({ paths: ['/workspace/<dir>/<file1>', '/workspace/<dir>/<file2>'] })
// Response format: '<absolute-path>:' followed by the file content, entries joined
// by '---'; a failed file appears as '<path>: Error - <message>'
// Note: use ABSOLUTE paths — relative paths resolve against / and get denied
try {
  var result = read_multiple_text_files({
    paths: ['/workspace/mcp/catalog.yaml', '/workspace/mcp/docker-config.json']
  });
  if (result.indexOf('Error -') >= 0) {
    return 'PARTIAL ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Search files by name pattern

`Finds files under a path whose names match a glob. The pattern is a GLOB — a bare word such as 'filesystem' matches nothing; use wildcards like '*.yaml'.`

```javascript
// Find files whose names match a glob under a directory (case-insensitive, partial).
// Tool call pattern: search_files({ path: '/workspace/<allowed-dir>', pattern: '*.yaml' })
// Response format: one absolute path per line, or the literal 'No matches found'
// Note: pattern is a glob — use wildcards, not bare words
try {
  var result = search_files({ path: '/workspace/mcp', pattern: '*.yaml' });
  if (result === 'No matches found') {
    return 'No matches found';
  }
  if (result.indexOf('Access denied') === 0) {
    return 'ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Search file contents

`Finds text (or regex) inside files matching a glob. Returns match locations with a preview — ideal for grep-style research on allowed directories.`

```javascript
// Find text or regex matches in file contents under a path.
// Tool call pattern: search_files_content({ path: '/workspace/<dir>', pattern: '**/*', query: 'ALLOW_WRITE' })
// Response format: '<file-path>' header line, then '  <line>:<column>: <preview>' lines
try {
  var result = search_files_content({
    path: '/workspace/mcp',
    pattern: '**/*',
    query: 'ALLOW_WRITE'
  });
  if (result.indexOf('Access denied') === 0) {
    return 'ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Directory tree

`Gets a recursive listing as JSON. Cap max_depth to keep the output small. This is the ONLY filesystem tool that returns JSON — parse it.`

```javascript
// Get a recursive tree view of a directory as JSON.
// Tool call pattern: directory_tree({ path: '/workspace/<dir>', max_depth: 2 })
// Response format: JSON string (2-space indented) — array of {name, type, children?} nodes
// Note: this is the only filesystem tool whose response is JSON — parse it
try {
  var result = directory_tree({ path: '/workspace/mcp', max_depth: 2 });
  var tree = JSON.parse(result);
  return JSON.stringify(tree, null, 2);
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Get file info

`Gets metadata (size, mtime, permissions, type) without reading content. Useful for size checks before read_media_file or for deciding which files to read.`

```javascript
// Get file metadata without reading content.
// Tool call pattern: get_file_info({ path: '/workspace/<allowed-dir>/<file>' })
// Response format: plain text 'key: value' lines — size, created, modified,
// accessed, isDirectory, isFile, permissions
try {
  var result = get_file_info({ path: '/workspace/mcp/catalog.yaml' });
  if (result.indexOf('Access denied') === 0 || result.indexOf('No such file') === 0) {
    return 'ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### List a directory

`Lists a directory's direct entries. Names are RELATIVE to the queried path — rebuild full paths yourself before chaining into read/search tools.`

```javascript
// List a directory's direct entries; names are relative to the queried path.
// Tool call pattern: list_directory({ path: '/workspace/<allowed-dir>' })
// Response format: plain text '[FILE] <name>' / '[DIR] <name>' lines, no sizes
// Note: rebuild full paths yourself ('/workspace/mcp/' + name) before passing
// the names to other tools — bare names resolve against / and are denied
try {
  var result = list_directory({ path: '/workspace/mcp' });
  if (result.indexOf('Access denied') === 0) {
    return 'ERROR: ' + result;
  }
  return result;
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

### Write a file (with cleanup warning)

`Creates or overwrites a file. THE SERVER HAS NO DELETE TOOL — every artifact you write persists; only write throwaway files when you can plan host-side cleanup, and report the artifact path for it.`

```javascript
// Create or overwrite a file. THE SERVER HAS NO DELETE TOOL — every artifact
// written here persists, so plan host-side cleanup for anything you create.
// Tool call pattern: write_file({ path: '/workspace/<allowed-dir>/<file>', content: '<text>' })
// Response format: plain text 'Successfully wrote to <path>', or an 'Access denied' error string
// For multi-line content, build with array-join pattern:
// var content = ['line one', 'line two'].join('\\n');
try {
  var result = write_file({
    path: '/workspace/experiments/probe.txt',
    content: ['line one', 'line two'].join('\\n')
  });
  if (result.indexOf('Successfully wrote to') < 0) {
    return 'ERROR: ' + result;
  }
  return 'WROTE: ' + result + ' (no delete tool — plan cleanup)';
} catch (e) {
  return 'ERROR: ' + e.message;
}
```

## Best practices

- Call `list_allowed_directories()` first and confirm the target path sits under one of the returned dirs before any other call.
- The repo root `/workspace` is NOT an allowed dir; neither are dot-dirs or root-level files (`.env`, `.serena/`, `.git/`, `AGENTS.md`, `justfile`) — anything outside the 9 allowed dirs returns an `Access denied` string.
- Responses are plain text, not JSON — parse only `directory_tree`. Check error substrings on everything else.
- Denied and missing paths return error STRINGS, not exceptions — check `result.indexOf('Access denied')` and `result.indexOf('No such file')` after every call; try/catch alone will not catch them.
- `list_directory` returns bare names; prefix with the queried path before chaining into read/search tools (bare names resolve against `/` and get denied).
- `search_files` takes a glob — use wildcards (`*.yaml`), never bare words.
- No delete tool: never write throwaway files; when a write is unavoidable, plan host-side cleanup and report the artifact path.

## Common pitfalls

- **Access denied on the repo root**: `/workspace` itself and root-level files (`AGENTS.md`, `justfile`) are not in the allowed list — only the 9 subdirectories (`.opencode`, `agents`, `agent_utils`, `cli`, `evals`, `experiments`, `mcp`, `scripts`, `tests`).
- **No delete tool**: there is no delete/remove tool — every `write_file`, `zip_files`, or `move_file` artifact persists; plan cleanup.
- **Plain text, not JSON**: tools return text (`[FILE] <name>`, `key: value`, paths-per-line); do not `JSON.parse` them — except `directory_tree`.
- **Error strings, not exceptions**: denied/nonexistent paths come back as normal string results (`Access denied - path is outside allowed directories: ...`, `No such file or directory (os error 2)`); a try/catch alone will not catch them — check the content.
- **Sandbox name**: use a descriptive name when activating code-mode (e.g., `code-mode-filesystem-access`); the exposed tool name is prefixed — pass the full returned name to mcp-exec.
- **Sync only**: no `async`/`await`; variables do not persist between mcp-exec calls.
- **Single quotes**: use single quotes for all JS strings to survive JSON embedding.
