# Reference: Gateway Protocol — Snapshot, Empty Return, Return Ritual

Single source for the gateway guard: apply it before every `list_memories`/`read_memory` call and before using the result.

When to load: whenever you call the Serena gateway — recall, store, update, or consolidate.

Vocabulary: snapshot — 2 KB cap on every gateway return; empty return — blank, stderr, `Access denied`, or `content:[]` payload; return ritual — a `list_memories` call must be followed by `read_memory` before you answer.

## Pre-flight

1. `gateway_mcp-find query="serena"`.
2. `gateway_code-mode {"name":"<unique>","servers":["serena"]}` — include both fields; a missing `name` fails silently.
3. Chain every step inside one synchronous `gateway_mcp-exec`.

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

On `gatewayEmpty(raw)`, stop gateway retries and fall back once to the filesystem:

```bash
bash cat .serena/memories/<id>.md
```

Never re-invoke `gateway_code-mode` or `gateway_mcp-exec` for the same id. When the environment cannot reach the gateway at all, a human performs the store or recall and records the memory id. This fallback covers infrastructure flakiness only; permission rules are separate.

## Return Ritual

Every `list_memories` must be followed by `read_memory({memory_name: ids[0]})` before you answer; never answer from names alone.

```javascript
var listRaw = list_memories({topic:"entities"});
if (gatewayEmpty(listRaw)) throw new Error("gateway empty - bash cat .serena/memories/<id>.md (0 retries)");
var ids = JSON.parse(listRaw).memories || [];
var bodyRaw = read_memory({memory_name: ids[0]}); // return ritual: read_memory before any answer
snapshot(bodyRaw);
// Implements: 2 KB cap + empty-return fallback + list_memories -> read_memory return ritual
```

## Acceptance Criteria

- Done when: every gateway return is snapshotted, an empty return triggers the one-shot `bash cat` fallback, and a `read_memory` payload is cited before any answer.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when a gateway result must be cached or researched.
