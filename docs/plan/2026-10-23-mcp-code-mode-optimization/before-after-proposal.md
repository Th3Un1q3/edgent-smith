# Gateway Tools Before and After the Permission Fix

Date: 2026-10-23

Summary: One permission line in `opencode.jsonc` made every gateway tool visible to the session, so agents can call them directly instead of nesting scripts through code-mode.

## What changed

A single line in `opencode.jsonc`. Before:

```jsonc
"gateway_*": "deny"
```

After:

```jsonc
"gateway_*": "allow"
```

Nothing else changed. No agent definitions, no scripts, no MCP catalog entries.

## Why

OpenCode builds the tool catalog by applying permission rules to each tool. It hides any tool whose last matching rule is a wildcard deny. That is what happened here: the `gateway_*` deny rule matched every gateway tool, so the session never saw them.

Agents still needed reach the gateway, so they nested scripts: they called code-mode with a script that itself called the gateway tool. Every real action cost two hops and a layer of string-wrapped JavaScript.

Now the guard is a wildcard allow. The catalog is not filtered, so all gateway tools appear in the session directly.

Naming matters here. The flat names stay flat: `tavily_search`, `fetch`, `get_gist`, `list_issues`, `write_file`, `list_allowed_directories`. They are addressed as `tools.gateway["..."]` in code-mode and by their flat name elsewhere. The count went from 3 visible tools to 226.

Allowing `execute` does not grant those tools. Each gateway call is still checked against its own `gateway_<tool>` permission. The allow line only stops the catalog from being emptied.

Verified by calling `list_allowed_directories` and reading the result.

## Before and after

| Aspect | Before | After |
| --- | --- | --- |
| Tools visible | 3 | 226 |
| How an agent reaches a tool | Nested script via code-mode | Direct call, `tools.gateway["..."]` |
| Recorded calls per action | 2 or more | 1 |

## Verify in three steps

1. Change the `gateway_*` line in `opencode.jsonc` to `allow`.
2. Restart the session so the catalog is rebuilt.
3. List the gateway tools and count them. Expect 226-ish, not 3.

If you still see 3, the session did not reload or a deny rule still matches.

## What not to do

- Do not add `gateway_*: deny` back without checking the catalog first. A wildcard deny silently hides tools and the loss looks like a bug in the gateway.
- Do not assume that allowing `execute` grants the inner tools. Each gateway tool has its own permission rule.
- Do not edit agent definitions to route around a permission problem. The fault was in one permission line, and the fix belongs there too.
