# Non-Breaking Rollout and Rollback

Date: 2026-10-23

Summary: This migration is one line, so rollback is one line.

## The change

In `opencode.jsonc`, set the gateway permission entry from deny to allow:

```jsonc
"gateway_*": "allow"
```

Restart the session. The catalog is rebuilt on start.

## The rollback

Set the same line back to deny and restart:

```jsonc
"gateway_*": "deny"
```

Nothing else was touched, so nothing else needs reverting.

## What a regression looks like

Either of these means the tool catalog is being filtered again:

- Gateway tools are missing from a session that should have them.
- The visible gateway tool count is near three instead of near two hundred.

Both point at a permission rule, not at the gateway servers.

## The one caveat worth keeping

A wildcard deny silently hides tools. There is no error and no warning, only a short catalog. Any future deny rule must be checked against the visible catalog before it ships, or the same confusion returns.

## Reviewer checklist

1. Confirm `opencode.jsonc` has `"gateway_*": "allow"` and no other gateway rule after it.
2. Restart the session.
3. Count the visible gateway tools. Expect about 226.
4. Call one tool, for example `list_allowed_directories`, and confirm it returns data.
5. Confirm no agent definition or skill file was edited.
