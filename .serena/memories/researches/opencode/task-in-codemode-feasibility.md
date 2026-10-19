# Native task/subagent tool inside Code Mode vs the workflow tool (OpenCode v2)

Full report: `.tmp/research/task-in-codemode-feasibility.md`.

Research question: can the native `task`/`subagent` tool (or another native subagent tool) be called from inside an OpenCode v2 Code Mode (`execute`) script to create subtasks instead of the repo workflow plugin tool, and what would it take to reach parity with the workflow subtask + fork?

Baseline: local opencode v2.0.23 and upstream `anomalyco/opencode` `dev` (2026-10). Evidence tags: [LOCAL] this repo/installed binary; [UPSTREAM] opencode.ai/v2 docs and dev source.

## Verdict

**Partial.** Not possible today as asked. The native `task`/`subagent` tool cannot be called from Code Mode, locally or on upstream `dev`. It is feasible only with an upstream change; achievable today only through the `workflow` plugin tool (or a new wrapper tool).

Confidence: high that native `task`/`subagent` is unreachable from Code Mode; high that the workflow tool is the sanctioned bridge; medium that a small upstream change plus permission wiring exposes the native tool (local binary and upstream source describe catalog assembly differently).

## Why

- [LOCAL] The installed binary registers the subagent tool with `options: { codemode: false }`, so it is excluded from the Code Mode catalog and unbound in the sandbox. `task` is a deprecated config alias, not a registered tool.
- [UPSTREAM] On `dev`, the `execute` catalog is built exclusively from connected MCP tools (`mcp.tools()` filtered by `Permission.visibleTools`); built-in tools including `task`/`subagent` never enter the sandbox tree.
- [LOCAL] The `workflow` plugin tool passes no `codemode` option, so by the default-on rule it is Code-Mode-eligible and is the existing path to spawn children from a script via `ctx.session`.
- Fork is not a tool: it is an HTTP endpoint (`POST /api/session/{sessionID}/fork`) [UPSTREAM]; the v2 plugin session domain omits it [LOCAL]; the sandbox has no HTTP.

## What the native task/subagent tool exposes today

| Aspect | Evidence |
|---|---|
| Tool name | [LOCAL] registered as `subagent`; `task` is a deprecated config alias; internal source id is still `task`. |
| Subtask spawn | [UPSTREAM] starts a child session with a configured subagent; foreground waits, `background: true` returns immediately. |
| Resume | [UPSTREAM] pass the returned `sessionID` to continue the same child conversation. |
| Constraints | [UPSTREAM] subagent-mode agents only; default nesting depth one; `background` hidden unless enabled. |
| Fork | Not exposed by the tool; fork is a session operation. |
| Code Mode exposure | Absent: [LOCAL] `codemode: false`; [UPSTREAM] `code-mode.ts` adds only MCP tools. |

## The workflow subtask bridge (current)

The workflow tool script helper `subtask(input)` already implements subtask + fork [LOCAL] (`.opencode/plugins/helpers/workflow-subtask.ts`, `workflow-types.ts`):

- Parameters: `prompt`, `description`, `agent` (default `rug-swe`), `skills`, `task_id`, `fork_from`, `timeout_minutes`, `schema`.
- Resume precedence: `task_id` (resume) then `fork_from` (fork) then `session.create` with `parentID`; `task_id` and `fork_from` are mutually exclusive.
- Result envelope: `{outputText, task_id, forked_from?, status, error?, durationMs, truncated, data?}` with `status` in `ok/error/empty/timeout/aborted`; failed children never throw.
- Fork in v2: `callFork` throws `session.fork is unsupported` because the adapter omits `session.fork`, so `fork_from` always returns an error result.
- Budget/concurrency/timeout: `DEFAULT_MAX_SUBTASKS=32` (cap 64), `DEFAULT_MAX_CONCURRENT=4` (cap 8), per-subtask timeout 15 min, overall 90 min.
- Structured output: `parseStructured` parses a `<result_json>` block against `schema`, one retry. Skills: `injectSkills` reads `.agents/skills/<name>/SKILL.md`.

Key finding: calling native `subagent` from Code Mode would deliver a strictly weaker primitive than the workflow tool already provides.

## Requirements checklist (11 capabilities)

| # | Capability | Native subagent today | Workflow subtask today | Change needed for Code Mode |
|---|---|---|---|---|
| 1 | Session parenting (`parentID`) | Supported | Supported | Expose a spawn entry in the catalog passing the calling session as parent. |
| 2 | `fork_from` | Missing | Partial (v2 throws unsupported) | Add a `fork` catalog entry; emulate via create + history copy; or add `session.fork` to the v2 session domain. |
| 3 | `task_id` resume | Supported via `sessionID` | Supported | Return child `sessionID` into the script and accept it next call. |
| 4 | Budget / `max_subtasks` | Missing | Supported (32, cap 64) | Wrapper budget counter or accept no budget. |
| 5 | Concurrency limit | Missing | Supported (4, cap 8) | Wrapper must bound concurrency. |
| 6 | Per-child timeout | Missing | Supported (15 min) | Wrapper timers + abort. |
| 7 | Result envelope + progress | Partial | Supported | Define result schema; add a progress channel (Code Mode has no rendering surface). |
| 8 | Error/retry semantics | Missing | Supported | Wrapper classifies errors into the envelope. |
| 9 | Permission gating | `subagent:<agentID>`; `execute:*` umbrella | Script guard + Effect ask | New entries call `ctx.ask`; keep `execute:*` umbrella and nested enforcement. |
| 10 | Skill injection | Missing | Supported | Wrapper reads skill files and injects (raw sandbox cannot read filesystem). |
| 11 | Structured output | Missing | Supported | Wrapper adds schema/parse/retry. |

Summary: native `subagent` satisfies only #1, #3, and part of #7 today; #2, #4, #5, #6, #8, #10, #11 must be rebuilt around it.

## Blockers and unknowns

Hard blockers:

1. Catalog scope: `subagent`/`task` is not in the Code Mode catalog (per-tool `codemode: false` locally; MCP-only assembly upstream), so a script cannot reach it.
2. Fork is not a tool and the sandbox has no HTTP; fork must become a catalog entry or be emulated.
3. The v2 plugin session domain has no `fork`; even the workflow fork path is dead in v2.

Parity blockers (wrapper work, not upstream): budget, concurrency, timeout, retry, skills, and schema have no native equivalent; progress from a sandbox has no rendering surface and the event stream is volatile.

Unknowns to verify: docs vs `dev` source discrepancy on Code Mode namespaces; whether the repo `workflow` tool actually enters the sandbox catalog (this session observed only `gateway` and `opencode`); experimental gating (`OPENCODE_EXPERIMENTAL_CODE_MODE`); nesting depth; no documented permission action for fork.

## Recommendation

- Near term (no upstream change): keep `workflow` as the Code Mode entry and use its `subtask` helper for spawn, resume, budget, concurrency, timeout, skills, and structured output. Repair fork by emulation (`session.create` + copy projected history before a message) instead of the dead `session.fork` path. Do not build on the unverified Effect RPC progress bridge yet.
- Medium term: add a small wrapper plugin tool (for example `spawn`) around `ctx.session.create`/`prompt` that returns a structured envelope, isolating parity logic and keeping native `subagent` untouched.
- Long term (upstream): extend the `execute` catalog beyond MCP tools with a built-in namespace including `subagent` (spawn) and `fork`; wire per-entry permissions (`subagent:<agentID>`, a new fork action); respect agent-mode and depth constraints; return the child `sessionID`.

PoCs: A) spawn via the workflow tool from Code Mode; B) a `spawn` wrapper tool called from Code Mode; C) fork emulation test (create + copy projected history, assert history matches up to the fork point).

## Cached sources

`mem:claims/opencode/sdk_subagent_spawn`, `mem:claims/opencode/sdk_child_model_inheritance`, `mem:claims/opencode/workflow_reliability_primitive`, `mem:claims/opencode/workflow_progress_transport`, `mem:cases/opencode/workflow_fork_from_envelope_truncation`, `mem:cases/opencode/tool_context_metadata_inert`, `mem:researches/opencode/plugin-progress-ui`, `mem:architecture/adr/ADR-005-multi-agent-orchestration-strategy`.

Source: local files `.tmp/research/cm-local-codemode-runtime.md`, `.tmp/research/r1-opencode-plugin-v2.md`, `.opencode/plugins/workflow.ts`, `.opencode/plugins/helpers/workflow-{types,subtask,client-adapter,script,runner}.ts`; upstream opencode.ai/v2 docs (tools, permissions, agents, plugins, sdk, openapi.json) and `anomalyco/opencode` `dev` (`tool/code-mode.ts`, `tool/task.ts`, `session/tools.ts`, `effect/runtime-flags.ts`).