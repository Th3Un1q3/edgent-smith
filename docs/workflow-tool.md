# Workflow tool

The `workflow` tool runs a short JavaScript script that orchestrates subagents. Any agent granted the `workflow` permission can call it; `rug-workflow` is the configured workflow orchestrator. Reach for it when a goal needs several child agents working in parallel, a chain of follow-ups, or a merge step, and you want each call to run one phase and produce one result.

## Overview and mental model

- You write one script. The runtime compiles it as the body of an async function with three helpers in scope: `subtask`, `log`, and `progress`.
- `subtask` creates a child OpenCode session, sends one prompt, and returns a plain object. Child failures come back as values, so one bad child does not throw. The one exception is a budget overrun, covered under Failure handling.
- The runtime caps concurrency and counts every call against a subtask budget. Fan-out with `Promise.all` is safe because the runtime queues the extra calls.
- The tool returns a structured result `{ title, output, metadata }`. `output` is one JSON envelope that describes the whole run: overall status, the script's return value, a step list, counters, and logs. `metadata` carries `status` and `stats`, and `title` is a summary of the run.
- The script is the unit of design. Call `workflow` once per phase and do that phase's orchestration inside the script. A goal may span one or more phases, and each call runs one phase. Several phases per goal are legitimate when a human question, an envelope branch, sizing, or budget forces it.

## Quickstart

Call the `workflow` tool with a `script` string. The script can use top-level `await` and should `return` the value you want in the envelope.

```json
{
  "script": "const r = await subtask('List three files that define the CLI entry point');\nreturn { status: r.status, files: r.outputText };"
}
```

The tool returns `{ title, output, metadata }`. Parse `output` as JSON and read the envelope's top-level fields.

```json
{
  "status": "ok",
  "result": { "status": "ok", "files": "..." },
  "steps": [{ "label": "List three files that define the CLI entry point", "description": "list CLI entry files", "task_id": "ses_...", "status": "ok", "durationMs": 4210, "truncated": false }],
  "stats": { "subtasks": 1, "ok": 1, "error": 0, "empty": 0, "timeout": 0, "aborted": 0, "totalMs": 4300, "truncated": false },
  "logs": []
}
```

If `status` is `ok`, use `result`. If not, read `error` and the per-step `status` values to find what failed.

## DSL reference

### subtask(input)

`subtask` takes either a string prompt or a parameters object. A string is shorthand for `{ prompt, description }`, where the runtime derives `description` from the first 80 characters of the prompt.

```js
const short = await subtask('Summarize the README')

const full = await subtask({
  prompt: 'Summarize the README in three bullets',
  description: 'readme summary',
  agent: 'rug-swe',
  skills: ['context-gathering'],
  timeout_ms: 120000,
})
```

Object fields:

| Field | Required | Default | Purpose |
|---|---|---|---|
| `prompt` | Yes | none | Text sent to the child session. Must be non-empty. |
| `description` | Yes | none | One-line indication of what the subtask does. Used as the step label, the child session title, and the step record, where it is truncated to 80 characters. The string shorthand derives it from the first 80 characters of the prompt. |
| `agent` | No | `rug-swe` | Agent that handles the child prompt. Child tool access follows that agent's permission scopes. |
| `skills` | No | none | Skill names to load from `.agents/skills/<name>/SKILL.md` into the child prompt. Unknown names are skipped and logged. |
| `task_id` | No | none | Resume an existing child session instead of creating one. |
| `timeout_ms` | No | `300000` | Per-subtask timeout in milliseconds. On expiry the subtask returns `status: 'timeout'` and an `error` naming the limit in ms. |
| `schema` | No | none | JSON Schema object requesting structured output. See Structured output. |

`task_id` resumes a child session. You still pass a `prompt`; the child sees the new prompt in its existing context.

Result object:

| Field | Type | Meaning |
|---|---|---|
| `outputText` | string | Text parts joined with newlines, truncated to the per-step cap. |
| `task_id` | string | Child session id. Pass it back to continue the conversation. |
| `status` | string | One of `ok`, `error`, `empty`, `timeout`, `aborted`. |
| `error` | string, absent on success | Failure message. |
| `durationMs` | number | Wall time for the call. |
| `truncated` | boolean | True when `outputText` hit the per-step cap. |
| `data` | unknown, absent unless requested | Parsed value for a schema subtask. Absent when no `schema` was passed or parsing failed; never truncated or stringified. |

Treat `status !== 'ok'` as a failure and decide what to do: retry, fall back, or surface it.

### Structured output

Pass `schema` as a JSON Schema object to ask the child for machine-readable output alongside its normal answer.

```js
const r = await subtask({
  prompt: 'Classify this issue: login fails for SSO users',
  description: 'classify SSO issue',
  schema: {
    type: 'object',
    properties: { label: { type: 'string' }, severity: { type: 'number' } },
    required: ['label'],
  },
})
if (r.status === 'ok') {
  return { label: r.data.label, severity: r.data.severity }
}
```

`subtask` runs in one of two modes.

- No `schema`: the child returns plain text and the result carries no `data`.
- With `schema`: the child returns its complete answer, optionally with free-form prose or code, plus exactly one JSON block between `<result_json>` and `</result_json>`. Only JSON goes inside the tags; do not wrap it in a markdown fence.

The injected contract asks for that shape and appends the schema. The parser then:

1. Scans tagged blocks in reverse order, from the last opening tag to the first, and parses the first block that yields valid JSON.
2. Strips an inner markdown fence if the child added one.
3. Falls back to the older path for models that return pure JSON. Strip a wrapping code fence from the whole reply, then `JSON.parse`.

A reply is usable when it parses as JSON and, if `schema.required` is a non-empty array of strings, every name in it is a key of the parsed object. When the reply is unusable, the runtime sends at most one corrective follow-up on the same session with a tag-specific instruction and parses again. If the retry is still unusable, the subtask returns `status: 'error'` with `error: 'subtask did not return valid JSON matching the schema'`. A reply with no text yields `status: 'empty'` instead.

`outputText` stays the full raw reply, truncated to the per-step cap, for debugging. `data` holds the parsed JSON and is never truncated or stringified. The timeout and abort cover both the first call and the follow-up.

Two limits worth knowing:

- This is a prompt contract plus `JSON.parse` plus a required-keys check, not a full JSON-Schema validator. Nested constraints, types, enums, and formats go unchecked. Validate `data` before trusting it.
- The SDK supports native structured output through `body.format`, but the runtime does not use it. See ADR-003. The available model rejects formatted requests in thinking mode, and formatted sessions break `session.messages`.

### Model inheritance

Subtasks run on the parent session's model. The runtime reads the parent session's messages from newest to oldest and passes the first provider and model it finds to the child prompt. When it finds none, the child runs without an explicit model.

`agent` picks which agent handles the child; it does not change the model. Children that omit `agent` use the built-in default, `rug-swe`.

If the inherited model is unavailable, the child prompt call fails and the subtask returns `status: 'error'`, or `status: 'empty'` when the child returns no text. Check `status` before using `outputText`.

### log(message)

`log` appends a value to the envelope's `logs` array. The runtime JSON-stringifies the value, keeps at most 100 entries, and cuts each entry to 500 characters. Use it for decisions the model should see in the envelope.

```js
log({ phase: 'fan-out', topics: 3 })
```

### progress(input)

`progress` updates the running tool call's live title and metadata while the script runs. The runtime already updates the title at each `subtask` start and finish; call `progress` to add phase-level status on top of that. It is fire-and-forget: it does not create a subtask and its return value is not useful.

```js
progress({ title: 'phase: reduce', metadata: { phase: 'reduce' } })
```

Progress entries never reach the envelope. They only change what the tool call shows live.

## Patterns

### Fan-out

Map over a list and await all results. Concurrency is bounded, so you can hand `Promise.all` more work than the limit.

```js
const topics = ['testing', 'docker', 'skills']

const results = await Promise.all(
  topics.map(topic =>
    subtask({
      prompt: `Summarize the project guidance on ${topic}`,
      description: `research ${topic}`,
    }),
  ),
)

return {
  summaries: results.map((r, i) => ({ topic: topics[i], status: r.status, text: r.outputText })),
}
```

### Chain

Await subtasks in order and pass one result into the next. Add `task_id` when the next step should continue the same child conversation instead of starting fresh.

```js
const draft = await subtask({ prompt: 'Draft a release note for the workflow tool', description: 'draft release note' })

const reviewed = await subtask({
  prompt: 'Tighten this draft and fix any inaccuracies: ' + draft.outputText,
  description: 'review release note',
  task_id: draft.task_id,
})

return { draft: draft.outputText, reviewed: reviewed.outputText }
```

### Map-reduce

Fan out independent work, then run one final subtask that merges the outputs.

```js
const files = ['cli/main.py', 'agents/edge.py', 'evals/runner.py']

const parts = await Promise.all(
  files.map(file => subtask({ prompt: `In one sentence, what does ${file} do?`, description: `scan ${file}` })),
)

const merged = await subtask({
  prompt: 'Merge these summaries into one paragraph:\n' + parts.map(p => p.outputText).join('\n'),
  description: 'merge summaries',
})

return { summary: merged.outputText }
```

### Structured classification and reduce

Ask each child for the same shape, then reduce over `data` instead of re-parsing text.

```js
const schema = {
  type: 'object',
  properties: { label: { type: 'string' }, confidence: { type: 'number' } },
  required: ['label', 'confidence'],
}

const issues = ['login fails', 'slow search', 'stale cache']
const tagged = await Promise.all(
  issues.map(issue => subtask({ prompt: `Classify this issue: ${issue}`, description: `classify ${issue}`, schema })),
)

const failed = tagged.filter(r => r.status !== 'ok')
if (failed.length > 0) return { status: 'error', errors: failed.map(r => r.error) }

const counts = tagged.reduce((acc, r) => {
  acc[r.data.label] = (acc[r.data.label] ?? 0) + 1
  return acc
}, {})

return { counts }
```

The fan-out lives in the child prompts; the reduce reads typed fields, so a child that ignores the schema cannot poison the aggregate with prose.

### Branch on structured data

`data` drives decisions in the script, so escalation never needs a text parser.

```js
const triage = await subtask({
  prompt: 'Assess this incident and return urgency 1-5: checkout latency spike',
  description: 'assess incident urgency',
  schema: {
    type: 'object',
    properties: { urgency: { type: 'number' }, summary: { type: 'string' } },
    required: ['urgency', 'summary'],
  },
})

if (triage.status !== 'ok') return { escalated: false, error: triage.error }

if (triage.data.urgency >= 4) {
  const page = await subtask({ prompt: `Escalate: ${triage.data.summary}`, description: 'escalate' })
  return { escalated: true, page: page.outputText }
}

return { escalated: false, urgency: triage.data.urgency }
```

### Retry loop

Failures are values, so retry with a plain loop. Check `status` after each call and stop when it is `ok`.

```js
let attempt
for (let i = 0; i < 3; i++) {
  attempt = await subtask({ prompt: 'Answer with JSON: {"ok": true}', description: 'answer with JSON' })
  if (attempt.status === 'ok') break
}

return { status: attempt.status, output: attempt.outputText, error: attempt.error }
```

Retries cost subtasks. Each call counts against `max_subtasks`, including retries and calls that end `aborted`.

## Limits and defaults

Tool arguments:

| Argument | Range | Default | Purpose |
|---|---|---|---|
| `script` | non-empty string | none | JavaScript body to run. |
| `timeout_seconds` | 1 to 36000 | 600 | Whole-script timeout. |
| `max_concurrent` | 1 to 8 | 4 | Maximum child sessions in flight. |
| `max_subtasks` | 1 to 64 | 32 | Budget of `subtask` calls for the run. |

Runtime caps:

| Limit | Value |
|---|---|
| Per-subtask timeout | 300000 ms |
| Per-step output | 4000 characters (`outputText` only; `data` is not truncated) |
| Final result | No fixed length; the serializer trims it to fit the envelope byte budget. |
| Envelope | 8192 bytes |
| Logs | 100 entries, 500 characters each |
| Step records | 64 (one per budgeted subtask call, since `max_subtasks` caps at 64) |

When the envelope would exceed its byte cap, the runtime drops logs first, then truncates the result, then drops steps. `stats.truncated` reports that it happened.

## Failure handling

Subtask failures are values. Budget exhaustion is the exception: the next `subtask` call throws `BudgetExceededError` inside the script. If the script does not catch it, the run ends with a `budget_exceeded` envelope. A script that catches it can continue and still return `ok`.

Subtask statuses, seen per step and in `stats`:

| Status | Meaning | What to do |
|---|---|---|
| `ok` | Child returned text. | Use `outputText`. |
| `error` | Child reported an error, the call failed, or a schema reply stayed unusable after the follow-up. | Read `error`, decide whether to retry or fall back. |
| `empty` | Child returned no text. | Retry with a clearer prompt or treat as a miss. |
| `timeout` | Child exceeded `timeout_ms`; `error` names the limit in ms. | Retry with more time or a smaller prompt. |
| `aborted` | The run was cancelled. | Stop; the envelope is already winding down. |

Envelope statuses, seen at the top level:

| Status | Meaning | What to do |
|---|---|---|
| `ok` | Script returned a value. | Read `result`. |
| `error` | Script threw a non-budget error. | Read `error`, fix the script. |
| `timeout` | Script exceeded `timeout_seconds`. | Shorten the script or raise the timeout. |
| `aborted` | The user cancelled the tool call while the script ran. | Stop; the run was stopped deliberately. |
| `budget_exceeded` | An uncaught budget overrun past `max_subtasks`. | Reduce calls or raise the limit; catch the error if a partial result is useful. |
| `invalid_script` | Script has a syntax error. | Rewrite the failing line. |
| `forbidden_script` | Script uses a banned token. | Remove the token and rerun. |

## Result envelope

The tool returns `{ title, output, metadata }`. `output` is a JSON string with these fields, and `metadata` is `{ status, stats }`:

| Field | Type | Notes |
|---|---|---|
| `status` | string | One of `ok`, `error`, `timeout`, `aborted`, `budget_exceeded`, `invalid_script`, `forbidden_script`. |
| `result` | any | The script's return value. JSON omits the key when the script returns `undefined`. It is `null` only in the oversized fallback, when the result cannot fit even after truncation. |
| `error` | string | Present on failure. |
| `steps` | array | One record per executed subtask call. |
| `stats` | object | Aggregate counters. |
| `logs` | array | Values passed to `log`, plus runtime warnings. |

Step record:

| Field | Type |
|---|---|
| `label` | string |
| `description` | string, truncated to 80 characters |
| `task_id` | string |
| `status` | subtask status |
| `durationMs` | number |
| `truncated` | boolean |
| `error` | string, optional |

Stats counters: `subtasks`, `ok`, `error`, `empty`, `timeout`, `aborted`, `totalMs`, `truncated`. `subtasks` counts every budgeted call and equals the number of `steps` records. `truncated` is true when any step output or the envelope was trimmed.

Example envelope:

```json
{
  "status": "error",
  "error": "child session failed",
  "steps": [
    { "label": "scan readme", "description": "scan readme", "task_id": "ses_a", "status": "ok", "durationMs": 2100, "truncated": false },
    { "label": "scan justfile", "description": "scan justfile", "task_id": "ses_b", "status": "error", "durationMs": 300, "truncated": false, "error": "model unavailable" }
  ],
  "stats": { "subtasks": 2, "ok": 1, "error": 1, "empty": 0, "timeout": 0, "aborted": 0, "totalMs": 2500, "truncated": false },
  "logs": []
}
```

## Live progress

While a workflow runs, its tool call shows the current step. The runtime emits a start event when each `subtask` begins and a finish event when it ends, each carrying the step as the title and the status, `task_id`, and `durationMs` on finish. A start event precedes execution of that subtask; when a subtask fails validation or the run is already aborted, the runtime emits only a finish event. To add phase-level status, call `progress({ title, metadata })`; for example `progress({ title: 'phase: reduce' })`. Progress affects only the live tool call, not the envelope. Child sessions stay visible in the session list and can be inspected as usual.

## Debugging

Workflow runs are normal sessions, so you can inspect them after the fact.

Run a goal and let the agent design the script:

```bash
opencode run --agent rug-workflow "Summarize the three riskiest modules and why"
```

Capture the session id. The run prints it, and you can also read the newest session:

```bash
opencode db "SELECT id, title FROM session ORDER BY time_created DESC LIMIT 5"
```

Export the session to JSON:

```bash
opencode export "$SESSION_ID" > session.json
```

Pull the workflow tool call and its result:

```bash
jq '.. | objects | select(.tool? == "workflow") | {status: .state.status, script: .state.input.script, output: .state.output}' session.json
```

Parse the envelope from the tool output:

```bash
jq -r '.. | objects | select(.tool? == "workflow") | .state.output | fromjson? | {status, error, stats}' session.json
```

If `jq` is unavailable or the export is missing, query the SQLite store directly. Tool calls live in `part.data` as JSON text:

```bash
opencode db "SELECT p.id, p.time_created, p.data FROM part p WHERE p.session_id = '$SESSION_ID' AND p.data LIKE '%\"tool\":\"workflow\"%'" --format json
```

Open the database interactively when you need to explore other tables:

```bash
opencode db
```

## Inspecting subsessions

Every `subtask` creates a real child session parented to the session that called `workflow`, with the `description` as its title. The string shorthand derives the description from the first 80 characters of the prompt. The envelope carries the handle you need: each `SubtaskResult` has `task_id`, and the envelope repeats it in the matching `steps[].task_id`.

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
| `invalid_script` | Syntax error in the script body. | Check unbalanced braces or backticks. Rerun with the syntax fixed. |
| `forbidden_script` | Banned token such as `import`, `require`, `process`, `globalThis`, `global`, or `fetch`. | Remove the token. Do all IO through `subtask`. |
| `budget_exceeded` | An uncaught budget overrun past `max_subtasks`. | Cut calls or raise `max_subtasks`; catch `BudgetExceededError` if a partial result is useful. |
| `timeout` | Script exceeded `timeout_seconds`. | Raise `timeout_seconds` or split the work. |
| `empty` steps | Child returned no text. | Make the prompt more specific or use a different agent. |
| Result is empty | Script did not `return` a value. | Add a `return` for a small reducer object. |
| Huge outputs | Child returned more than the per-step cap. | Ask children for short answers; check `truncated`. |

## Safety

The script guard is a deny-list scanner. It strips strings and comments, then rejects a bare `Function(` call and `new Function`, `import`/`require`, `eval(`, `constructor`, `process`, `globalThis`, `global`, `fetch(`, `child_process`, `node:`, `Bun`, `Deno`, `XMLHttpRequest`, `WebSocket`, and `import.meta`. A banned token returns `forbidden_script`; a syntax error returns `invalid_script`. The compiled function reads `subtask`, `log`, and `progress` from its closure. This is a guard, not a sandbox: scripts are trusted agent code that runs in the plugin's process, so treat a workflow script like any other code you would review.
