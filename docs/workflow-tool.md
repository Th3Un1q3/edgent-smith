# Subtask tools

The `workflow` tool and its script runner are retired (ADR-012, ADR-017). The plugin now registers three standalone tools:

- `subtask_run` runs one child subtask and returns its result.
- `subtask_ls` lists the child subtasks of the calling session.
- `subtask_outputs` reads a subtask's latest assistant outputs from its session.

## subtask_run

Arguments:

| Field | Required | Default | Purpose |
|---|---|---|---|
| `prompt` | Yes | none | Text sent to the child session. Must be non-empty. |
| `description` | Yes | none | One-line indication of what the subtask does, truncated to 80 characters. A new child session takes exactly this text as its title, with no run-id prefix and no lifecycle marker; the plugin sets no title on a fork. Fork provenance appears in the result's `forked_from`. |
| `agent` | No | `rug-swe` | Agent that handles the child prompt. Child tool access follows that agent's permission scopes. |
| `skills` | No | none | Skill names resolved through the session's native skill list and injected into the child prompt as a `<task_skills>` envelope: one `<skill name="...">` element per skill, holding a `description:` line when the skill declares one, a `path:` line relative to the session directory when the record exposes a path inside it, and then the skill body with its YAML frontmatter stripped. Nothing is read from `.agents/skills/` on disk. Unknown names are skipped and logged. |
| `task_id` | No | none | Resume an existing child session instead of creating or forking one. Mutually exclusive with `fork_from`. |
| `fork_from` | No | none | Fork this session id, copy its conversation history up to the latest message, and deliver this subtask's prompt as the followup on the fork. The result's `task_id` is the new fork id. Surrounding whitespace is trimmed, and a blank or whitespace-only value is rejected: the subtask returns `status: 'error'` with an error naming a non-empty session id. Mutually exclusive with `task_id`. |
| `label` | No | none | Session-scoped alias for the child. The first call binds the label to the child it creates, every later call with that label resumes the same child, and a label never rebinds; a finished child resumes, while a running or dead (`error`/`aborted`) one returns `status: 'error'`. Mutually exclusive with `task_id` and `fork_from`. |
| `timeout_minutes` | No | `15` | Per-subtask timeout in minutes. On expiry the subtask returns `status: 'timeout'` and an `error` naming the limit in minutes. |
| `schema` | No | none | JSON Schema object requesting structured output. See Structured output. |

`task_id` resumes a child session. You still pass a `prompt`; the child sees the new prompt in its existing context.

`task_id` and `fork_from` are mutually exclusive. Pass at most one, because either alone selects the mode: `task_id` resumes, `fork_from` forks. Supplying both returns a subtask with `status: 'error'` and an `error` naming the conflict; the runtime rejects the ambiguity before it touches either session.

`fork_from` branches instead of appending. The runtime forks the named session, copying its history up to the latest message, then sends this subtask's prompt as the followup on the fork. The result's `task_id` is the fork id, and `forked_from` repeats the source id. The runtime trims surrounding whitespace from `fork_from` and rejects a blank or whitespace-only value with `status: 'error'`, rather than falling back to a fresh session or the source. The fork is independent of the source, so later turns on the fork leave the source session alone. Omit `fork_from` and the subtask creates a fresh child exactly as before. Pass a returned `task_id` to a later `subtask_run({ task_id })` call to continue that fork or fresh child.

A fork is not a `parentID` child, so `subtask_ls` does not list it: the tool lists only child sessions whose parent is the calling session, and each entry's `status` is `ok` or `error`. The returned `task_id` still names the fork directly. Forking also needs a reachable OpenCode service client, which the runtime resolves lazily from the running server. If it cannot resolve or the fork call fails, the subtask returns `status: 'error'` and there is no fallback to resuming the source session.

Result fields:

| Field | Type | Meaning |
|---|---|---|
| `outputText` | string | Text parts joined with newlines, in full. |
| `task_id` | string | Child session id. Pass it back to continue the conversation. On a forked subtask this is the fork id. |
| `forked_from` | string, absent unless forked | Source session id when `fork_from` was set. |
| `label` | string, absent unless labelled | The child's session-scoped alias, echoed from the call's `label`; present only when the call carried one. |
| `status` | string | One of `ok`, `error`, `empty`, `timeout`, `aborted`. |
| `error` | string, absent on success | Failure message. |
| `durationMs` | number | Wall time for the call. |
| `data` | unknown, absent unless requested | Parsed value for a schema subtask. Absent when no `schema` was passed or parsing failed; never truncated or stringified. |

Treat `status !== 'ok'` as a failure and decide what to do: retry, fall back, or surface it. Read `outputText` by default; read `data` only when the next step needs a machine value, such as a branch, loop, or merge.

Interrupting the `subtask_run` call aborts the running child session, so the child stops instead of running to its timeout.

### Structured output

Pass `schema` as a JSON Schema object to ask the child for machine-readable output alongside its normal answer.

```json
{
  "prompt": "Classify this issue: login fails for SSO users",
  "description": "classify SSO issue",
  "schema": {
    "type": "object",
    "properties": { "label": { "type": "string" }, "severity": { "type": "number" } },
    "required": ["label", "severity"]
  }
}
```

Structured output is not the default. Ask for plain prose unless the caller mechanically consumes a value. Use `schema` only in one of three cases:

- Branch or loop condition: the next step reads a named field to choose a path or end a loop. A lone completion verdict is not this case; match a first-line `PASS`/`FAIL` with a regex.
- Fan-out or loop driver: an array the caller iterates or fans out over.
- Typed hand-off or merge: a later step consumes named fields, or a map-reduce merges by field.

Decision test: does the next step branch, loop, merge, or template on this value? Yes: use `schema`. No: use prose.

These shapes pay the schema cost for nothing:

- A reducer that echoes child `data` fields or reshapes prose into nested fielded objects nothing consumes, such as `code: { verdict: v.data.verdict, findings: v.data.findings.slice(0, 3) }`. Returning one child's `outputText` under a single result key, such as `{ summary: merged.outputText }`, is ordinary delivery and stays legal; several child-derived strings collapse into one prose line, not a multi-key object.
- `*Status:` mirror keys and producer bookkeeping such as `produced: { source: p1.data.filesChanged }`.
- A report schema wrapping prose the child already returned.
- A single verdict that a first-line `PASS`/`FAIL` check covers.

Return only outcomes the child produced, never a value the orchestrator itself defined. Echoing a hardcoded path, id, label, or config constant adds nothing. Return a short outcome line, decisions reached, artifact paths a child produced, and decision-bearing counts.

`subtask_run` runs in one of two modes.

- No `schema`: the child returns plain text and the result carries no `data`.
- With `schema`: the child returns its complete answer, optionally with free-form prose or code, plus exactly one JSON block between `<result_json>` and `</result_json>`. Only JSON goes inside the tags; do not wrap it in a markdown fence.

The injected contract asks for that shape and appends the schema. The parser then:

1. Scans tagged blocks in reverse order, from the last opening tag to the first, and parses the first block that yields valid JSON.
2. Strips an inner markdown fence if the child added one.
3. Falls back to the older path for models that return pure JSON. Strip a wrapping code fence from the whole reply, then `JSON.parse`.

A reply is usable when it parses as JSON and, if `schema.required` is a non-empty array of strings, every name in it is a key of the parsed object. When the reply is unusable, the runtime sends at most one corrective follow-up on the same session with a tag-specific instruction and parses again. If the retry is still unusable, the subtask returns `status: 'error'` with `error: 'subtask did not return valid JSON matching the schema'`. A reply with no text yields `status: 'empty'` instead.

`outputText` stays the full raw reply for debugging. `data` holds the parsed JSON and is never truncated or stringified. The timeout and abort cover both the first call and the follow-up.

Two limits worth knowing:

- This is a prompt contract plus `JSON.parse` plus a required-keys check, not a full JSON-Schema validator. Nested constraints, types, enums, and formats go unchecked. Validate `data` before trusting it.
- The SDK supports native structured output through `body.format`, but the runtime does not use it. See ADR-003. The available model rejects formatted requests in thinking mode, and formatted sessions break `session.messages`.

### Model inheritance

Subtasks run on the parent session's model. The runtime reads the parent session's messages from newest to oldest and passes the first provider and model it finds to the child prompt. When it finds none, the child runs without an explicit model.

`agent` picks which agent handles the child; it does not change the model. Children that omit `agent` use the built-in default, `rug-swe`.

If the inherited model is unavailable, the child prompt call fails and the subtask returns `status: 'error'`, or `status: 'empty'` when the child returns no text. Check `status` before using `outputText`.

### Orchestration patterns

Each `subtask_run` call runs one child and returns one result. The caller sequences the calls; nothing in the plugin fans out or queues them.

- Chain: pass the previous result's `outputText` into the next prompt, and its `task_id` when the next step should continue the same child conversation instead of starting fresh.
- Fork fan-out: one call reads the source document and returns its `task_id`. Later calls pass that id as `fork_from`, so every fork starts from the same document. A final call synthesizes the answers. Each fork copies the source history, so N forks multiply the tokens the source document costs; reuse one fork id with `task_id` when follow-up turns should keep that fork's context.
- Map-reduce: run one call per independent item, then one final call that merges the outputs.
- Structured classification: run one schema call per item, then reduce over `data` by field. When the merge only needs each child's prose, skip the schema and read `outputText`.
- Branch: when `data` drives the decision, the next call follows the branch the field selects; no text parser is needed.
- Retry loop: failures are values, so reissue the call with the same `task_id` or a corrected prompt until `status` is `ok`.

Every call costs one child session, including retries and calls that end `aborted`.

## subtask_ls

Arguments:

| Field | Range | Default | Purpose |
|---|---|---|---|
| `count` | 1 to 50 | 10 | Maximum rows to return. |
| `status` | `ok` or `error` | none | Return only subtasks with this status. |

Returns an array of `{ description, durationMs, task_id, status }` for the child sessions parented to the calling session. Forks have no `parentID` link and do not appear; use the `task_id` the fork returned. `subtask_ls` strips a leading `[ok]` or `[error]` from a child title before returning it.

## subtask_outputs

The only reader for a child's output. It reads the child session's stored messages through the client `message.list` call, so its output survives a plugin restart.

Arguments:

| Field | Range | Default | Purpose |
|---|---|---|---|
| `task_id` | non-empty string | none | Child session id to read; the `task_id` returned by `subtask_run`. No field is required, and an absent, unknown, or empty id returns an empty array. |
| `count` | 1 to 5 | 3 | Maximum outputs to return. The tool clamps the value to 1-5. |

Returns an array of `{ task_id, outputText, sent_at, status }`, oldest first. `outputText` is one message's assistant text parts joined with newlines, oldest part first. `sent_at` is an ISO timestamp. `status` is `ok`, or `error` when the message carries an error or finished with `error` or `content-filter`. An absent, empty, or unknown id returns `[]`: an empty array means no output was read, not that the child failed.

Each call titles its result `subtask_outputs: <n> output(s)`.

## Live progress

The plugin reports no live progress. `subtask_run` returns when the child settles, and its call path wires no toast sink, so no toast fires and no session title carries a run id. Inspect children with `subtask_ls` or `subtask_outputs`, or open the session.

A newly created child keeps the `description` it was created with; the runtime never rewrites a title and sets none on a fork.

Child sessions are real sessions, so the session switcher shows them and you can open one directly; `opencode session list` prints top-level sessions only, so a child is reached by id. A normal subtask sets `parentID` to the calling session when it creates the child; a forked subtask is created via `session.fork` instead, and its parent linkage is established server-side rather than by the plugin. They are not nested inline under the tool call: that nested subagent view is hard-gated to the built-in `task` tool in this opencode version and a plugin tool cannot render it. Open a child from the session list, or resume it with `opencode run --session <id>`.

Each tool call titles its own result: `subtask_run: <status>`, `subtask_ls: <n> subtask(s)`, and `subtask_outputs: <n> output(s)`.

## Debugging

Children are normal sessions, so you can inspect them after the fact.

These recipes were verified against opencode v2.4.1 on 2026-11-24. That version has no `db` subcommand and no top-level `export`: sessions are exported with `opencode session export`, and the store is queried through Python's `sqlite3` module because no `sqlite3` binary is on PATH. Current sessions live in `session_v2`, `session_message`, and `session_part`; the older `session`, `message`, and `part` tables stopped taking rows on 2026-10-05, so a query against them returns nothing for a new session.

Capture the session id. The run prints it, and you can also read the newest session:

```bash
opencode session list -n 5 --format json
```

Export the session to JSON:

```bash
opencode session export "$SESSION_ID" > session.json
```

Tool calls live in each assistant message's `content[]` array, where an entry with `type: "tool"` carries `name` and `state`.

Pull the `subtask_run` call and its result:

```bash
jq '.. | objects | select(.name? == "subtask_run") | {status: .state.status, output: .state.output}' session.json
```

Parse the result from the tool output:

```bash
jq -r '.. | objects | select(.name? == "subtask_run") | .state.output | fromjson? | {status, error, task_id}' session.json
```

If `jq` is unavailable or the export is missing, query the SQLite store directly. Tool calls live in `session_part.data` as JSON text, with the tool name at `$.name` and the call state at `$.state`. The store is `/home/vscode/.local/share/opencode/opencode.db` on this machine; another machine's path differs, and `opencode debug paths` prints the `db` line for it.

```bash
DB=$(opencode debug paths | awk '/^db /{print $2}')
q() { python3 -c 'import sqlite3,sys,json
c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True)
cur=c.execute(sys.argv[2])
print(json.dumps([dict(zip([d[0] for d in cur.description],r)) for r in cur]))' "$DB" "$1"; }

q "SELECT p.message_id, p.call_id, p.time_created FROM session_part p WHERE p.session_id = '$SESSION_ID' AND p.type = 'tool' AND json_extract(p.data,'$.name') = 'subtask_run'"
```

Opening the store with `mode=ro` leaves the running server's write-ahead log untouched. There is no interactive `db` shell; add further queries to the same `q` call.

## Inspecting subsessions

A new child session is created with the `description` (truncated to 80 characters) as its title, with no run-id prefix and no lifecycle marker; the runtime never updates the title, and it sets none on a fork. A normal subtask creates a child session parented to the session that called `subtask_run`; one with `fork_from` forks the named session instead, and its `forked_from` field records the source id. These parented child sessions are real sessions, so the session list and switcher expose them; opening one is the supported way to inspect a child, since the inline nested view under the tool call is not available to plugin tools. The result carries the handle you need: each subtask result has `task_id`.

`opencode session list --format json -n 20` prints top-level sessions only, so a child never appears, and reports only `id`, `title`, `updated`, `created`, `projectId`, and `directory`. It does not expose the parent link, so query the store for relationships with `q` and `DB` from Debugging.

```bash
# Children of any session, newest first.
q "SELECT id, parent_id, title, datetime(time_created/1000,'unixepoch') AS created FROM session_v2 WHERE parent_id IS NOT NULL ORDER BY time_created DESC LIMIT 20"

# Children of one parent.
q "SELECT id, title FROM session_v2 WHERE parent_id = '$PARENT_SESSION_ID' ORDER BY time_created"

# Messages and parts of a child session.
q "SELECT id, type, datetime(time_created/1000,'unixepoch') AS created FROM session_message WHERE session_id='$CHILD_SESSION_ID' ORDER BY seq"
q "SELECT message_id, ordinal, type FROM session_part WHERE session_id='$CHILD_SESSION_ID' ORDER BY ordinal"

# Export the child, then read its tool calls from the JSON.
opencode session export "$CHILD_SESSION_ID" > child.json        # pass the id; no-arg export goes interactive
opencode session export "$CHILD_SESSION_ID" --sanitize > child.json   # redact sensitive transcript and file data
```

- `session_v2.parent_id` names the parent and `session_v2.id` the child. `time_created` and `time_updated` are Unix milliseconds, so use `datetime(time_created/1000,'unixepoch')`; the naive `datetime(time_created)` returns null.
- `opencode session export` writes `{info, messages[]}`. `info.parentID` names the parent; each message is `{id, type, text, time, files}` for prose, and an assistant turn adds `agent`, `model`, `content[]`, `tokens`, `cost`, and `finish`; `type` is the role (`user`, `assistant`, `system`) and each `content[]` entry with `type: "tool"` carries `name` and `state`.
- Resume a child directly with `opencode run --session "$CHILD_SESSION_ID" "follow-up"`. `--fork` branches instead of appending, and `--continue` resumes the last session.
- There is no CLI busy or status field. For live runs, poll `session_v2.time_updated` in the store or re-run `opencode session list`, which orders by `updated`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `status: 'empty'` | Child returned no text. | Make the prompt more specific or use a different agent. |
| `status: 'timeout'` | Child exceeded `timeout_minutes`. | Raise `timeout_minutes` or send a smaller prompt. |
| `status: 'error'` | Child reported an error, the call failed, the input was invalid, or a schema reply stayed unusable after the follow-up. | Read `error`, then retry or fall back. |
| Huge `outputText` | Child returned a long reply; `outputText` carries it in full. | Ask children for short answers. |
| `subtask_ls` returns `[]` | No child is parented to this session, or the child is a fork. | Use the `task_id` the fork returned, then `subtask_outputs`. |
| `subtask_outputs` returns `[]` | The id is absent, unknown, or empty. | Re-run the subtask or read the child session directly. |
