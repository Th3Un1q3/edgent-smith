---
id: ADR-014
title: MCP access uses the gateway wrapper methods through native execute
status: superseded
date: 2026-10-23
scope: MCP access path across the opencode harness
superseded-by: ADR-013
---

# ADR-014: MCP access uses the gateway wrapper methods through native execute

Status: Rejected
Date: 2026-10-23
Supersedes: ADR-013, addressing decision only

## Decision

Retain the Docker MCP gateway and its nine catalogued servers, and retain all three wrapper permissions. Agents call
`execute` and invoke the gateway wrapper methods directly: `mcp-find` to discover, `mcp-exec` to run a named
upstream tool. The gateway-hosted `code-mode` tool stops being the recommended path while remaining available.

## Considerations

### Context

Phase 0 on OpenCode v2.1.1 showed the gateway namespace exposes only `code-mode`, `mcp-exec` and `mcp-find`
(V5 FAIL), so addressing upstream tools directly cannot work. The `codemode` opt-out key is stripped during config
normalization in both supported shapes (V3 FAIL), so no per-server opt-out exists. ADR-013 assumed direct addressing
and a working opt-out; that decision is therefore superseded for the access path.

### Options considered

**A. Reduced path: native execute calls the gateway wrapper methods.** Pros: removes the gateway-hosted code-mode
JS layer, so one script layer remains; all nine servers stay reachable through `mcp-exec`; guidance matches what
agents can actually do. Cons: wrapper schemas and prose remain; no per-upstream-tool permissions; inner calls stay
opaque inside one `mcp-exec` row.

**B. Hold ADR-013 until a harness or gateway upgrade exposes upstream tools.** Pros: no churn now; preserves the
original intent. Cons: guidance teaches a call shape this build cannot satisfy; blocked work waits on an unscheduled
upgrade; no measurable benefit in the current version.

**C. Remove the gateway and register the nine servers directly in the client.** Pros: true per-server namespaces and
per-server permission actions. Cons: nine entries per harness; upstream credentials move into client config; the
filesystem server loses the gateway's `disableNetwork` enforcement; four harness configs must be maintained.

### Scoring

Criteria scored -2 to +2, higher is better.

| Criterion | A reduced path | B hold | C nine flat |
|---|---|---|---|
| Feasibility on this build | +2 | -2 | +1 |
| Context cost | +2 | 0 | -1 |
| Latency | +1 | 0 | 0 |
| Permission granularity | -1 | 0 | +2 |
| Error surface | 0 | 0 | +1 |
| Sandbox and secret boundary | 0 | 0 | -2 |
| Observability | -1 | 0 | +2 |
| Portability | +1 | 0 | -2 |
| Maintenance | +1 | -1 | -2 |
| Blast radius | 0 | 0 | +1 |
| **Total** | **+5** | **-3** | **0** |

B scores zero on benefits it cannot deliver in this build, and negative on feasibility and maintenance because the
guidance would keep teaching an unreachable path.

### Consequences

Positive: one script layer instead of two; one recorded call per invocation; guidance matches the reachable surface;
no configuration change is required.

Negative: no per-upstream-tool permissions, so any allowed `mcp-exec` can reach every server the gateway exposes; no
structural per-server attribution, because the inner server and tool never enter the `part` row; the gateway remains
a single point of failure; the `codemode` opt-out remains unavailable.

## Phases

- **R1 — Guidance demotion.** Rewrite agent-facing prose to teach `mcp-find` then `mcp-exec`; stop recommending
  the gateway-hosted `code-mode` tool. No permission or config change.
- **R2 — Wrapper permissions unchanged.** Keep the deny on `gateway_*` and the three explicit allows. Record that
  this is deliberate, not an oversight.
- **R3 — Deferred items.** (a) Client config reshape to `mcp.servers.gateway`: deferred because it is cosmetic
  while the opt-out is stripped; reopen when a build honours `codemode: false`. (b) Per-tool permission narrowing:
  deferred because the namespace exposes no upstream actions; reopen when it does. (c) Wrapper removal: deferred
  because the wrappers are the only reachable path; reopen when direct addressing works.

## Rollback

Revert the R1 prose edits. No configuration changed, so rollback needs no config step.

## Version scoping

This finding holds for OpenCode v2.1.1 with this gateway as configured on 2026-10-23. Re-probe V3 and V5 after any
harness or gateway upgrade before relying on this decision beyond that version.

## References

- ADR-013: mem:architecture/adr/ADR-013-native-code-mode-mcp-access
- Phase 0 baseline: docs/plan/2026-10-23-mcp-code-mode-optimization/phase0-baseline.md
- Falsification memory: mem:researches/opencode/code-mode-gateway-addressing-falsified
- Proposal: docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md

## Rejection

Rejected on 2026-10-23: the central premise failed on opencode v2.1.1. `mcp-exec` cannot run a named upstream tool
directly; `gateway["mcp-exec"]({name:"list_memories", arguments:{}})` returned exactly
`Error: Tool 'list_memories' not found in current session. Make sure the server providing this tool is added to the session.`
and `serena_list_memories` returned the same error. The gateway namespace exposes only its three wrapper methods
(`code-mode`, `mcp-exec`, `mcp-find`), and `mcp-find` returns server names rather than tool names, so discovery
cannot supply a callable name either. The only working form is a per-server code-mode variant reached through
`mcp-exec`: create it with `code-mode({name, servers})`, then run
`mcp-exec({name:"code-mode-<name>", arguments:{script}})` with the upstream calls inside the script. The current
setup — gateway-hosted code-mode retained — is therefore already the only viable arrangement in this build, and no
guidance demotion can be justified. Reopen when a harness or gateway upgrade changes what the session exposes, and
re-run the probe recorded in `docs/plan/2026-10-23-mcp-code-mode-optimization/r1-contract-probe.md`.

The conclusion that the current setup was the only viable arrangement was wrong for the same reason, because the catalogue was filtered by a deny rule.
