## Plugin Directory & Export Requirements

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.ts` (root) | Plugin entry points only | PascalCase or kebab-case plugins (`harness-plugin.ts`, `session-tracker.ts`) |
| `helpers/*.ts` | Shared utility modules, helpers, and discovery logic | camelCase filenames representing their domain (`kv-store.ts`, `logger.ts`, `file-discovery.ts`) |
| `AGENTS.md` | Discoverable instruction file matched by the `**/AGENTS.md` glob | Must be capitalized — lowercase `agents.md` is not discovered |
| `helpers/` | Shared plugin utilities (logging, KV store, session helpers) | camelCase filenames representing their domain |
| `types/` | TypeScript type definitions shared across modules | Descriptive singular or plural names (`instructions.ts`) |
| `sessions/` | Runtime JSON state files (auto-generated) | Pattern: `ses_<timestamp>_<random>.json` — do not create manually |

### Export Conventions

- **No default exports** — every module uses only named exports.
- **Plugin entry points(all .ts files in .opencode/plugins directory)** export a single async function that receives the OpenCode plugin context and returns a `PluginOutput` object with hooks (`tool.execute.before`, `tool.execute.after`, etc.), optional `event` subscriptions, and a `dispose` handler. Naming follows `{description}Tracker` or `{description}Loader` patterns (e.g., `sessionTracker`, `todoEnforcer`, `instructionsContextLoader`).
- Helper modules (`.opencode/plugins/helpers/`) export their domain-specific utilities (logger singleton, KV store state manager, session helper functions) for cross-plugin reuse.
- Type definitions in `.opencode/plugins/types/` are exported as interfaces and types only — no runtime logic lives there beyond what's needed for the type system.

### Module Format

All files use **pure ESM** with named exports only. No classes are used anywhere in the plugins directory. Runtime behavior is entirely function-based.

## Development Workflow

### Install dependencies

Plugin dependencies are tracked in `/workspace/.opencode/package.json` and installed with npm:

```bash
cd .opencode && npm install
```

### Run tests

Tests are configured and run under Node with Vitest. `npm test` from inside `.opencode/` executes the suite once and exits with the test results.

Test configuration files:

- `vitest.config.ts` — `.opencode/vitest.config.ts`
- `tsconfig.json` — `.opencode/tsconfig.json`

### Test layout

Tests live in `.opencode/plugins/tests/` and mirror the layout of `.opencode/plugins/`. For example, `plugins/helpers/kv-store.ts` is tested by `plugins/tests/helpers/kv-store.test.ts`.

Example current layout:

```
.opencode/
├── plugins/helpers/kv-store.ts
└── plugins/tests/helpers/kv-store.test.ts
```

### Available commands

| Command | Purpose |
|---------|---------|
| `cd .opencode && npm install` | Install dependencies |
| `cd .opencode && npm test` | Run tests once |
| `cd .opencode && npm run test:watch` | Run tests in watch mode |
| `cd .opencode && npm run typecheck` | Type-check without emitting files |

### Bun-only APIs

Some plugin files import `bun` or `bun:fs`. Tests run under Node/Vitest, so those Bun-only modules are aliased and mocked via `plugins/tests/__mocks__/`. Add new mocks there when testing files that import `bun:fs` or other Bun-only APIs.

### Example `package.json` scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsup"
  }
}
```

### Example `vitest.config.ts`

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      'bun:fs': path.resolve(__dirname, './plugins/tests/__mocks__/bun-fs.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
```

When testing code that imports `@opencode-ai/plugin`, alias the dependency to a local mock in `vitest.config.ts` or use `vi.mock` so tests stay isolated from the live plugin context.

## Plugin Architecture

### Hooks & Extension Points

Plugins intercept behavior through two mechanisms: **event hooks** (keyed strings in the returned hooks object that fire at specific lifecycle points) and **extension points** (special keys like `tool`, `event`, `dispose` with different shapes). All event hook handlers follow an `(input, output) => void | Promise<void>` pattern where `output` is mutable.

#### Quick-Reference Table

| # | Hook Key | Category | Stability |
|---|----------|----------|-----------|
| 1 | `tool.execute.before` | Tool — pre-execution | Stable |
| 2 | `tool.execute.after` | Tool — post-execution | Stable |
| 3 | `shell.env` | Shell / Environment | Stable |
| 4 | `command.execute.before` | Command / CLI | Stable |
| 5 | `chat.message` | Chat — incoming message | Stable |
| 6 | `chat.params` | Chat — model parameters | Stable |
| 7 | `chat.headers` | Chat — HTTP headers | Stable |
| 8 | `permission.ask` | Permission / Security | Stable |
| 9 | `experimental.session.compacting` | Session — compaction context | Experimental |
| 10 | `experimental.chat.messages.transform` | Chat — message transform | Experimental |
| 11 | `experimental.chat.system.transform` | Chat — system prompt | Experimental |
| 12 | `experimental.provider.small_model` | Provider — model selection | Experimental |
| 13 | `experimental.compaction.autocontinue` | Session — compaction flow control | Experimental |
| 14 | `experimental.text.complete` | Text — inline completion | Experimental |

---

#### Stable Event Hooks (Detailed Interfaces)

##### `tool.execute.before` — Intercept tool calls before execution

Fires **before** any tool runs, after permission is granted but before the tool executes. Most commonly used hook for escaping commands, injecting environment variables, or blocking dangerous operations.

| Field | Type | Description |
|-------|------|-------------|
| `input.tool` | `string` | Tool name being invoked (e.g., `"bash"`, `"read"`) |
| `input.sessionID` | `string` | Current session identifier |
| `input.callID` | `string` | Unique ID for this specific invocation |
| `output.args` | `any` | Mutable — the arguments passed to the tool. Mutate directly; applied before execution. |

**Usage:**
```ts
"tool.execute.before": async (input, output) => {
  if (input.tool === "bash") {
    // Escape or modify command args before they execute
    output.args.command += " && echo done";
  }
}
```

| Nuance | Detail |
|--------|--------|
| **Multiple plugins** | All handlers fire sequentially in plugin load order. Each sees the mutations of prior hooks. |
| **Not fired for denied tools** | If `permission.ask` returns `"deny"`, this hook never fires. |
| **Args passed by reference** | Mutations apply directly; no serialization overhead. |

---

##### `tool.execute.after` — Modify tool output before model sees it

Fires after a tool completes, with its result available but before the output is displayed to the model or user. Use cases: redacting sensitive info from output, attaching analytics metadata, truncating large results.

| Field | Type | Description |
|-------|------|-------------|
| `input.tool` | `string` | Tool name that was executed |
| `input.sessionID` | `string` | Current session identifier |
| `input.callID` | `string` | Invocation ID for this execution |
| `input.args` | `any` | The arguments that were passed to the tool |
| `output.title` | `string` | Mutable — displayed title for the result |
| `output.output` | `string` | Mutable — the actual content shown. Can truncate or replace entirely. |
| `output.metadata` | `any` | Mutable — arbitrary key-value data attached to the result |

**Usage:**
```ts
"tool.execute.after": async (input, output) => {
  if (input.tool === "bash") {
    // Redact secrets from shell output
    output.output = output.output.replace(/api[_-]?key\s*=\s*\S+/gi, "api_key=***REDACTED***");
  }
}
```

| Nuance | Detail |
|--------|--------|
| **Multiple plugins** | All handlers fire sequentially in load order. Each sees prior mutations. |
| **Full output replacement** | `output.output` can be set to any string — use with caution for debugging/monitoring hooks. |

---

##### `shell.env` — Inject environment variables for shell processes

Fires before each shell command execution (both AI-initiated tools and user terminal commands). Variables are merged into the spawned process's environment — add new keys or override existing ones.

| Field | Type | Description |
|-------|------|-------------|
| `input.cwd` | `string` | Current working directory of the invocation (always present) |
| `input.sessionID?` | `string \| undefined` | Optional session identifier |
| `input.callID?` | `string \| undefined` | Optional invocation ID |
| `output.env` | `Record<string, string>` | Mutable — environment key-value pairs to merge. All values must be strings (POSIX semantics). |

**Usage:**
```ts
"shell.env": async (input, output) => {
  output.env.MY_API_KEY = process.env.MY_API_KEY;
  output.env.PROJECT_ROOT = input.cwd;
}
```

| Nuance | Detail |
|--------|--------|
| **Broad scope** | Fires for ALL shell executions — AI tools AND user terminal commands. |
| **Merge semantics** | Variables are merged with existing env; you add or override keys. |
| **String values only** | All environment values must be strings (standard POSIX). |

---

##### `command.execute.before` — Intercept CLI command output

Fires before an OpenCode internal CLI command executes, allowing interception or modification of its result.

| Field | Type | Description |
|-------|------|-------------|
| `input.command` | `string` | Name/identifier of the command being executed |
| `input.sessionID` | `string` | Current session identifier |
| `input.arguments` | `string` | Raw argument string passed to the command |
| `output.parts` | `Part[]` | Mutable — array of content parts for the output. Can replace or augment entirely. |

**Usage:**
```ts
"command.execute.before": async (input, output) => {
  if (input.command === "help") {
    output.parts = [{ type: "text", text: "Custom help message" }];
  }
}
```

| Nuance | Detail |
|--------|--------|
| **Part types** | `Part` includes `{ type: "text" \| "image", text?, imageUrl? }`. Check your OpenCode version for exact schema. |

---

##### `chat.message` — Transform incoming user messages

Fires when a new message is received by the agent (incoming user-to-agent direction). Use cases: filtering, sanitization, enrichment, or rewriting of incoming messages before they reach the model.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier |
| `input.agent?` | `string \| undefined` | Optional agent name |
| `input.model?` | `{ providerID: string; modelID: string }` or `undefined` | Provider and model info for the active connection |
| `input.messageID?` | `string \| undefined` | Unique message identifier |
| `input.variant?` | `string \| undefined` | Message variant/type |
| `output.message` | `UserMessage` | Mutable — the parsed message object. Rewrite the text or replace entirely. |
| `output.parts` | `Part[]` | Mutable — content parts of the message. Add/remove/rewrite parts. |

**Usage:**
```ts
"chat.message": async (input, output) => {
  // Strip markdown formatting from user input before model sees it
  output.message.text = output.message.text.replace(/```[\s\S]*?```/g, "[code block]");
}
```

| Nuance | Detail |
|--------|--------|
| **Incoming only** | Fires on user-to-agent direction. Model-to-user messages use different hooks (e.g., `tool.execute.after`). |

---

##### `chat.params` — Modify model inference parameters

Fires before each LLM API call is made, to inspect/modify the model parameters that will be sent. Use cases: dynamic temperature adjustment per-session, token limit control, provider-specific option injection.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier |
| `input.agent` | `string` | Active agent name |
| `input.model` | `Model` | The Model object with current settings and provider info |
| `input.provider` | `ProviderContext` | Connection/auth info for the active LLM provider |
| `input.message` | `UserMessage` | The user message being sent to the model |
| `output.temperature` | `number` | Mutable — inference temperature. Mutate to adjust per-call. |
| `output.topP` | `number` | Mutable — top-p sampling parameter |
| `output.topK` | `number` | Mutable — top-k sampling parameter |
| `output.maxOutputTokens?` | `number \| undefined` | Mutable — max output tokens. `undefined` means use provider default. |
| `output.options?` | `Record<string, any>` | Mutable — catch-all for provider-specific parameters (e.g., OpenRouter routing hints) |

**Usage:**
```ts
"chat.params": async (input, output) => {
  // Reduce context window per-session by limiting max tokens when deep in conversation
  if (input.sessionID.length > 50) {
    output.maxOutputTokens = 2048;
  }
}
```

| Nuance | Detail |
|--------|--------|
| **Fires very frequently** | Once per LLM API call — potentially dozens of times per session. Keep handlers lightweight. |
| **Provider compatibility** | `output.options` should only contain fields your active provider supports. Invalid fields may be silently dropped or cause errors. |

---

##### `chat.headers` — Modify HTTP headers for LLM API calls

Fires before each LLM API call, to inspect/modify the HTTP headers sent to the provider. Use cases: injecting custom auth tokens, observability/tracing IDs, A/B testing parameters.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier (same as `chat.params`) |
| `input.agent` | `string` | Active agent name |
| `input.model` | `Model` | Model configuration object |
| `input.provider` | `ProviderContext` | Provider connection/auth info |
| `input.message` | `UserMessage` | User message being sent |
| `output.headers` | `Record<string, string>` | Mutable — HTTP headers for the API call. All values must be strings. |

**Usage:**
```ts
"chat.headers": async (input, output) => {
  // Inject tracing header for observability
  output.headers["X-Session-ID"] = input.sessionID;
}
```

| Nuance | Detail |
|--------|--------|
| **String values only** | All header values must be strings. Use `JSON.stringify()` or `toString()` for non-string data. |

---

##### `permission.ask` — Control permission decisions for dangerous actions

Fires when the agent needs to request permission for a potentially dangerous action (tool execution, command run, etc.). **Critical security hook**: returning `"deny"` prevents operations entirely; returning `"allow"` bypasses the UI prompt. Only one plugin effectively controls the final decision — last loaded plugin's return wins if multiple handlers fire.

| Field | Type | Description |
|-------|------|-------------|
| `input` | `Permission` | Structured object with `{ type, action, details }` describing what is being requested (exact shape varies by OpenCode version) |
| `output.status` | `"ask" \| "deny" \| "allow"` | Mutable — return `"allow"` to grant without prompting the user, `"deny"` to block entirely, or `"ask"` (default) to show the permission request UI. |

**Usage:**
```ts
"permission.ask": async (input, output) => {
  // Always allow read-only tools; prompt for destructive writes
  if (input.action === "read") {
    output.status = "allow";
  } else if (input.action === "write" && input.details.endsWith("rm -rf")) {
    output.status = "deny";
  }
}
```

| Nuance | Detail |
|--------|--------|
| **Last plugin wins** | If multiple plugins set `output.status`, the last loaded handler's value takes precedence. |
| **Security-critical** | Use for automated permission policies (e.g., always allow read-only tools, always deny destructive writes). |

---

#### Experimental Event Hooks (Detailed Interfaces)

##### `experimental.session.compacting` — Inject context during session compaction

Fires during session compaction (context window management), **before** the LLM generates a continuation summary. Use cases: preserving domain-specific state that the default summary would miss (task status, decision log, file context). You can EITHER push to `output.context` (add supplemental info) OR replace `output.prompt` entirely — not both simultaneously for meaningful results.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier |
| `output.context` | `string[]` | Mutable — array of strings to inject as additional context into the compaction prompt. Use `.push()` to add. Strings are concatenated into the final prompt. |
| `output.prompt?` | `string \| undefined` | Optional — complete replacement of the default compaction prompt text. |

**Usage:**
```ts
"experimental.session.compacting": async (input, output) => {
  // Preserve task context across compaction cycles
  output.context.push(`Current task: ${taskStatus}`);
}
```

| Nuance | Detail |
|--------|--------|
| **Mutually exclusive** | Use EITHER `output.context` OR `output.prompt`, not both. Conflicting results may occur. |

---

##### `experimental.chat.messages.transform` — Transform conversation messages pre-inference

Fires during chat message processing, to transform the full in-memory conversation state before it reaches the model for inference. Empty input suggests operation on the complete in-memory state. Use cases: conversation pruning, context window management, injecting system-level messages mid-conversation.

| Field | Type | Description |
|-------|------|-------------|
| `input` | `{}` | Empty — operates on full in-memory conversation state (no explicit input) |
| `output.messages` | `{ info: Message; parts: Part[] }[]` | Mutable — array of message objects with their info and content parts. Can filter, reorder, rewrite, or remove messages before model inference. |

**Usage:**
```ts
"experimental.chat.messages.transform": async (input, output) => {
  // Prune very old messages to free context window
  output.messages = output.messages.filter(m => m.info.timestamp > cutoff);
}
```

---

##### `experimental.chat.system.transform` — Inject dynamic system prompt strings

Fires during system prompt construction, to transform the system-level context sent with each LLM call. Strings are concatenated/merged into the final system prompt. Use cases: adding task-specific instructions per-session or per-user.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID?` | `string \| undefined` | Optional session identifier |
| `input.model` | `Model` | Active model configuration object |
| `output.system` | `string[]` | Mutable — array of system prompt strings. Strings are concatenated into the final system prompt. |

**Usage:**
```ts
"experimental.chat.system.transform": async (input, output) => {
  // Add per-session instructions to every LLM call's system prompt
  output.system.push(`You are working in project: ${projectName}`);
}
```

---

##### `experimental.provider.small_model` — Override model for small operations

Fires when the system resolves which model to use for a small-model operation (e.g., routing, classification). Only fires for "small_model" operations, not regular chat inference. Use cases: routing classification or embedding tasks to cheaper/faster models automatically. Partially mutable (optional output) — return `undefined` to accept the default resolved model.

| Field | Type | Description |
|-------|------|-------------|
| `input.provider` | `ProviderV2` | The active provider object |
| `output.model?` | `ModelV2 \| undefined` | Optional override model for small-model operations. Return a different `ModelV2` to substitute. |

**Usage:**
```ts
"experimental.provider.small_model": async (input, output) => {
  // Route classification tasks to a cheaper embedding model
  output.model = getEmbeddingProvider().getModel("text-embedding-small");
}
```

---

##### `experimental.compaction.autocontinue` — Control compaction flow behavior

Fires during the compaction process, to decide whether auto-continuation should proceed after a session is compacted. `overflow: true` indicates the current context exceeded token limits, triggering compaction. Use cases for flow control in long sessions (e.g., pause after each compaction cycle). Fully mutable boolean output.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier |
| `input.agent` | `string` | Active agent name |
| `input.model` | `Model` | Model configuration object |
| `input.provider` | `ProviderContext` | Provider connection info |
| `input.message` | `UserMessage` | User message being processed |
| `input.overflow` | `boolean` | Whether the current context exceeded token limits (triggered compaction) |
| `output.enabled` | `boolean` | Mutable — whether auto-continuation is enabled after compaction. Set to `false` to pause processing. |

**Usage:**
```ts
"experimental.compaction.autocontinue": async (input, output) => {
  // Pause after each compaction cycle for user review in long sessions
  if (input.overflow && input.sessionID.length > 100) {
    output.enabled = false;
  }
}
```

---

##### `experimental.text.complete` — Customize inline text completion

Fires during text completion operations (inline suggestions, autocomplete-like features). Operates on specific `partID` granularity within a message. Use cases: providing custom completion text instead of the default model-generated suggestion. Fully mutable string output.

| Field | Type | Description |
|-------|------|-------------|
| `input.sessionID` | `string` | Current session identifier |
| `input.messageID` | `string` | Message being completed |
| `input.partID` | `string` | Specific content part within the message |
| `output.text` | `string` | Mutable — the completed/suggested text output. Replace with custom suggestion text. |

**Usage:**
```ts
"experimental.text.complete": async (input, output) => {
  // Provide a deterministic completion for specific patterns
  if (input.partID.startsWith("prefix_")) {
    output.text = "custom_completion_for_" + input.sessionID;
  }
}
```

---

#### Extension Points (Non-Event Hooks)

These are special keys in the hooks object with different shapes than event hooks. They do not follow `(input, output)` mutation pattern — they are either functions or object maps.

##### `tool` — Custom Tool Registration

Register new AI-callable tools that appear alongside built-in tools for agent invocation. At plugin load time. **Custom tools take precedence over built-in tools if naming conflicts occur.** Map of tool names to their definitions, constructed via the `tool()` helper from `@opencode-ai/plugin`.

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

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | What the tool does — shown to the model in its prompt. Must be clear and specific. |
| `args` | Zod-like schema object | Argument definition using `tool.schema.*` builders. Each field chainable with `.describe()`, `.optional()`, etc. |
| `execute(args, context)` | `(args: any, ctx: Context) => Promise<string>` | Execution function. Receives parsed args and a context object `{ agent, sessionID, messageID, directory, worktree }`. Must return a string (shown to the model as tool output). |

**Tool schema types available via `tool.schema`:** `.string()`, `.number()`, `.boolean()`, `.object()`, `.array()`, `.enum()` — each chainable with `.describe("doc")` for field documentation and likely `.optional()`, `.default(value)`.

---

##### `event` — System Event Subscription

Registers a handler that subscribes to all internal system events. The callback receives every emitted event object. Used for side effects: logging, analytics, notifications (e.g., sending OS notifications on `session.idle`). **Event data shapes are not documented in the public API — they vary by event type and may change between versions.** Use with caution in production plugins.

```ts
export const MyPlugin = async (ctx) => ({
  event: async (input) => {
    if (input.event.type === "session.idle") {
      // Send OS notification when session goes idle
      sendNotification("Session is idle");
    }
  },
})
```

**Available event types:**

| Category | Event Types |
|----------|-------------|
| **Command** | `command.executed` |
| **File** | `file.edited`, `file.watcher.updated` |
| **Installation** | `installation.updated` |
| **LSP** | `lsp.client.diagnostics`, `lsp.updated` |
| **Message** | `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated` |
| **Permission** | `permission.asked`, `permission.replied` |
| **Server** | `server.connected` |
| **Session** | `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated` |
| **Todo** | `todo.updated` |
| **Shell** | `shell.env` |
| **Tool** | `tool.execute.after`, `tool.execute.before` |
| **TUI** | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` |

---

##### `config` — Configuration Observer

Read-only hook for observing OpenCode's configuration at startup. Does not accept or return mutable data.

```ts
export const MyPlugin = async (ctx) => ({
  config: async (input) => {
    // input is the full Config object — read-only observation
    console.log("OpenCode version:", input.version);
  },
})
```

| Field | Type | Description |
|-------|------|-------------|
| `config` handler | `(input: Config) => Promise<void>` | Receives OpenCode's internal configuration. Read-only purpose — observe config state at startup. No mutation expected or supported. |

---

##### `auth` — Custom Authentication Provider

Provides a custom authentication provider for OpenCode's provider integrations. Interacts with the internal account/provider system (account events: `account.update`, `account.remove`, `account.activate`). The exact hook type is not fully documented in the public API but follows an auth-provider pattern similar to the V2 spec.

```ts
export const MyPlugin = async (ctx) => ({
  auth: {
    // Provide credentials manager / auth flow handlers
    getCredentials: async () => ({ token: "..." }),
    onAccountUpdate: async (event) => { /* ... */ },
  },
})
```

---

##### `provider` — Provider Customization Hook

Customizes or extends OpenCode's provider system during plugin initialization. Interacts with internal provider infrastructure including V2 provider hooks (e.g., `experimental.provider.small_model`). The exact signature is not fully documented but allows customizing how providers are connected, configured, and managed.

```ts
export const MyPlugin = async (ctx) => ({
  provider: {
    // Customize provider behavior at runtime
  },
})
```

---

##### `dispose` — Plugin Teardown Handler

Fires when the plugin is being unloaded/terminated. Essential for preventing resource leaks in long-running plugins (closing connections, clearing timers, flushing buffers). No input or output parameters. Must be async (`Promise<void>`) to handle async cleanup operations.

```ts
export const MyPlugin = async (ctx) => ({
  dispose: async () => {
    // Clean up resources when plugin is unloaded
    await connection.close();
    clearInterval(timer);
  },
})
```

| Field | Type | Description |
|-------|------|-------------|
| `dispose` handler | `() => Promise<void>` | No input, no output. Called during plugin teardown for cleanup operations. Must be async to handle deferred cleanup. |

---

#### Tool Schema Reference (`tool.schema.*`)

The Zod-based schema builder used in custom tool definitions supports the following types:

| Method | Description |
|--------|-------------|
| `tool.schema.string()` | Text input field |
| `tool.schema.number()` | Numeric input field |
| `tool.schema.boolean()` | Toggle/boolean input |
| `tool.schema.object()` | Nested object with sub-fields |
| `tool.schema.array()` | Array of items (use `.of(tool.schema.*)` for item type) |
| `tool.schema.enum(values)` | Enumerated choice from a set of values |

**Common chainable methods:**

| Method | Description |
|--------|-------------|
| `.describe("text")` | Field documentation shown to the model |
| `.optional()` | Makes the field optional (nullable) |
| `.default(value)` | Default value when field is not provided |
| `.min(n)`, `.max(n)` | Numeric bounds (for number fields) |

---

#### Hook Ordering & Conflict Resolution Summary

| Concern | Rule |
|---------|------|
| **Multiple plugins registering the same hook** | All handlers fire sequentially in plugin load order. Each sees the mutations of prior hooks. |
| **`permission.ask` — multiple handlers** | Last loaded plugin's return value takes precedence for `output.status`. |
| **Custom tool naming conflicts** | Plugin-registered tools take precedence over built-in tools with the same name. |
| **Experimental hook stability** | Experimental hooks may change or be removed between OpenCode versions. Do not rely on them in production plugins without version guards. |
