# CLI Usage & Adding Scripts

Use `scripts/session_parts.py`, the Click-based CLI with four flows — `conversation` (readable transcript), `parts` (targeted extraction), `info` (session-level stats), and `summary` (review.md §3–§7 aggregations) — and follow this file's conventions when adding new scripts. Run via `uv run` (click resolves from the project environment).

## Usage

Four flows, one top-level `--session-file-json` option:

```bash
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> conversation --format short-human-readable
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> parts [--message-id <id>]... [--tool-id <callID>]... [--part-id <prt_id>]...
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> info [--format json|key=value|markdown]
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> summary [--format json|markdown]
```

Or via the just pass-through recipe:

```bash
just agent_utils/session-parts --session-file-json <session.json> conversation --format short-human-readable
just agent_utils/session-parts --session-file-json <session.json> parts --tool-id <callID> --message-id <msg_id> --part-id <prt_id>
just agent_utils/session-parts --session-file-json <session.json> info
just agent_utils/session-parts --session-file-json <session.json> summary --format markdown
```

All commands read a session export JSON and write to stdout. Missing file or invalid JSON → error to stderr, exit 1.

**Known quirk:** subcommand `--help` (e.g. `... conversation --help`) exits 2 with a usage error unless `--session-file-json` is supplied first — click validates the required group option before it reaches the subcommand's help. Always invoke help with the flag present: `... --session-file-json <session.json> conversation --help`.

## What `conversation --format short-human-readable` outputs

The compact transcript: one line per text and tool part, in session message order. Excerpts over 200 chars (message text, tool input, tool output, tool error) middle-truncate to exactly 200: `s[:99] + "..." + s[-98:]` — first ~99 chars, last ~98 chars, ellipsis in the middle.

- **text parts**: `msg_<id> [<role>]: <text>`
- **tool calls (completed)**: `msg_<id> [<role>] tool <name> called <callID>, output_length=<N>, input: "...", output: "..."` — input/output excerpts truncated to 200; `output_length` is `len(state.output)`
- **tool calls (error)**: `msg_<id> [<role>] tool <name> called <callID>, error: "..."`
- **tool calls (other status)**: head reference line only, no status
- Omitted: reasoning, step-start, step-finish, patch, compaction, file parts

## What `parts` outputs

Human-readable blocks, in order: PART blocks (by `--part-id`), then TOOL blocks (by `--tool-id`), then MESSAGE blocks (by `--message-id`); blank line between blocks. No matches → empty output, exit 0.

- **part block** (`--part-id <prt_id>`): text and reasoning parts show `part <prt_id> (<type>, message <messageID>):` then `  text: <full text, untruncated>`; tool parts show truncated `input:` / `output:` / `output_length:` / `error:`; other types get the header only. `--part-id` is how you extract reasoning parts — any part type works by its `prt_...` id.
- **tool block** (`--tool-id <callID>`): header `tool <name> called <callID> (message <messageID>, status=<status>):`, then truncated `input:`; for completed calls, `output:` and `output_length:`; for errors, `error:`
- **message block** (`--message-id <id>`): header `message <id> (role=<role>):`, then one line per part — `text:` (full, untruncated), `tool <name> called <callID>`, or bare part type

## What `info` outputs

Session-level stats read from `.info` (identity, model, timings, tokens, cost) — the fields `conversation`/`parts` cannot answer. `--format` defaults to `key=value` (chosen for justfile parsing: one `label=value` per line, greppable and awk-friendly); `json` and `markdown` are also available. Missing fields never crash — they print as the literal `unknown` (or `"unknown"` in JSON).

Fields, in output order: `id`, `slug`, `title`, `agent`, `model.id`, `model.providerID`, `created`, `updated`, `duration`, `tokens.input`, `tokens.output`, `tokens.reasoning`, `tokens.cache.read`, `tokens.cache.write`, `tokens.total`, `cost`.

- `duration` is computed from `.info.time` `updated − created` as human-readable `Xh Ym Zs` / `Ym Zs` / `Zs`
- `tokens.total` is the stored `.info.tokens.total` when present, else computed `input + output + reasoning + cache.read`
- `markdown` emits a two-column `| Field | Value |` table with the same field names

## What `summary` outputs

Aggregations over `messages` shaped for review.md §3–§7, as markdown tables (default) or one JSON object (`--format json`). Sections:

- **§3 Skills Loaded** — per plan §9 "loaded" definition: counts a skill if EITHER (a) the session has a native `skill` tool call (name from `state.input.name`), OR (b) a `<skill name="..." path="...">` tag appears INSIDE a `<task_skills>` payload in a user text part (the delegated envelope form). Bare prose `<skill ... location=.../>` tags are inert text and are excluded — the scan is scoped to `<task_skills>` payloads only. Table: `| Skill Name | Directory | Truncated? |`; delegated loads show the envelope `path` as Directory and `—` for Truncated.
- **§4 Steering Instructions** — text parts starting with `<steering`; severity from `priority="..."`, reason from `reason="..."`.
- **§5 Tool Calls** — per-tool `count` / `success` (`state.status == "completed"`) / `errors` (`state.status == "error"`), sorted by tool name.
- **§6 Consolidated Errors** — tool parts with `state.status == "error"`, step-finish parts with an error state/`state.error`, and reasoning parts mentioning `error`/`fail` (text truncated to 200 chars).
- **§7 Token Distribution** — same `.info.tokens` fields and computed total as `info`, plus a `Cost:` row.

JSON shape: `{"skills": [{name, source: "tool"|"delegated", dir, truncated}], "steering": [{severity, reason}], "tools": {name: {count, success, errors}}, "errors": [{source, callID, description}], "tokens": {...}, "cost": ...}` — keys sorted for stable output.

## Schema notes

Facts from real exports that matter when writing queries or scripts (full reference: [schema.md](./schema.md)):

- Tool parts use `callID` — there is no `tool_call_id` field
- No `output_length` field in exports; compute `len(state.output)`
- Truncation marker: `state.metadata.truncated`
- ID prefixes: messages `msg_...`, parts `prt_...`, sessions `ses_...`
- Tool `state` is a union discriminated on `status`: `completed` / `error` / `pending` / `running`; on `error`, `state.output` is null and `state.error` carries the message

## Adding a script or command

- `#!/usr/bin/env python3` shebang; Click-based Python 3 CLI
- One `click.group()` per CLI; one subcommand per flow (`conversation`, `parts`, `info`, `summary`)
- Group options shared by all subcommands, `--session-file-json`-style
- `cli()`/`main(argv=None) -> int` entry; `sys.exit(main())` under `__main__`
- Read fields defensively: `.get()`, tolerate missing/`None`; print errors to stderr and exit non-zero
- Add tests under `tests/` using the real-session fixture `tests/fixtures/session.json`, invoked via `uv run --quiet`
- Run the CLI via `uv run` (click resolves from the project environment)
