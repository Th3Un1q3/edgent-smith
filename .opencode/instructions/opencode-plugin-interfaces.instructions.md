---
description: Explains how to structure opencode plugins. Required when designing an opencode plugin.
applyTo: ".opencode/plugins/*.ts"
---

## Plugin Conventions

### Architecture Overview

OpenCode plugins use a **functional, hook-based architecture**. Each plugin is a single async function typed as `Plugin` from `@opencode-ai/plugin` that returns a registration object mapping string-literal hook keys to handler functions. Zero decorators, zero classes — purely functional with named exports only (no default exports).

### Export Conventions

- **No default exports** — every module uses only named exports.
- **Plugin entry points** (all `.ts` files in `.opencode/plugins/`) export an async function that receives the OpenCode plugin context `{ client, directory? }` and returns a `PluginOutput` object with hooks (`tool.execute.before`, `tool.execute.after`, etc.), optional extension points (`event`, `dispose`, `tool`, `config`, `auth`, `provider`).
- **Naming convention** — export names follow `{description}Tracker`, `{description}Enforcer`, or `{description}Loader` patterns (e.g., `sessionTracker`, `todoEnforcer`, `instructionsContextLoader`).
- **Helper modules** (`helpers/`) export domain-specific utilities for cross-plugin reuse.
- **Type definitions** (`types/`) are interfaces/types only — no runtime logic beyond what the type system requires.

### Module Format

All files use **pure ESM** with named exports only. No classes are used anywhere in the plugins directory. Runtime behavior is entirely function-based.

## Development Workflow

### Install dependencies

Plugin dependencies are tracked in `/workspace/.opencode/package.json` and installed with npm:

```bash
cd .opencode && npm install
```

## Plugin Architecture

### Plugin Registration & Loading

Plugins are loaded by **directory scanning** — every `.ts` file at the root of `.opencode/plugins/` is an independent plugin. No entry-point file or registry is needed. The runtime:
1. Scans `plugins/*.ts` for top-level named exports matching the `Plugin` interface shape.
2. Imports each module, invokes its exported async function with `{ client, directory? }`.
3. Collects all returned hook registrations into per-key arrays.
4. Dispatches events by iterating those arrays in insertion (load) order when the corresponding runtime event fires.

### Hooks & Extension Points — Core Concepts

Plugins intercept behavior through **event hooks** and **extension points**:

- **Event hooks** are keyed strings in the returned object that fire at specific lifecycle points. All hook handlers follow an `(input, output) => void | Promise<void>` pattern where `output` is mutable — handlers mutate it directly rather than returning values.
- **Extension points** (`tool`, `event`, `dispose`, `config`, `auth`, `provider`) have different shapes and do not follow the mutation pattern.

### Hook Compositability & Mutation Model

Multiple plugins can register the same hook key. All handlers fire **sequentially in load order**, each seeing mutations from prior hooks. This means plugins communicate through a shared mutable state store (`SessionStorage` / `kv-store`) rather than direct imports — both a strength (loose coupling) and a consideration for reasoning about cross-plugin interactions.

### Extension Points Reference

#### `tool` — Custom Tool Registration

Register new AI-callable tools that appear alongside built-in tools. Custom tools take precedence over built-in tools if naming conflicts occur. Built via the `tool()` helper from `@opencode-ai/plugin`.

```ts
import { tool } from "@opencode-ai/plugin"

export const MyPlugin = async (ctx) => ({
  tool: {
    myCustomTool: tool({
      description: "Does something custom",
      args: {
        name: tool.schema.string().describe("The name parameter"),
        count: tool.schema.number().optional().describe("Optional count"),
      },
      execute: async (args, context) => {
        // context has { agent, sessionID, messageID, directory, worktree }
        return `Result for ${args.name}`;
      },
    }),
  },
})
```

#### `event` — System Event Subscription

Registers a handler that subscribes to all internal system events. The callback receives every emitted event object. Used for side effects (logging, analytics, notifications). **Event data shapes are not part of the stable public API** — they vary by event type and may change between versions. Use with caution in production plugins.

```ts
export const MyPlugin = async (ctx) => ({
  event: async (input) => {
    if (input.event.type === "session.idle") {
      sendNotification("Session is idle");
    }
  },
})
```

#### `dispose` — Plugin Teardown Handler

Fires when the plugin is being unloaded/terminated. Essential for preventing resource leaks. No input or output parameters. Must be async (`Promise<void>`).

```ts
export const MyPlugin = async (ctx) => ({
  dispose: async () => {
    await connection.close();
    clearInterval(timer);
  },
})
```

#### `config` — Configuration Observer

Read-only hook for observing OpenCode's configuration at startup. Does not accept or return mutable data. Receives the full `Config` object.

#### `auth` & `provider` — Authentication & Provider Customization

Custom authentication provider and LLM provider customization hooks. Interact with internal account/provider systems. Signatures are implementation-specific.

### Hook Documentation Strategy

Specific hook names, field types, and event type lists are **version-dependent** and drift across OpenCode releases. For the current stable hook reference:
1. Check the `@opencode-ai/plugin` package's type definitions (`.d.ts` files) for the most accurate interface shapes.
2. Consult the plugin registry or documentation bundled with your installed OpenCode version.
3. Treat any undocumented event types as experimental — they may change without notice.

## Directory Structure & Infrastructure

### Layout Rationale

```
plugins/
├── *.ts                  # Each file = one independent plugin (loaded by directory scan)
├── helpers/              # Shared helper modules (logger, kv-store, session-helpers)
│   ├── kv-store.ts       # Per-session state persistence (SessionStorage)
│   ├── logger.ts         # Singleton logging utility (shared across all plugins)
│   └── session-helpers.ts  # Session communication utilities
├── types/                # Shared type definitions (interfaces/types only)
├── sessions/             # Runtime ephemeral state (disk-backed per-session KV store instances)
```

| Design Choice | Rationale |
|---------------|-----------|
| Plugins at root level | Maximum discoverability; no nesting to traverse for new plugin creation |
| No entry-point file | Eliminates registration overhead — any `.ts` is a valid plugin by convention |
| Helpers subdirectory | Groups shared utilities separately from plugin logic, reducing cognitive load |
| Types subdirectory | Centralizes shared type definitions to avoid duplication across plugins and helpers |
| Sessions directory | Separates ephemeral runtime state from source code; disk-backed per-session isolation enables persistence across process restarts and direct inspection for debugging |

### Helper Module Roles

| Module | Exports / Purpose | Consumed By | Dependency Type |
|--------|-------------------|-------------|-----------------|
| `kv-store.ts` | `SessionStorage`, `State`, `SESSION_FIELDS` — per-session KV store abstraction | Multiple plugins | Core state layer; all consumers read/write the same storage instance |
| `logger.ts` | Singleton logging utility | All plugins and helpers | Logging — single shared logger instance ensures consistent output |
| `session-helpers.ts` | `sendMessage` utility for session communication | Session-dependent consumers | Action utility — no persistent state, pure function |

## Design Patterns & Best Practices

### 1. Functional-Only Architecture
Every plugin is a single named `const` that is an async function typed as `Plugin`. No class definitions, no decorators, no inheritance anywhere in the codebase.

**Implications:** Low ceremony for adding plugins; implicit contracts enforced by TypeScript typing; trivially testable pure functions.

### 2. Mutation-Based Inter-Plugin Communication
Plugins coordinate through shared session state via `SessionStorage` (disk-backed KV store in `sessions/*.json`) rather than direct imports or return-value chaining. This is equivalent to an **implicit context object** pattern where the KV store acts as per-session thread-local storage.

**Trade-off:** Loose coupling (plugins don't import each other) at the cost of explicitness — cross-plugin interactions are invisible without tracing all mutations in `SessionStorage`.

### 3. Singleton Logger
`logger.ts` provides a singleton logging utility shared across all helpers and plugins. No dependency injection for logging — every module imports the same instance directly. Simple but creates a tight coupling point; swapping or mocking requires changing every import site. Adequate at this scale (5+ plugins).

### 4. Ephemeral Session State Isolation
`sessions/` contains per-session KV store instances persisted to disk by `kv-store.ts`. Disk-backed isolation enables session persistence across process restarts and debugging via direct file inspection, with potential scalability considerations at high concurrency if file I/O becomes a bottleneck.

## New Plugin Onboarding Checklist

1. Create `<plugin-name>.ts` at plugin root level (no directory nesting).
2. Import `{ Plugin }` from `@opencode-ai/plugin`.
3. Export an async function typed as `Plugin` that receives `{ client, directory? }`.
4. Register hook keys via returned handler functions — use the mutation pattern `(input, output) => void | Promise<void>`.
5. Use helpers from `helpers/` (`SessionStorage`, `logger`) for shared state and logging if needed.
6. Add corresponding tests to `tests/` if the plugin modifies behavior or state.

## Hook Ordering & Conflict Resolution Summary

| Concern | Rule |
|---------|------|
| **Multiple plugins registering the same hook** | All handlers fire sequentially in plugin load order. Each sees the mutations of prior hooks. |
| **`permission.ask` — multiple handlers** | Last loaded plugin's return value takes precedence for `output.status`. |
| **Custom tool naming conflicts** | Plugin-registered tools take precedence over built-in tools with the same name. |
| **Experimental hook stability** | Experimental hooks may change or be removed between OpenCode versions. Do not rely on them in production plugins without version guards. |
