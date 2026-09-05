---
name: serena-gateway
description: "Use when invoking Serena gateway chain (gateway_mcp-find, gateway_code-mode, gateway_mcp-exec), listing or reading memories via list_memories/read_memory, or falling back to filesystem .serena/memories."
applyTo: ".agents/skills/serena-memory/**/*.md,.agents/skills/context-gathering/**/*.md,.serena/memories/**/*.md"
---

# Serena Gateway Health-Check

Snapshot before every gateway call, detect empty returns, fall back to filesystem with zero retries.

## Guidelines

- Snapshot 2 KB before every `gateway_mcp-exec`: store `snapshot = raw.slice(0, 2048)` or `content.slice(0,2048)+"\n[...truncated]"` for reuse when gateway returns empty.
- Detect empty gateway return immediately: `if (!raw || raw.trim()==="" || /Access denied/.test(raw) || parsed.memories?.length===0 && raw.includes("content:[]"))` treat as infra flake.
- Fall back to `bash cat .serena/memories/<id>.md` with 0 gateway retries; do not re-invoke `gateway_code-mode` or `gateway_mcp-exec` for the same id.
- Enforce return ritual: every `list_memories` must be followed by `read_memory({memory_name: ids[0]})` before you answer; fail the step if you respond from `list_memories` names alone.
- Log the flake once: note `gateway empty → bash fallback for <id>` so the next probe reuses snapshot.

## Step-by-Step Workflow

1. Run `gateway_mcp-find query="serena"` → `gateway_code-mode {"name":"<unique>","servers":["serena"]}` → `gateway_mcp-exec`.
2. Before exec, cap expected output: `function snapshot(s){return s.length>2048?s.slice(0,2048)+"\n[...truncated]":s}` and `const snap = snapshot(await list_memories({topic:"about"}))`.
3. Execute `list_memories` or `read_memory` inside the sandbox.
4. On empty `content:[]` or empty string, stop gateway retries and run `bash cat .serena/memories/<id>.md` or `bash ls -R .serena/memories | wc -l` for inventory.
5. Complete recall only after `read_memory` returns the verified payload (e.g., 1765c for `cache/github/edgent-smith/actions/runs-failed`).

## Output Format

- Code fences use `javascript` for gateway JS and `bash` for fallback; never label a gateway JS snippet as `bash`.
- Include both `name` and `servers` in every `gateway_code-mode` call.
- Cite the `read_memory` payload size or excerpt to prove the return ritual ran.

## Verify

- Confirm `list_memories` → `read_memory` pair appears in the same tool chain before any synthesis.
- Confirm no loop retries gateway more than once for the same id.
