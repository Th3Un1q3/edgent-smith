# Subtask tools

The `workflow` tool and its script runner are retired (ADR-012, ADR-017). The plugin now registers three standalone tools:

- `subtask_run` runs one child subtask and returns its result.
- `subtask_ls` lists the child subtasks of the calling session.
- `subtask_tail` returns the last outputs recorded for one subtask id.

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
| `status` | string | One of `ok`, `error`, `empty`, `timeout`, `aborted`. |
| `error` | string, absent on success | Failure message. |
| `durationMs` | number | Wall time for the call. |
| `data` | unknown, absent unless requested | Parsed value for a schema subtask. Absent when no `schema` was passed or parsing failed; never truncated or stringified. |

Treat `status !== 'ok'` as a failure and decide what to do: retry, fall back, or surface it. Read `outputText` by default; read `data` only when the next step needs a machine value, such as a branch, loop, or merge.

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

## subtask_tail

Arguments:

| Field | Range | Default | Purpose |
|---|---|---|---|
| `task_id` | non-empty string | required | Subtask id to tail; matches the `task_id` returned by `subtask_run`. |
| `count` | 1 to 5 | 3 | Maximum outputs to return. |

Returns an array of `{ task_id, outputText, status, updated_at }` in the order recorded, oldest first. Each entry is returned in full: the tool applies no length clamp and no entry carries a `truncated` flag, so the orchestrator truncates when it compacts a report. The tool caps only the number of entries — `count` (1 to 5, default 3) bounds what one call returns — while the store keeps at most 5 live entries per id and drops entries older than 24 hours. An unknown or expired id returns an empty array.

## Live progress

The plugin reports no live progress. `subtask_run` returns when the child settles, and its call path wires no toast sink, so no toast fires and no session title carries a run id. Inspect children with `subtask_ls` or `subtask_tail`, or open the session.

A newly created child keeps the `description` it was created with; the runtime never rewrites a title and sets none on a fork.

Child sessions are real sessions, so the session list and switcher show them and you can open one directly. A normal subtask sets `parentID` to the calling session when it creates the child; a forked subtask is created via `session.fork` instead, and its parent linkage is established server-side rather than by the plugin. They are not nested inline under the tool call: that nested subagent view is hard-gated to the built-in `task` tool in this opencode version and a plugin tool cannot render it. Open a child from the session list, or resume it with `opencode run --session <id>`.

Each tool call titles its own result: `subtask_run: <status>`, `subtask_ls: <n> subtask(s)`, and `subtask_tail: <n> output(s)`.

## Debugging

Children are normal sessions, so you can inspect them after the fact.

Capture the session id. The run prints it, and you can also read the newest session:

```bash
opencode db "SELECT id, title FROM session ORDER BY time_created DESC LIMIT 5"
```

Export the session to JSON:

```bash
opencode export "$SESSION_ID" > session.json
```

Pull the `subtask_run` call and its result:

```bash
jq '.. | objects | select(.tool? == "subtask_run") | {status: .state.status, output: .state.output}' session.json
```

Parse the result from the tool output:

```bash
jq -r '.. | objects | select(.tool? == "subtask_run") | .state.output | fromjson? | {status, error, task_id}' session.json
```

If `jq` is unavailable or the export is missing, query the SQLite store directly. Tool calls live in `part.data` as JSON text:

```bash
opencode db "SELECT p.id, p.time_created, p.data FROM part p WHERE p.session_id = '$SESSION_ID' AND p.data LIKE '%\"tool\":\"subtask_run\"%'" --format json
```

Open the database interactively when you need to explore other tables:

```bash
opencode db
```

## Inspecting subsessions

A new child session is created with the `description` (truncated to 80 characters) as its title, with no run-id prefix and no lifecycle marker; the runtime never updates the title, and it sets none on a fork. A normal subtask creates a child session parented to the session that called `subtask_run`; one with `fork_from` forks the named session instead, and its `forked_from` field records the source id. These parented child sessions are real sessions, so the session list and switcher expose them; opening one is the supported way to inspect a child, since the inline nested view under the tool call is not available to plugin tools. The result carries the handle you need: each subtask result has `task_id`.

`opencode session list --format json -n 20` lists sessions, but reports only `id`, `title`, `updated`, `created`, `projectId`, and `directory`. It does not expose the parent link, so query the store for relationships.

```bash
# Children of any session, newest first.
opencode db "SELECT id, parent_id, title, datetime(time_created/1000,'unixepoch') AS created FROM session WHERE parent_id IS NOT NULL ORDER BY time_created DESC LIMIT 20" --format json

# Children of one parent.
opencode db "SELECT id, title FROM session WHERE parent_id = '$PARENT_SESSION_ID' ORDER BY time_created" --format tsv

# Messages and parts of a child session.
opencode db "SELECT id, json_extract(data,'$.role') AS role, datetime(time_created/1000,'unixepoch') AS created FROM message WHERE session_id='$CHILD_SESSION_ID' ORDER BY time_created" --format tsv
opencode db "SELECT id, message_id, json_extract(data,'$.type') AS type FROM part WHERE session_id='$CHILD_SESSION_ID' ORDER BY time_created" --format tsv

# Export the child, then pull its parts from the JSON.
opencode export "$CHILD_SESSION_ID" > child.json        # pass the id; no-arg opencode export goes interactive
opencode export "$CHILD_SESSION_ID" --sanitize > child.json   # redact sensitive transcript and file data
```

- `session.parent_id` names the parent and `session.id` the child. `time_created` and `time_updated` are Unix milliseconds, so use `datetime(time_created/1000,'unixepoch')`; the naive `datetime(time_created)` returns null.
- `opencode export` writes `{info, messages[]}`. `info.parentID` names the parent; each message pairs `info` (role, id, sessionID) with `parts` (text, reasoning, tool calls).
- Resume a child directly with `opencode run --session "$CHILD_SESSION_ID" "follow-up"`. `--fork` branches instead of appending, and `--continue` resumes the last session.
- There is no CLI busy or status field. For live runs, poll `session.time_updated` in the store or re-run `opencode session list`, which orders by `updated`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `status: 'empty'` | Child returned no text. | Make the prompt more specific or use a different agent. |
| `status: 'timeout'` | Child exceeded `timeout_minutes`. | Raise `timeout_minutes` or send a smaller prompt. |
| `status: 'error'` | Child reported an error, the call failed, the input was invalid, or a schema reply stayed unusable after the follow-up. | Read `error`, then retry or fall back. |
| Huge `outputText` | Child returned a long reply; `outputText` carries it in full. | Ask children for short answers. |
| `subtask_ls` returns `[]` | No child is parented to this session, or the child is a fork. | Use the `task_id` the fork returned, or `subtask_tail`. |
| `subtask_tail` returns `[]` | Unknown or expired id. | Re-run the subtask or read the child session directly. |
