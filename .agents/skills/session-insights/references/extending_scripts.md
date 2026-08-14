# CLI Usage & Adding Scripts

Use `scripts/session_parts.py`, the Click-based CLI with two flows — `conversation` (readable transcript) and `parts` (targeted extraction) — and follow this file's conventions when adding new scripts. Run via `uv run` (click resolves from the project environment).

## Usage

Two flows, one top-level `--session-file-json` option:

```bash
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> conversation --format short-human-readable
uv run .agents/skills/session-insights/scripts/session_parts.py --session-file-json <session.json> parts [--message-id <id>]... [--tool-id <callID>]... [--part-id <prt_id>]...
```

Or via the just pass-through recipe:

```bash
just agent_utils/session-parts --session-file-json <session.json> conversation --format short-human-readable
just agent_utils/session-parts --session-file-json <session.json> parts --tool-id <callID> --message-id <msg_id> --part-id <prt_id>
```

Both commands read a session export JSON and write to stdout. Missing file or invalid JSON → error to stderr, exit 1.

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

## Schema notes

Facts from real exports that matter when writing queries or scripts (full reference: [schema.md](./schema.md)):

- Tool parts use `callID` — there is no `tool_call_id` field
- No `output_length` field in exports; compute `len(state.output)`
- Truncation marker: `state.metadata.truncated`
- ID prefixes: messages `msg_...`, parts `prt_...`, sessions `ses_...`
- Tool `state` is a union discriminated on `status`: `completed` / `error` / `pending` / `running`; on `error`, `state.output` is null and `state.error` carries the message

## Adding a script or command

- `#!/usr/bin/env python3` shebang; Click-based Python 3 CLI
- One `click.group()` per CLI; one subcommand per flow (`conversation`, `parts`)
- Group options shared by all subcommands, `--session-file-json`-style
- `cli()`/`main(argv=None) -> int` entry; `sys.exit(main())` under `__main__`
- Read fields defensively: `.get()`, tolerate missing/`None`; print errors to stderr and exit non-zero
- Add tests under `tests/` using the real-session fixture `tests/fixtures/session.json`, invoked via `uv run --quiet`
- Run the CLI via `uv run` (click resolves from the project environment)
