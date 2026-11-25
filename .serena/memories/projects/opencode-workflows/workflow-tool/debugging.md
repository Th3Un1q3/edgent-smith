---
id: projects/opencode-workflows/workflow-tool/debugging
type: entities
L0: "Debugging children on opencode v2.4.1: no db subcommand, no top-level export — session list --format json, session export plus jq on content[].name, and SQLite via python3 sqlite3 against session_v2/session_message/session_part."
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md § Debugging, § Inspecting subsessions; commands run against opencode v2.4.1
---
# Debugging children

The CLI has no `db` subcommand and no top-level `export`, and no `sqlite3` binary is on PATH. Current sessions live in `session_v2`, `session_message`, and `session_part`; the older `session`, `message`, and `part` tables stopped taking rows on 2026-10-05, so a query against them returns nothing for a new session.

## Capture the session id
The run prints it, and `opencode session list -n 5 --format json` lists the newest top-level sessions.

## Export and query with jq
`opencode session export "$SESSION_ID" > session.json` writes `{info, messages[]}`. Each message is `{id, type, text, time, files}`, and an assistant turn adds `agent`, `model`, `content[]`, `tokens`, `cost`, and `finish`. A `content[]` entry with `type: "tool"` carries `name` and `state`; `select(.tool? == ...)` matches nothing because the key is `name`.

```bash
jq '.. | objects | select(.name? == "subtask_run") | {status: .state.status, output: .state.output}' session.json
jq -r '.. | objects | select(.name? == "subtask_run") | .state.output | fromjson? | {status, error, task_id}' session.json
```

## Query SQLite directly
Tool calls live in `session_part.data` as JSON text, with the name at `$.name` and the state at `$.state`. The store is `/home/vscode/.local/share/opencode/opencode.db` here; another machine's path differs, and `opencode debug paths` prints the `db` line.

```bash
DB=$(opencode debug paths | awk '/^db /{print $2}')
q() { python3 -c 'import sqlite3,sys,json
c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True)
cur=c.execute(sys.argv[2])
print(json.dumps([dict(zip([d[0] for d in cur.description],r)) for r in cur]))' "$DB" "$1"; }

q "SELECT p.message_id, p.call_id, p.time_created FROM session_part p WHERE p.session_id = '$SESSION_ID' AND p.type = 'tool' AND json_extract(p.data,'$.name') = 'subtask_run'"
```

`session_part` has no `id` column. `mode=ro` leaves the server's write-ahead log untouched, and there is no interactive `db` shell.

## Inspecting subsessions
`opencode session list --format json -n 20` prints top-level sessions only and reports just id, title, updated, created, projectId, directory, so parent links come from the store:

```bash
q "SELECT id, parent_id, title, datetime(time_created/1000,'unixepoch') AS created FROM session_v2 WHERE parent_id IS NOT NULL ORDER BY time_created DESC LIMIT 20"
q "SELECT id, title FROM session_v2 WHERE parent_id = '$PARENT_SESSION_ID' ORDER BY time_created"
q "SELECT id, type, datetime(time_created/1000,'unixepoch') AS created FROM session_message WHERE session_id='$CHILD_SESSION_ID' ORDER BY seq"
q "SELECT message_id, ordinal, type FROM session_part WHERE session_id='$CHILD_SESSION_ID' ORDER BY ordinal"
opencode session export "$CHILD_SESSION_ID" --sanitize > child.json
```

- `session_v2.parent_id` names the parent and `session_v2.id` the child. `time_created` and `time_updated` are Unix milliseconds; `datetime(time_created)` returns null.
- Resume a child with `opencode run --session "$CHILD_SESSION_ID" "follow-up"`; `--fork` branches and `--continue` resumes the last session.
- There is no CLI busy or status field; poll `session_v2.time_updated` or re-run `opencode session list`, which orders by `updated`.
