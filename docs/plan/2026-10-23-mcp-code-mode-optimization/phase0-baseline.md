> **Correction (2026-10-23):** The V5 and namespace findings below are an artefact of the
> `gateway_*` deny rule hiding the catalog. See [before-after-proposal.md](before-after-proposal.md).

# Phase 0 baseline: native Code Mode MCP access

Status: evidence record
Date: 2026-10-23
Scope: probes V1–V11 for ADR-013, captured before any migration config edit. No config, catalog, plugin, or agent
definition was changed. Probes that did not run are marked BLOCKED, not inferred.

## 1. Environment and snapshot

| Item | Value |
|---|---|
| Harness | OpenCode v2.1.1, from `opencode --version` |
| Captured (UTC) | 2026-10-23T09:12:19Z |
| Git HEAD | `94d8555079ec6edee2367c69bf5244beb42a1d4f` |
| Working tree | `git status --porcelain -uall` → 17 entries (documentation, skill, and memory changes already applied) |
| Effective-config dump | `opencode debug config` — this build lists configuration sources and the resolved values; run it before and after a change so both dumps compare like with like |

Rollback comparison uses this snapshot: the 17-entry tree, the HEAD above, and a saved copy of the
`opencode debug config` output.

## 2. Probe table

| ID | Question | Method | Observed output | Verdict |
|---|---|---|---|---|
| V1 | Does `search` exist inside `execute`? | Inspect sandbox globals in a scratch script | `search` is present and callable | PASS |
| V2 | Exact normalized key for the gateway entry | Dump effective config with the legacy flat `mcp.gateway` shape | Legacy flat `mcp.gateway` normalizes to `mcp.servers.gateway` | PASS |
| V3 | Does `codemode: false` produce an opt-out? | Set `codemode: false` in the flat shape and in `mcp.servers.gateway`, then dump each | The key is stripped in both shapes; no opt-out survives normalization | FAIL |
| V4 | Per-tool permission action shape | Deny one `gateway_<tool>` action on a scratch config and call it, plus an allowed tool, inside one script | Unexecuted — the namespace exposes no upstream tool names, so no `gateway_<tool>` action exists to deny | BLOCKED |
| V5 | Do gateway tool names carry the upstream server prefix? | Enumerate the gateway namespace from `execute` | Namespace lists only `["code-mode", "mcp-exec", "mcp-find"]`; no upstream server tool appears | FAIL |
| V6 | `execute` permission semantics: entry name, `ask` inside an `allow` session, deny with `*` | Scratch session permutations | Unexecuted — requires a separate scratch session and policy matrix | BLOCKED |
| V7 | Do independent calls in one script run in parallel? | Time two independent calls against their sum and max | Elapsed tracks the slower call, not the sum | PASS |
| V8 | Does a throwing call yield a usable `part` row? | Throw inside one call of a multi-call script | The row carries the thrown message and a non-success status | PASS |
| V9 | Subagent behaviour for `*: deny` plus `execute: allow`, and per-agent permission blocks | Scratch subagent run | Unexecuted — no subagent probe was launched | BLOCKED |
| V10 | Can `execute.before`/`execute.after` see per-call detail? | Scratch plugin hook logging the payload | Unexecuted — no hook probe was installed | BLOCKED |
| V11 | Exact build and its release-note statement on the Code Mode default | Version command plus release notes | Build recorded as v2.1.1; release-note statement not read | BLOCKED |

Counts: 4 PASS (V1, V2, V7, V8), 2 FAIL (V3, V5), 5 BLOCKED (V4, V6, V9, V10, V11).

## 3. Falsified premise

ADR-013 assumes that addressing a gateway server tool reaches the upstream tools. The probe shows the gateway
namespace contains only its three wrapper methods, so that addressing never reaches the nine servers directly.

Recorded namespace listing:

```text
["code-mode", "mcp-exec", "mcp-find"]
```

Second failure: the documented per-server opt-out has no effect in this build. `codemode: false` is stripped in both
the legacy flat shape and the `mcp.servers` shape, leaving no supported way to opt a server out of Code Mode.

## 4. Go/no-go

| Phase | Verdict | Authorising evidence |
|---|---|---|
| P2 — reshape the gateway entry to `mcp.servers.gateway` | GO | V2 proves the legacy shape already normalizes to that key; the edit is cosmetic and reversible in one hunk. |
| P3 — add an explicit `execute` permission entry | NO-GO | V6 is BLOCKED; the entry name and `ask`/`deny` semantics are unproven. |
| P4 — rewrite prose to direct endpoint calls | NO-GO | V5 FAIL; prose would teach `tools.gateway["<upstream_tool>"]`, which the namespace does not expose. |
| P5 — tool-shaped permission narrowing | NO-GO | V5 FAIL; there are no per-upstream tool names to gate, and V4 is BLOCKED as a consequence. |
| P6 — remove the wrapper allow rules | NO-GO | V5 FAIL and V4 BLOCKED; the wrappers are the only path that reaches the nine servers, so removal breaks invariant 1. |

## 5. Viable reduced migration (option, not a decision)

The evidence supports one smaller change: native `execute` calling the gateway's wrapper methods directly — the
`mcp-find` and `mcp-exec` tools of the `gateway` namespace. That removes the gateway-hosted `code-mode` JS layer,
because that tool is what nests a script inside a script today, while all nine servers stay reachable through
`mcp-exec`.

What it does not buy:

- No per-upstream-tool permissions; the only gated actions remain the wrapper methods.
- No structural per-server attribution; a row still records one `mcp-exec` invocation, not the inner call.
- No reduction in recorded calls: one `mcp-exec` per upstream call remains.

This is an option for the ADR owner to accept or reject. It is not approved by this record.

## 6. What the plan assumed that the evidence contradicts

- That `tools.gateway["<tool>"]` exposes upstream server tools. It exposes three wrapper methods only.
- That `gateway_<tool>` permission actions can name upstream tools. No such action exists in the namespace.
- That per-server attribution arrives with the native path. Inner calls stay inside `mcp-exec`.
- That `codemode: false` can opt a server out. The key is stripped in both config shapes.
- That P5 and P6 can be sequenced behind a canary. Neither has a gateable tool surface to canary.
