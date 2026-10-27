# Reference: Gateway Protocol — Snapshot, Empty Return, Return Ritual

Single source for the gateway guard: apply it before every `list_memories`/`read_memory` call and before using the result.

When to load: whenever you call the Serena gateway — recall, store, update, or consolidate.

Vocabulary: snapshot — 2 KB cap on every gateway return; empty return — blank, stderr, or `content:[]` payload (a permission denial is not an empty return); return ritual — a `list_memories` call must be followed by `read_memory` before you answer.

## Pre-flight

1. `tools.gateway["list_memories"]({})` — no discovery or sandbox setup.
2. `tools.gateway["read_memory"]({memory_name: "<id>"})` for the body.
3. Every step is one ordinary tool call with a plain argument object.

## Snapshot — 2 KB Cap (MANDATORY)

Cap every return before it reaches the model; reuse the snapshot when the gateway flakes.

```javascript
function snapshot(s){ return s.length>2048? s.slice(0,2048)+"\n[...truncated]": s }
```

## Empty-Return Predicate

```javascript
function gatewayEmpty(raw){ return !raw || raw.trim() == "" || /Access denied|No such file/.test(raw) || raw.indexOf("content:[]")>=0; }
```

An empty or stderr return is an infrastructure flake, not a retry signal.

## Zero-Retry Fallback

On `gatewayEmpty(raw)`, stop gateway retries and fall back once to the filesystem where the harness permits direct reads (a harness that denies `.serena/memories` reads is not an infra flake — report the denial and stop):

```bash
bash cat .serena/memories/<id>.md
```

Never re-invoke the failed call for the same id. When the environment cannot reach the gateway at all, stop and ask the operator to perform the store or recall and record the memory id. This fallback covers infrastructure flakiness only; permission rules are separate.

## Return Ritual

A `list_memories` call must be followed by `read_memory` before you answer with content; existence, count, and name-scan queries may answer from names alone. Keep the ritual for any content answer.

```javascript
var listRes = tools.gateway["list_memories"]({topic:"entities"});
var listJson = typeof listRes === "string" ? listRes : listRes.result; // live shape: {result: "<json string>"}
if (gatewayEmpty(listJson)) throw new Error("gateway empty - bash cat .serena/memories/<id>.md (0 retries)");
var ids = JSON.parse(listJson).memories || [];
// content answer: read_memory before answering
var body = tools.gateway["read_memory"]({memory_name: ids[0]});
snapshot(typeof body === "string" ? body : JSON.stringify(body));
// Implements: 2 KB cap + empty-return fallback + conditional list_memories -> read_memory return ritual
```

## Call Shape

Call the flat gateway tools directly for a single read or write — one tool per call, with a plain argument object. A multi-memory inventory batches up to 8 reads in one `execute` call.

- List: `tools.gateway["list_memories"]({})`. Read: `tools.gateway["read_memory"]({memory_name: "<id>"})`. Write: `tools.gateway["write_memory"]({memory_name: "<id>", content: "<body>"})`. Edit: `tools.gateway["edit_memory"]({memory_name: "<id>", needle: "<find>", repl: "<replace>", mode: "literal"})`. `mode` is required; `"literal"` is the safe default.
- A return may be an object or a JSON string: inspect it before indexing, and `JSON.parse` only when it is a string. `list_memories` returns an object whose `result` field holds a JSON string; parse `result`, then read its `memories`.
- The `gateway_code-mode` and `gateway_mcp-exec` wrappers are denied where the harness denies them; a single call uses the flat tool and a multi-read inventory uses `execute`, so neither wrapper is needed.
- Each tool is gated by its own `gateway_<tool>` permission, so allowing the code-mode `execute` tool does not grant these tools. An absent tool is not proof of a permission rule — check the configured permissions before concluding one exists.

## Acceptance Criteria

- Done when: every gateway return is snapshotted, an empty return triggers the one-shot `bash cat` fallback, and a `read_memory` payload is cited before any answer.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when a gateway result must be cached or researched.
