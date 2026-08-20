# Best Answer: Interactive Session/Trace Explorer

The “interactive session/trace explorer for opencode” need is best answered by:

- Jaeger (already wired in this repo) — process-level traces.
- cc-sessions-viewer (host-side, reads opencode.db) — full session detail with good UI.

Provider payloads are not available via ANY ready-made tool on opencode ≤1.18.18 (not persisted).

Related: `mem:researches/opencode/observability/jaeger-wired-in-devcontainer`, `mem:researches/opencode/observability/ready-made-viewers`, `mem:researches/opencode/observability/provider-payloads-not-persisted`.