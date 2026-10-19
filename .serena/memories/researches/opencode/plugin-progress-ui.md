# Live workflow-subtask progress for an OpenCode plugin (V2 + Effect)

Full report: `.tmp/research/workflow-progress-options.md` (corrected v2; all four survey inputs r1-r4 were read).

Research question: how can an OpenCode plugin surface a live workflow-subtask tree and per-subtask progress in the terminal, and what do the V2 plugin API and the Effect interface offer? Baseline: OpenCode V2 beta, pinned by a community source-audit at v2.0.22 (2026-10-02); the V2 plugin API is beta and may change (official docs).

## TL;DR

Progress today rides the output/log plane (transient toasts, child-session titles, and a tool result that renders only at completion); there is no live, persistent, in-place subtask tree. Live terminal progress is a TUI ("CLI") plugin job — the Effect server plugin has no `ui`/`tui` context domain and cannot render. Recommendation: add a TUI plugin that renders from reactive host session state into three official slots (`prompt.footer.status` aggregate, `sidebar.content` compact tree, `session.panel` full tree), reusing the workflow plugin's existing child-session-title transport; keep the Effect server plugin as the execution source of truth and defer the Effect RPC bridge until its signatures are verified.

## Current limitation

The workflow plugin (`.opencode/plugins/workflow.ts`) is an OpenCode V2 Effect server plugin: it default-exports a `Plugin` whose `effect: context => Effect.gen(...)` registers a `workflow` tool via `context.tool.transform(editor => editor.add({ ... }))` and runs with `Effect.promise(() => runWorkflow(...))`.

Progress is surfaced through three output/log-plane channels:

1. Transient toasts — `client.tui.showToast(...)`: start, batched milestone (`<status> <ok>/<total> · wf#<id> · <desc>`, up to 5 then every 5th), and terminal.
2. Child-session titles — `client.session.update({ path: { id }, body: { title } })` writes `wf#<id> · [running] <desc>` before the prompt, then `wf#<id> · [ok]|[error]|[aborted] <desc>` after; the title is the lifecycle signal.
3. Tool result at completion only — serialized envelope `{ status, result, error?, steps, stats, logs }`; `metadata.title` is a one-line summary.

Limitation: append-only text read after the fact; no live persistent tree, no per-subtask rows, no aggregate counters, no running/failed breakdown. Toasts are transient and batched; child titles require drilling into each child session; the result appears only at completion; `context.metadata` is a proven dead end (`cases/opencode/tool_context_metadata_inert`). The Effect server plugin `Context` has no `ui`/`tui` domain, so it cannot render at all.

The runner already holds the data a renderer needs: `WorkflowContext.running` (in-flight subtask descriptions), `WorkflowContext.steps` (`StepRecord[]`), `runId`, `startedAt`, `budget`, and `WorkflowStats`.

## Two plugin planes

| Plane | Package | Runs in | UI surface? |
|---|---|---|---|
| Server plugin | `@opencode/plugin`, `@opencode/plugin/effect` | OpenCode server process | None — domains event, rpc, storage, session, tool; no ui/tui |
| TUI ("CLI") plugin | `@opencode/plugin/tui` | Terminal process (OpenTUI + SolidJS) | Toast, slots, panels, routes, dialogs, status bar, attention |

Consequence: live terminal progress is a TUI-plugin job; an Effect server plugin must bridge to the TUI or write state the TUI can read.

## Options comparison

| Option | Mechanism | Live updates? | Nested tree? | Effort | Risks |
|---|---|---|---|---|---|
| Toast | `context.ui.toast.show`; server `POST /tui/show-toast` → `client.tui.showToast` | Yes (re-call) | No | Low | Transient, noisy, not for high-frequency updates |
| Status bar / footer slot | `context.ui.slot({ append: "prompt.footer.status" })` | Yes (reactive Solid) | Partial (one line) | Low | Narrow; competes with built-ins |
| Sidebar content slot | `context.ui.slot({ append: "sidebar.content" })` | Yes (host store + events) | Yes (best always-on tree) | Medium | ~42 cols, auto-shows only >120 cols, never for child sessions |
| Session panel | `session.panel` + `context.ui.panel.open` | Yes | Yes (full scrollable tree) | Medium | User must open it |
| Custom route | `ui.router.register` + navigate | Yes | Yes | Medium | Requires navigation; not ambient |
| Custom JSX dialog | `ui.dialog.show` | Yes | Yes | Low-Med | Modal, blocks composer |
| Attention / notification | `context.attention.notify` | Event only | No | Low | OS-level, outside terminal |
| Logging | `POST /app/log` / `Effect.logInfo` | Append-only | Text via indentation | Low | Not a TUI surface |
| Tool-call progress | executor 2nd ctx arg `progress()` | Yes | No | Low | Generic one-line row; custom render closed (#33302, #21018) |
| Plugin RPC bridge | server `ctx.rpc.register` + `events.emit`; TUI `context.client.rpc` + `.events.on` | Yes (live-only) | Yes | High | Signatures unverified; lossy, must re-sync |
| Reactive host store reads | `context.data.on/listen`; `context.data.session.*` / `message.*` | Yes | Yes (walk child sessions) | Medium | Some events declared but not emitted on some builds |
| Markdown code-block renderer | `context.markdown.registerCodeBlockRenderer` | On message render | No | Low | Only fenced code blocks |
| V1 legacy TUI API | `api.slots.register`; `tui.json` | Yes | Yes | Medium | V1/V2 incompatible; V2 drops tui.json |
| Effect SDK embedded host streams | `opencode.events.subscribe()` → `Stream` | Yes | Build it yourself | High | Only for apps embedding OpenCode, not host plugins |

## Prior art

- `opencode-agents-monitor` renders a live sub-agent tree in the official `sidebar_content`/`sidebar.content` slot from `session.created/updated/deleted`, `session.status`, and the shared message store; "no host patching required".
- `opencode2-tps` drives a live one-line meter in `prompt.footer.status` from reactive host-store reads because the host event emitter does not reach plugins on all V2 betas.
- `@madsoftwaredev/opencode-subagent-sidebar` adds a live SUBAGENTS sidebar with status dots.
- Persistent UI from the server plane is impossible today (issue #28902: server/remote plugins reach only toasts, appendPrompt, openModels/openSessions/openThemes/openHelp, executeCommand).
- Custom tool-call rendering is closed as not planned (#33302, #21018), so a per-subtask tree must render from a slot/panel, not the tool row.

## Effect streaming primitives (server side)

| Primitive | Role for progress | Source |
|---|---|---|
| `Stream` | `ctx.event.subscribe()` returns `Stream<OpenCodeEvent, E>` (schema `V2EventEncoded`); RPC events are Streams; operators `Stream.tap`, `Stream.filter`, `Stream.runForEach`, `Stream.runDrain` | official |
| `Effect` | core type; `Effect.gen`, `logInfo/logDebug`, `promise`, `repeat`, `orDie`, `addFinalizer`, `runPromise` | official |
| `Effect.forkScoped` + `Scope` | fork the stream consumer into the plugin `Scope` for automatic interruption on unload | official |
| `Schedule` | recurring background work, e.g. `Effect.repeat(..., { schedule: Schedule.spaced("1 minute") })` | official |
| `Schema` | `Rpc.define` uses Effect Schema to type RPC input/output/error and event payloads | official |
| `Rpc` / `registration.events.emit` | publish typed progress via `Rpc.define({ events: { progress: { schema } } })`; subscribe via `acme.events.subscribe("progress")` (a Stream) | official |

Verified reactive pattern (verbatim shape from the official docs):

```ts
effect: (ctx) => Effect.gen(function* () {
  const event = ctx.event
  yield* event.subscribe().pipe(
    Stream.filter((item) => item.type.startsWith("session.next.")),
    Stream.runForEach((e) => Effect.logInfo("progress", { type: e.type })),
    Effect.forkScoped, // auto-interrupted when the plugin scope closes
  )
})
```

Two hard caveats:

1. The Effect plugin is server-plane only — it cannot render (no `ui`/`tui` domain). Effect's role is to produce progress, not display it.
2. The event stream is volatile by contract: a slow consumer overflows and fails the stream, and events during disconnection are missed. Design progress state to be reconstructible from session/message state, not from every event arriving.

Effect `Stream` is the reactive subscription primitive; terminal rendering is always the TUI plugin's job (SolidJS/OpenTUI reactive computations).

## Recommended approach

Add a TUI ("CLI") plugin that renders progress from reactive host session state, reusing the workflow plugin's existing child-session-title transport; keep the Effect server plugin as the execution source of truth. Use three official TUI slots for three zoom levels:

| Zoom level | Surface | Content |
|---|---|---|
| Aggregate | `prompt.footer.status` slot | `workflow wf#<id> · 2/5` |
| Compact tree | `sidebar.content` slot | per-subtask rows with status markers |
| Full tree | `session.panel` + slash command/keybind | scrollable nested tree, per-item status + durations |

Producer contract (already present): the workflow plugin writes child-session titles `wf#<id> · [running|ok|error|aborted] <desc>` and creates each child with `parentID = parent session`. A renderer enumerates the parent's child sessions, groups them by the `wf#<id>` run token, and maps the bracket marker to status — no new producer API required. A structured machine token (`wf#<id> · [status] · <desc>`) would harden the contract but is optional and backward-compatible.

Do not adopt the Effect RPC bridge as the primary path: its signatures are unverified and the stream is lossy. Prefer reactive `context.data.*` reads over the event emitter. The sidebar is ~42 columns, auto-shows only above 120 columns, and is never shown for child sessions, so the panel is the reliable full tree and the footer the reliable aggregate. Toasts remain useful for start/terminal pings only.

Optional future enhancement (not recommended now): publish typed progress from the Effect plugin via `Rpc.define({ events: { progress: { schema } } })` + `registration.events.emit`, consumed by the TUI plugin, after validating against the pinned release.

## Contract facts

- The event stream is volatile by contract: a slow consumer overflows and fails the stream, and events during disconnection are missed. Progress state must be rebuildable from session/message state.
- No progress-bar or subtask primitive exists; progress is composed from event Streams + session state + slots/toasts.

## Open questions

1. Effect→TUI RPC bridge signatures are unverified: `ctx.rpc` on the Effect `Context` is doc-verified, and the pattern is described by a v2.0.22 source audit, but exact signatures are not in the public docs.
2. Host-store signatures (`context.data.session.family/root/status`) are documented but version-dependent; the v2.0.22 audit warns some declared events are never emitted.
3. `session.status` availability conflicts: prior art relies on `session.status` (busy/retry/idle) while the v2.0.22 audit says `session.idle`/`session.status` are declared but not emitted and the loop signal is `session.execution.succeeded`.
4. Sidebar visibility constraints (~42 cols / >120 cols / hidden for child sessions) come from a v2.0.22 audit; verify on the target version.
5. No dedicated progress/subtask primitive exists; progress must be composed from event Streams + session state + slots/toasts.
6. V2 API is beta: entrypoints, hooks, draft shapes, and configuration may change before the stable release.
7. Toast TUI corruption bug (community report): `client.tui.showToast()` from a command hook corrupting the input box; reproduced only by the reporter.
8. Producer title-format contract is informal (`wf#<id> · [status] <desc>` is a repo convention, not a public API); a stable machine token would harden it.

## Sources

Official (opencode.ai / upstream repo):

- Effect plugin API — https://opencode.ai/v2/docs/build/plugins/effect/
- Effect plugin RPC — https://opencode.ai/v2/docs/build/plugins/effect/rpc/
- Plugins overview — https://opencode.ai/v2/docs/build/plugins/
- CLI / TUI plugin API — https://opencode.ai/v2/docs/build/plugins/cli/
- CLI plugin loading — https://opencode.ai/v2/docs/cli/plugins
- Effect client — https://opencode.ai/v2/docs/build/client/effect
- Effect embedded SDK — https://opencode.ai/v2/docs/build/sdk/effect/
- HTTP API (event contract volatility) — https://opencode.ai/v2/docs/api
- Server API — https://opencode.ai/docs/server/
- SDK — https://opencode.ai/docs/sdk/
- Upstream V2 Effect plugin README — https://github.com/sst/opencode/blob/dev/packages/plugin/src/v2/effect/README.md

Secondary / community:

- V2 source audit (v2.0.22) — https://github.com/kryptobaseddev/opencode-goal/blob/main/docs/research/opencode2-plugin-api.md
- opencode-agents-monitor — https://github.com/Dqz00116/opencode-agents-monitor
- opencode2-tps — https://github.com/BrikerMan/opencode2-tps
- pepper-dashboard — https://github.com/EvanDbg/opencode-sidebar-plugins/blob/main/pepper-dashboard.tsx
- @madsoftwaredev/opencode-subagent-sidebar — https://www.opendock.net/plugins/madsoftwaredev--opencode-subagent-sidebar/
- Opencode-Workflows — https://github.com/IgorWarzocha/Opencode-Workflows
- Issue #28902 / #33302 / #21018 — anomalyco/opencode
- V2 hooks/events audit — https://github.com/BearingMe/opencode-v2-antigravity-auth/blob/main/.opencode/skills/opencode-v2-plugins/references/hooks-and-events.md

## Related typed memories

- `claims/opencode/workflow_progress_transport` — the working v1 live-progress transport this research extends (toasts, child-session titles, completion result).
- `cases/opencode-plugin-v2-effect-migration` — v2/Effect import and packaging lessons.
- `cases/opencode-plugin-v2-tool-and-session-adaptation` — v2 tool transform and SessionDomain surface.
- `cases/opencode/tool_context_metadata_inert` — context.metadata() is inert; use outer-closure client.
- `claims/opencode/plugin_conventions` — plugin conventions.

## Provenance

Corrected v2 of the report; all four survey inputs were read (r1 plugin V2 mechanisms, r2 Effect interface, r3 TUI progress options, r4 prior art). Full report: `.tmp/research/workflow-progress-options.md`. Raw inputs (local ephemeral, not cached to Serena): `.tmp/research/r1-opencode-plugin-v2.md`, `r2-effect-interface.md`, `r3-tui-progress-options.md`, `r4-prior-art.md`.