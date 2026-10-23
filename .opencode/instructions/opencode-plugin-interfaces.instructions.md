---
name: opencode-plugin-interfaces
description: OpenCode v2 plugin interfaces for the Effect and promise APIs, where the type definitions live, how to validate a plugin, and what to avoid. Required when designing or editing an OpenCode plugin.
applyTo: ".opencode/plugins/*.ts"
excludeAgents: "rug"
---

# OpenCode v2 plugin interfaces

OpenCode v2 removed the v1 hook-object plugin API. A v2 plugin is a default-exported object with a stable `id` and one entry point, `effect(context)` or `setup(context)`, and it registers behavior by calling scoped methods on `context`. This file is a map of that API: where the interfaces live, the smallest working shape, how to prove a plugin works, and which v1 habits now fail. It is not an API reference. The installed `.d.ts` files are normative, and this file only points at them.

## Sources of truth

Use these in order. When a lower source disagrees with a higher one, the higher source wins.

1. Installed types, authoritative. `@opencode/plugin@2.0.24` and `effect@4.0.0-rc.112` under `/workspace/.opencode/node_modules/`.
   - `/workspace/.opencode/node_modules/@opencode/plugin/dist/effect/plugin.d.ts`: `Plugin`, `Context`, `define`.
   - `/workspace/.opencode/node_modules/@opencode/plugin/dist/effect/index.d.ts`: namespace exports (`export * as Plugin`).
   - `/workspace/.opencode/node_modules/@opencode/plugin/dist/effect/{tool,registration,event,session,permission}.d.ts`: domain signatures and hook payloads.
   - `/workspace/.opencode/node_modules/@opencode/schema/dist/tool.d.ts`: `Tool.Info`, `Tool.Result`, `ValueSchema`.
   - `/workspace/.opencode/node_modules/@opencode/plugin/dist/promise/plugin.d.ts`: the `setup` variant.
2. Installed package metadata. `/workspace/.opencode/node_modules/@opencode/plugin/package.json` lists the export subpaths: `.` (promise), `./effect`, `./host`, `./tui`, plus a `./*` wildcard that reaches `dist/*.d.ts`.
3. Official v2 docs.
   - <https://opencode.ai/v2/docs/build/plugins>
   - <https://opencode.ai/v2/docs/build/plugins/effect>
   - <https://opencode.ai/v2/docs/build/plugins/migrate-v1/>

   The unversioned <https://opencode.ai/docs/plugins/> documents v1. Do not cite it for v2.
4. Repo examples that compile and pass tests.
   - `.opencode/plugins/workflow.ts`: `id` 199, `effect` 200, `session.hook('context')` 215, `tool.transform` 248, `export default` 271. Smallest complete example.
   - `.opencode/plugins/goal-continuation.ts`: `tool.transform` 273, `session.hook('prompt')` 303, `tool.hook('execute.before')` 320, `event.subscribe()` 395.
   - `.opencode/plugins/quality-gate-enforcer.ts`: hook-only plugin, `effect` 43, hooks at 83 and 90.
   - `.opencode/plugins/tests/workflow.test.ts:90-92`: how a test drives `plugin.effect` with `Effect.runPromise(Effect.scoped(...))`.

All five root plugins import `Plugin` from `@opencode/plugin/effect/plugin`; three of them also import `Context` there. None imports from the documented `@opencode/plugin/effect` subpath, which exposes `Plugin` only as a namespace (`export * as Plugin`).

```ts
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
```

`@opencode/plugin/effect` is the documented subpath; `/effect/plugin` resolves through the `./*` wildcard. Prefer the documented subpath for values, and use the deep path when you need `Context`.

## Module shape

Effect API (`dist/effect/plugin.d.ts`):

```ts
export interface Plugin<R = Scope.Scope> {
  readonly id: string
  readonly effect: (context: Context) => Effect.Effect<void, never, R>
}
```

Promise API (root import `@opencode/plugin`, `dist/promise/plugin.d.ts`):

```ts
export interface Plugin {
  readonly id: string
  readonly setup: (context: Context) => Promise<Cleanup | void> | Cleanup | void
}
```

`define(plugin)` returns its argument unchanged (`dist/effect/plugin.js`). The repo skips it and default-exports an object literal (`instructions-loader.ts:58-60`). `Plugin.define` needs the namespace value import `import { Plugin } from '@opencode/plugin/effect'`; a type-only import gives the interface, which has no `.define`.

Every registration is scoped. Register inside `Effect.gen` and the runtime releases it when the plugin unloads; the promise variant returns a cleanup function instead. There is no `dispose` key.

## Minimal anatomy

```ts
import { Effect, Schema } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'

const plugin: Plugin = {
  id: 'opencode.example',
  effect: (context: Context) =>
    Effect.gen(function* () {
      yield* context.tool.transform((editor) => {
        editor.add({
          name: 'example',
          description: 'Echo the query',
          input: Schema.Struct({ query: Schema.String }),
          execute: (input) => Effect.succeed({ content: input.query }),
        })
      })

      yield* context.session.hook('context', (event) => {
        event.tools.example = { description: 'Echo the query', input: {} }
        return Effect.void
      })
    }),
}

export default plugin
```

`tool.transform` receives an editor with `list`, `get`, `add`, `update`, `remove`, and `namespace`. Tool `input` accepts Effect Schema, Standard Schema, or JSON Schema. `execute` returns `Effect<{ output?, content?, metadata? }, Tool.Error>`, never a string. Hook names are the keys of the domain's hook interface: `tool.hook` accepts `execute.before` and `execute.after`; `session.hook` accepts `prompt`, `context`, `compaction`, `generate`, `title`, `model.request`, `http.request`, `http.response`, `retry`, and three `experimental.ws.*` names; `permission.hook` accepts `evaluate`. Read `dist/effect/<domain>.d.ts` for payloads instead of trusting a list in prose.

Events are a scoped stream, not a plugin key: `yield* context.event.subscribe().pipe(Stream.filter(...), Stream.runForEach(...), Effect.forkScoped)`.

## Loading and imports

The loader scans root `.opencode/plugins/*.ts` only. `helpers/`, `types/`, and `tests/` are not plugin entry points. Each entry point default-exports one plugin object and may import helpers with relative paths.

- Source files use relative imports (`./helpers/logger`). The runtime loads `.ts` directly and does not resolve TypeScript `paths`, so `@plugins/*` fails at load time.
- Tests use the aliases `@plugins/*` and `@tests/*` from `.opencode/tsconfig.json`; `.opencode/vitest.config.ts` also maps `bun` to a mock.
- Import types with `import type` so the compiler erases the import and no runtime package copy is pulled in.
- Import `Effect`, `Stream`, and `Schema` from the single installed `effect` copy. A second copy under `@opencode/plugin/node_modules/effect` breaks `Effect.isEffect` and schema identity checks.
- Keep the default export reachable. The package declares no `sideEffects`, so a bundler can drop an unused plugin object.

`applyTo` matches only direct children of `.opencode/plugins/`. `helpers/*.ts` and `tests/*.ts` do not load this file (`instruction-indexer.ts:112-135`, `glob-match.ts:16`).

## Validate

Run `just` targets only. They pass the Bun and istanbul flags this runtime needs. Never call `bun`, `tsc`, `vitest`, or `eslint` directly.

| Gate | Command | Wiring |
|---|---|---|
| Typecheck | `just .opencode/typecheck` | CI (`scripts/ci.sh:76`) |
| One test file | `just .opencode/test -- plugins/tests/<name>.test.ts` | CI |
| Coverage | `just .opencode/test --coverage` | CI, 90% branch/function/line/statement |
| Lint | `just .opencode/lint` | CI (`scripts/ci.sh:75`) |

A unit test builds a fake `Context`, calls `Effect.runPromise(Effect.scoped(plugin.effect(context)))`, then asserts the registrations. `.opencode/plugins/tests/workflow.test.ts` is the model.

Green unit tests do not prove the plugin works in a live session. A Serena memory, `mem:cases/opencode/sdk_detached_method_this`, records the failure: a detached client method loses `this` and throws, so call it as a member instead of storing the function. Unit fakes exercise neither the real client nor the real event stream nor load order.

This file covers unit-level proof only; the delegated run in the section below is where a live check belongs (`.opencode/instructions/live-verification.instructions.md`).

### Prove an injected context block

- Run under an agent that exposes the tool, confirmed with `opencode debug agents`; the default agent may deny it.
- `event.tools` is the model-visible map, and plugin tools can collapse into the Code Mode `execute` entry. Gate on the exposure tool the harness actually uses, not only the registered name; a `workflow`-only check never fires.
- Proof is a completed run plus the branch log. An aborted run proves nothing.
- `opencode session export` omits system messages and the system prompt, so read `workflow.instructions.*` from stderr or the log file.
- `workflow.instructions.injected` is info and carries `blockBytes`, `tools`, `exposure`, and `stripped`, e.g. `blockBytes=9560 exposure=execute`. `workflow.instructions.context` and `workflow.instructions.skipped` are debug, and skipped carries only `tools`, so proving the hook did not fire requires debug logging. Correlate lines by log sink timestamp and agent. The payload carries no run id.
- Auto-discovered plugins receive empty `options`, so repo config belongs in `harness.config.ts` under `plugins[id]`.

Hot reload is active: `dist/source.node.js` appends `__opencode_reload=<generation>` to every local module it resolves, so a running server picks up a saved plugin. Assume hot reload for instruction files too: saving either kind of file can change live behavior immediately, and a broken save can break the agent loop before you run anything (`mem:cases/opencode/plugin_hot_reload_safe_development`, confidence 0.9). Develop in a staging directory outside loader roots, such as `/workspace/.tmp/` or a plugin subdirectory that is not a loader entry point; typecheck before saving; keep the plugin out of the loaded set until a live check passes.

Logs: `~/.local/share/opencode/log/opencode.log`. `--print-logs` writes to stderr and needs `--standalone`.

## Avoid

| Don't | Symptom |
|---|---|
| Import `@opencode-ai/plugin` | The package is not installed under `.opencode/node_modules`; the import fails before the plugin loads. |
| Export only named functions | The loader reads the default export, so the module registers nothing. |
| Return a string from tool `execute` | Type error: `execute` must return `Effect<Result, Tool.Error>`. |
| Use `chat.message`, `permission.ask`, `config`, `auth`, `dispose`, or `event` as plugin keys | Absent from every installed `.d.ts`; excess-property typecheck fails and the runtime ignores them. Use `session.hook('prompt')`, `permission.hook('evaluate')`, `context.event.subscribe()`, and scoped release. |
| Register `tool.execute.before` as a plugin key | Gone. Register `context.tool.hook('execute.before', ...)`. |
| Install a second `effect` copy | `Effect.isEffect` and schema brand checks fail across instances. |
| Mix `@opencode-ai/sdk@1.18.34` types with `@opencode/*@2.0.24` | The generations are not interchangeable; type errors appear at the helper boundary. |
| Treat a deep import as a stable path | Only the `./*` wildcard reaches it; prefer `@opencode/plugin/effect`. |
| Use `@plugins/*` in plugin source | No alias resolution at runtime; the plugin fails to load. |
| Assume cwd or absolute paths | The server cwd is `context.location.directory`; imports resolve relative to the source file. |
| Reproduce the event union from memory | The union is large and not exhaustively verified here; read `dist/effect/event.d.ts`. |
| Edit a live plugin before typechecking | Hot reload applies the broken module to the running session. |

## Naming and lint rules

- A lint rule that rejects a name is a report about the design, not about the spelling: change the design or the rule configuration, and never distort a name to satisfy the rule.
- A helper that both decides and acts must be split: a decision returns a boolean or a status, an action returns what it did.
- `refactoring-patterns` names the second rule as the Decide-and-Act smell and carries the split fix.

## New plugin checklist

1. Pick a stable, namespaced `id` (`opencode.<name>`).
2. Sweep the finished file for v1 survivors: `@opencode-ai/plugin`, `chat.message`, `permission.ask`, `dispose`, and `event` as a plugin key.

Steering messages and their attributes: `.opencode/instructions/steering-message.md`.
