# Gateway tool inventory and verified call forms

Status: evidence record
Date: 2026-10-23
Scope: what this session can actually call in the `tools.gateway` namespace, and
which call forms work. Read-only probes. No config, skill, or memory was written.

## Total count

`Object.keys(tools.gateway).length` returned **256** at 2026-10-23.

The count is not stable. An earlier enumeration in the same session returned 255;
`code-mode-cw-probe-1` appeared between the two calls. Any document that pins a
number to this namespace will go stale, including this one.

## Inventory by apparent owning server

Nine configured servers (`mcp/catalog.yaml`) plus gateway-native and
session-created tools account for all 256 entries. No entry names a server
called `adr` or `memory`; both capabilities are served by `serena` (see
[Groups the task expected](#groups-the-task-expected-but-that-do-not-exist)).

### code-mode wrappers — 118

Session-created sandboxes. All start with `code-mode`. Each is a name registered
by a prior `code-mode` call, not an upstream tool.

```text
code-mode, code-mode-adr-read, code-mode-adr-serena, code-mode-adr11reader,
code-mode-cg, code-mode-cg-session-research, code-mode-cg1, code-mode-cg2,
code-mode-cg3, code-mode-check-adr, code-mode-check-trio,
code-mode-code-mode-437a, code-mode-code-mode-devtools, code-mode-code-mode-dt1,
code-mode-code-mode-li-job-4480328059, code-mode-code-mode-navorg,
code-mode-code-mode-traffic, code-mode-code-mode-v2, code-mode-code-mode-validate,
code-mode-ctx-batch-mem, code-mode-ctx-check, code-mode-ctx-gw,
code-mode-ctx-reader, code-mode-ctx-serena, code-mode-cw-probe-1,
code-mode-fetch_only, code-mode-hmpage, code-mode-jobcheck, code-mode-mem,
code-mode-mem-check, code-mode-mem-check-1, code-mode-mem-inventory-skills,
code-mode-mem-read, code-mode-mem-trio, code-mode-mem-verify, code-mode-memcheck,
code-mode-memcheck1, code-mode-memfix, code-mode-ord, code-mode-orderyoyo,
code-mode-orderyoyo_hm, code-mode-orderyoyo-research, code-mode-oyfetch,
code-mode-r1probe, code-mode-r1probe2, code-mode-reader, code-mode-research,
code-mode-rug-audit-mem, code-mode-rug-mem, code-mode-rug-mem-collect,
code-mode-rug-retro-mem, code-mode-rug-retro-mem2, code-mode-rug-rework-2026,
code-mode-rug-rework-2026b, code-mode-rug-rework-fix, code-mode-rug-verify,
code-mode-serena, code-mode-serena-2, code-mode-serena-adr,
code-mode-serena-adr-audit, code-mode-serena-adr-read, code-mode-serena-arbiter,
code-mode-serena-check, code-mode-serena-check-adr012, code-mode-serena-code,
code-mode-serena-gate, code-mode-serena-inspect, code-mode-serena-inv,
code-mode-serena-inventory, code-mode-serena-live-inv,
code-mode-serena-live-verify, code-mode-serena-live-verify-check,
code-mode-serena-liveverify, code-mode-serena-lvverify, code-mode-serena-mem,
code-mode-serena-mem-check, code-mode-serena-mem-inspect,
code-mode-serena-mem-inspect2, code-mode-serena-mem-update,
code-mode-serena-mem-write, code-mode-serena-memory-fork,
code-mode-serena-memory-ops, code-mode-serena-memory-rw,
code-mode-serena-memory-store, code-mode-serena-memory-write,
code-mode-serena-observability-append, code-mode-serena-persist,
code-mode-serena-read, code-mode-serena-read-lv, code-mode-serena-read-mem,
code-mode-serena-read-once, code-mode-serena-reader, code-mode-serena-recall,
code-mode-serena-recall-check, code-mode-serena-recall-live-verif,
code-mode-serena-recall2, code-mode-serena-research-codemode,
code-mode-serena-retro, code-mode-serena-rug-rework, code-mode-serena-store,
code-mode-serena-store-sandbox-root, code-mode-serena-v2,
code-mode-serena-validate-adr, code-mode-serena-validate-check,
code-mode-serena-validator, code-mode-serena-verify, code-mode-serena-write,
code-mode-serena-write-delegation, code-mode-serena2, code-mode-serenatools,
code-mode-serenautil, code-mode-tav2, code-mode-tavily-search-oy,
code-mode-trio-fix, code-mode-validation, code-mode-verify, code-mode-web,
code-mode-webcheck
```

### github — 61

`api.githubcopilot.com/mcp/x/all/readonly`. Includes Actions, security
advisories, Copilot spaces, projects, and team reads.

```text
actions_get, actions_list, get_code_quality_finding, get_code_scanning_alert,
get_commit, get_copilot_space, get_dependabot_alert, get_discussion,
get_discussion_comments, get_file_contents, get_gist,
get_global_security_advisory, get_job_logs, get_label, get_latest_release,
get_me, get_notification_details, get_release_by_tag, get_repository_tree,
get_secret_scanning_alert, get_tag, get_team_members, get_teams,
github_support_docs_search, issue_read, list_branches,
list_code_scanning_alerts, list_commits, list_copilot_spaces,
list_dependabot_alerts, list_discussion_categories, list_discussions,
list_gists, list_global_security_advisories, list_issue_fields,
list_issue_types, list_issues, list_label, list_notifications,
list_org_repository_security_advisories, list_pull_requests, list_releases,
list_repository_collaborators, list_repository_security_advisories,
list_secret_scanning_alerts, list_starred_repositories, list_tags,
projects_get, projects_list, pull_request_read, repository_ruleset_read,
run_secret_scanning, search_code, search_commits, search_issues, search_orgs,
search_pull_requests, search_repositories, search_users,
semantic_issue_similarity_search, ui_get
```

### filesystem — 28

Rust filesystem server, scoped to ten allowed directories. `ALLOW_WRITE=true`,
so the write/move/zip tools are live and must not be used by read-only probes.

```text
calculate_directory_size, create_directory, create_text_file, directory_tree,
edit_file, execute_shell_command, find_duplicate_files, find_empty_directories,
get_file_info, head_file, list_allowed_directories, list_directory,
list_directory_with_sizes, move_file, read_file, read_file_lines,
read_media_file, read_multiple_media_files, read_multiple_text_files,
read_text_file, replace_content, search_files, search_files_content, tail_file,
unzip_file, write_file, zip_directory, zip_files
```

### serena — 25

Code intelligence plus the entire memory store surface. `read_memory`,
`list_memories`, `write_memory`, `edit_memory`, `delete_memory`, and
`rename_memory` are serena tools, not a separate memory server.

```text
activate_project, check_dependency_vulnerabilities, delete_memory, edit_memory,
find_declaration, find_file, find_implementations, find_referencing_symbols,
find_symbol, get_available_languages, get_current_config,
get_diagnostics_for_file, get_symbols_overview, initial_instructions,
insert_after_symbol, insert_before_symbol, list_dir, list_memories,
read_memory, rename_memory, rename_symbol, replace_symbol_body,
safe_delete_symbol, search_for_pattern, write_memory
```

### tavily — 5

Five tools exist; `catalog.yaml` declares only `tavily_search` and
`tavily_extract`. Search and research consume API quota.

```text
tavily_crawl, tavily_extract, tavily_map, tavily_research, tavily_search
```

### fetch — 1

```text
fetch
```

### deepwiki — 3

```text
ask_wiki_question, read_wiki_contents, read_wiki_structure
```

### context7 — 2

```text
query-docs, resolve-library-id
```

### youtube-transcript — 3

```text
get_timed_transcript, get_transcript, get_video_info
```

### gateway-native — 9

Catalog management and session wrappers. `mcp-exec` still works and still
accepts bare upstream names.

```text
mcp-activate-profile, mcp-add, mcp-config-set, mcp-create-profile, mcp-exec,
mcp-find, mcp-remove, onboarding, open_dashboard
```

### other — 1

```text
custom_properties_read
```

### Groups the task expected but that do not exist

| Expected group | Count | Reality |
| --- | --- | --- |
| `adr` | 0 | No server of that name. ADRs are serena memory entries under `architecture/adr/*`. |
| `memory` | 0 | No server of that name. Memory tools are in `serena` (5 of the 25). |

Arithmetic check: 118 + 61 + 28 + 25 + 5 + 1 + 3 + 2 + 3 + 9 + 1 = 256.

## Verified call forms

Every form below was invoked, not inferred. `typeof` inspection is not evidence:
`tools.gateway["serena"]` resolves to something function-shaped, but calling
through it fails.

### Reading a memory

```text
tools.gateway["read_memory"]({ memory_name: "architecture/about" })
```

Result shape: `{ result: string }` — one key, `result`, holding the raw markdown
body. First 120 characters of `result`:

> `# Architecture\n\nHome for architecture decisions: records Architecture Decision Records (ADRs) with structured frontmatter, optio`

Nested form fails, with this exact error:

```text
Error: Unknown tool 'gateway.serena.read_memory'. Did you mean tools.gateway["code-mode-serena-adr-read"]?
```

`mcp-exec({ name: "read_memory", arguments: { memory_name: "architecture/about" } })`
also returns the memory, so direct addressing is not the only path.

### Listing memories

```text
tools.gateway["list_memories"]({})
```

Result shape: `{ result: string }` where the string is itself JSON,
`{"memories": ["ai-engineering/about", ...]}`. The list is nested one level
deeper than the outer object suggests: parse `JSON.parse(result).memories`.
First 120 characters:

> `{"memories": ["ai-engineering/about", "ai-engineering/youtube/ai-engineer-channel-recent-videos", "architecture/about", ...`

### Confirmation table

| Capability | Verified call form | Evidence |
| --- | --- | --- |
| Reading a memory | `tools.gateway["read_memory"]({memory_name})` | `{result: string}`; body starts `# Architecture`; 25 KB-scale markdown returned |
| Listing memories | `tools.gateway["list_memories"]({})` | `{result: string}`, inner JSON `{"memories": [...]}` with `ai-engineering/about` first |
| Reading a file | `tools.gateway["read_text_file"]({path, head: 500, tail: 0})` | Returns a bare string; starts `"""Edge-optimized agent – construction + execution entry-point with inline tools.` |
| Listing a directory | `tools.gateway["list_directory"]({path})` | Returns lines prefixed `[FILE]`/`[DIR]`; `/workspace/tests` starts `[FILE] test_edge_agent.py` |
| Web fetch | `tools.gateway["fetch"]({url})` | `Contents of https://example.com/:\n<p>Example Domain</p>` — no quota |
| GitHub read | `tools.gateway["get_me"]({})` | `{"login":"Th3Un1q3","id":19877114,"profile_url":"https://github.com/Th3Un1q3",...}` |
| Web search (tavily) | unverified — not called, spends quota | — |
| Writing a memory | unverified — out of scope, read-only task | — |

`read_text_file` rejected `/workspace/AGENTS.md`: `Access denied - path is
outside allowed directories`. The allow-list is the ten directories in
`catalog.yaml`, so `docs/` is reachable only through a non-filesystem path.

## What earlier documents claim that these calls contradict

Both corrected records below already carry a correction banner, but their
verdicts still drive the plan's NO-GO table.

| Claim | Source | Observation |
| --- | --- | --- |
| `Object.keys(tools.gateway)` is `["code-mode", "mcp-exec", "mcp-find"]` | `phase0-baseline.md` V5, §3 | 256 keys, of which only 9 are gateway-native. V5's FAIL is a pre-change artefact. |
| Upstream names are not resolvable; `mcp-exec({name:"list_memories"})` errors with `Tool list_memories not found in current session` | `phase0-baseline.md` V4/V5 rationale, `r1-contract-probe.md` rows 4–5 | `mcp-exec({name:"read_memory", ...})` returned the memory. Bare names resolve now. |
| The only working form is two-step: register a sandbox with `code-mode` `{name, servers}` then call it | `r1-contract-probe.md` §Conclusion | Direct `tools.gateway["<tool>"]({...})` works with no registration step. |
| Every gateway tool carries the `gateway_` prefix (`gateway_mcp-exec`, `gateway_code-mode`) | `context-gathering` skill preamble | No key has that prefix. Keys are bare tool names; the namespace itself is `tools.gateway`. |
| A `code-mode` activation with `{name, servers}` must run before any gateway work | `context-gathering` skill, "Gateway pre-flight" | Six read-only calls succeeded without any activation. |
| Serena memories must not be read directly; only a `bash cat .serena/memories/<id>.md` fallback is permitted when the gateway returns empty | `context-gathering` skill, "Never read Serena files directly" | `read_memory` and `list_memories` are directly callable and return full bodies. The `bash cat` fallback never engaged. |
| Per-upstream tool permission narrowing has no gateable surface | `phase0-baseline.md` P5 NO-GO | 256 individually named actions now exist (`write_memory`, `mcp-add`, ...), so the premise for NO-GO is obsolete. |
| `mcp/catalog.yaml` declares the tavily tool set exhaustively | `catalog.yaml` lines 16–18 | Two declared, five present: `tavily_crawl`, `tavily_map`, `tavily_research` are undeclared. |

Not contradicted, worth keeping: `mcp-find` still returns servers rather than
tools, and `fetch` remains the only quota-free web path.
