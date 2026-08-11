# Reference: Filesystem Server — Tools & Response Formats

Canonical tool list and return formats for scripting the **filesystem** MCP server in code-mode. Recipes point here instead of re-defining the formats, so there is a single source of truth. All tool calls must be **synchronous** — no `async`/`await`. None of these tool names are hyphenated, so call them directly (no `globalThis['...']`).

## Server identity

| Property | Value |
|---|---|
| Catalog server name | `filesystem` |
| Implementation | Rust — `rust-mcp-stack/rust-mcp-filesystem` (the Rust MCP filesystem server) |
| Pinning / policy | digest-pinned; `disableNetwork`; `long_lived: false` |
| Write access | **ALLOW_WRITE=true** — write/create/edit/move/zip tools are enabled |
| Delete access | **None** — there is NO delete/remove tool in the 24-tool surface |

## Tool table

| Tool | Purpose | Response format (probed where marked) |
|---|---|---|
| `list_allowed_directories` | Print the directories the server may access | Plain text: `Allowed directories:` header, then one absolute path per line (probed) |
| `list_directory` | List a directory's direct entries | Plain text `[FILE] <name>` / `[DIR] <name>` lines; names are RELATIVE to the queried path (probed) |
| `list_directory_with_sizes` | Same as `list_directory`, plus sizes | Columnar plain text: `[FILE] <name> <size>`, then `Total: N files, M directories` + `Total size:` block (probed) |
| `read_text_file` | Read one text file (optional line numbers) | Plain text file content; error strings on denied/missing paths (probed) |
| `read_multiple_text_files` | Read several text files in one call | `<absolute-path>:` + content per file, entries joined by `---`; per-file failures inline as `<path>: Error - <message>`, never throws (probed) |
| `head_file` | First N lines of a file | Plain text lines (probed) |
| `tail_file` | Last N lines of a file | Plain text lines (probed) |
| `read_file_lines` | Lines from a 0-based offset, optional limit | Plain text lines (probed) |
| `read_media_file` | Read image/audio as Base64 + MIME | Plain text |
| `read_multiple_media_files` | Read several media files at once | Plain text; failed reads skipped inline |
| `write_file` | Create or overwrite a file | Plain text `Successfully wrote to <path>` (probed) |
| `edit_file` | Line-based edits; returns git-style diff | Plain text diff |
| `create_directory` | Create directory (silently succeeds if present) | Plain text |
| `move_file` | Move/rename; fails if destination exists | Plain text |
| `zip_files` | Zip a list of files | Plain text |
| `zip_directory` | Zip a directory by glob pattern | Plain text |
| `unzip_file` | Extract a zip to a directory | Plain text |
| `search_files` | Find files/dirs by glob name pattern | One absolute path per line, or literal `No matches found` (probed) |
| `search_files_content` | Find text/regex inside files by glob | `<file-path>` header, then `<line>:<column>: <preview>` lines (probed) |
| `directory_tree` | Recursive tree listing | **JSON string** (2-space indented) — array of `{name, type, children?}` nodes; the only JSON response (probed) |
| `get_file_info` | Metadata: size, times, permissions, type | Plain text `key: value` lines (`size`, `created`, `modified`, `accessed`, `isDirectory`, `isFile`, `permissions`) (probed) |
| `find_empty_directories` | Find empty directories recursively | Plain text (default) or JSON via `output_format` |
| `calculate_directory_size` | Total size of a directory | Plain text — `human-readable` or `bytes` via `output_format` |
| `find_duplicate_files` | Find duplicate files by content | Plain text (default) or JSON via `output_format` |

## Allowed-directories model

The server is configured with 9 allowed directories (relative to the container workspace root):

```
/workspace/.opencode
/workspace/agents
/workspace/agent_utils
/workspace/cli
/workspace/evals
/workspace/experiments
/workspace/mcp
/workspace/scripts
/workspace/tests
```

> The 9-directory list above is a snapshot of this workspace's server catalog; re-verify it on catalog change — run `list_allowed_directories` at sandbox activation (the server may add or remove allowed dirs between releases).

- Subdirectories within any allowed directory are also accessible.
- Paths are **canonicalized** server-side and must resolve under an allowed directory; symlinks that escape an allowed directory are denied. Enforcement is real, not advisory.
- The repo root `/workspace` is **not** an allowed directory — root-level files (`AGENTS.md`, `justfile`) are denied.
- Denial error format (returned as a plain STRING, never thrown):

```
Access denied - path is outside allowed directories: <path> not in /workspace/.opencode,
/workspace/agents,
/workspace/agent_utils,
/workspace/cli,
/workspace/evals,
/workspace/experiments,
/workspace/mcp,
/workspace/scripts,
/workspace/tests
```

- Nonexistent-path error format (also a plain string, never thrown): `No such file or directory (os error 2)`

## Configuration notes

- **ALLOW_WRITE=true**: `write_file`, `edit_file`, `create_directory`, `move_file`, `zip_files`, `zip_directory`, `unzip_file` are all enabled.
- **No delete tool**: the 24-tool surface has no delete/remove operation. Artifacts created via the server persist; cleanup requires host tooling outside the gateway. Never create throwaway files through this server without planning that cleanup.
- Server is digest-pinned and `disableNetwork`; it cannot reach external hosts.

## Access-scope guardrail table

| Path | Accessible? |
|---|---|
| `/workspace/.opencode/**` | Yes |
| `/workspace/agents/**` | Yes |
| `/workspace/agent_utils/**` | Yes |
| `/workspace/cli/**` | Yes |
| `/workspace/evals/**` | Yes |
| `/workspace/experiments/**` | Yes |
| `/workspace/mcp/**` | Yes |
| `/workspace/scripts/**` | Yes |
| `/workspace/tests/**` | Yes |
| `/workspace` (root) | **No** — `Access denied` |
| `/workspace/AGENTS.md`, `/workspace/justfile` | **No** — root-level files denied |
| `/workspace/.env`, `/workspace/.serena/`, `/workspace/.git/` | **No** — dot-paths outside allowed dirs |
| Any absolute path outside the 9 dirs (e.g., `/tmp`, `/etc`, `~/...`) | **No** — `Access denied` |
| Bare relative names (e.g., `catalog.yaml`) | **No** — resolve against `/` and get denied; always pass absolute paths |

## Common Pitfalls

- All tool calls must be **synchronous** — no `async`/`await`; variables do not persist between `mcp_exec` calls.
- Errors are **strings, not exceptions**: `Access denied - path is outside allowed directories: ...` and `No such file or directory (os error 2)` return as normal results — check content, do not rely on try/catch.
- Only `directory_tree` returns JSON; `JSON.parse` on any other tool response fails or misleads.
- `list_directory` names are relative — rebuild absolute paths before chaining.
- `search_files` pattern is a glob (`*.yaml`); bare words match nothing (`No matches found`).
