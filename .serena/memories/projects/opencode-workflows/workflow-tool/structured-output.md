---
id: projects/opencode-workflows/workflow-tool/structured-output
type: entities
L0: "Pass schema only to branch, loop, drive a fan-out, or hand off typed fields; the child replies with one <result_json> block and the runtime checks required keys, not the full schema"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section Structured output (### Structured output, lines 50-101)
---
# Structured output

Pass `schema` as a JSON Schema object to ask the child for machine-readable output alongside its normal answer. It is not the default: ask for plain prose unless the caller mechanically consumes a value.

## The three cases

- Branch or loop condition: the next step reads a named field to choose a path or end a loop. A lone completion verdict is not this case; match a first-line `PASS`/`FAIL` with a regex.
- Fan-out or loop driver: an array the caller iterates or fans out over.
- Typed hand-off or merge: a later step consumes named fields, or a map-reduce merges by field.

Decision test: does the next step branch, loop, merge, or template on this value? Yes: use `schema`. No: use prose.

## Shapes that pay for nothing

- A reducer that echoes child `data` fields or reshapes prose into nested fielded objects nothing consumes, such as `code: { verdict: v.data.verdict, findings: v.data.findings.slice(0, 3) }`. Returning one child's `outputText` under a single result key, such as `{ summary: merged.outputText }`, is ordinary delivery and stays legal; several child-derived strings collapse into one prose line, not a multi-key object.
- `*Status:` mirror keys and producer bookkeeping such as `produced: { source: p1.data.filesChanged }`.
- A report schema wrapping prose the child already returned.
- A single verdict that a first-line `PASS`/`FAIL` check covers.

Return only outcomes the child produced, never a value the orchestrator itself defined; echoing a hardcoded path, id, label, or config constant adds nothing. Return a short outcome line, decisions reached, artifact paths a child produced, and decision-bearing counts.

## Reply contract

Without `schema` the child returns plain text and the result carries no `data`. With `schema` the child returns its complete answer, optionally with free-form prose or code, plus exactly one JSON block between `<result_json>` and `</result_json>`; only JSON goes inside the tags and it is not wrapped in a markdown fence. The injected contract asks for that shape and appends the schema.

## Parser order

1. Scans tagged blocks in reverse order, from the last opening tag to the first, and parses the first block that yields valid JSON.
2. Strips an inner markdown fence if the child added one.
3. Falls back to the path for models that return pure JSON: strip a wrapping code fence from the whole reply, then `JSON.parse`.

A reply is usable when it parses as JSON and, if `schema.required` is a non-empty array of strings, every name in it is a key of the parsed object. When the reply is unusable the runtime sends at most one corrective follow-up on the same session with a tag-specific instruction and parses again. If the retry is still unusable, the subtask returns `status: 'error'` with `error: 'subtask did not return valid JSON matching the schema'`; a reply with no text yields `status: 'empty'` instead.

`outputText` stays the full raw reply for debugging; `data` holds the parsed JSON and is never truncated or stringified. The timeout and abort cover both the first call and the follow-up.

## Limits

- This is a prompt contract plus `JSON.parse` plus a required-keys check, not a full JSON-Schema validator: nested constraints, types, enums, and formats go unchecked. Validate `data` before trusting it.
- The SDK supports native structured output through `body.format`, but the runtime does not use it (ADR-003). The available model rejects formatted requests in thinking mode, and formatted sessions break `session.messages`.