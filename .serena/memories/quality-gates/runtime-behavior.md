# Quality Gate Runtime Behavior

How gates fire and how their results reach the agent. Gates run from the `tool.execute.after` hook of the quality-gate enforcer plugin: once a tool has written files, the plugin matches the changed paths against each gate pattern using Bun `Glob`, then runs the matching gates in order. Gate definitions come from the schema in `mem:quality-gates/configuration`.

Results are tracked per session in a KV store keyed by session id, so the plugin knows each gate previous status. This matters because a stale pass must not mask a new failure — the recorded status is what the next run compares against, rather than judging the current run in isolation.

Reporting is transition-driven, not run-driven: a `<steering priority="warning">` message is emitted only when a gate status changes (pass to fail, or unknown to fail), so an already-failing gate does not re-notify on every save. Failures inside subagent sessions do not block the subagent; the gate-reporter plugin surfaces them to the parent instead.
