# Instructions Context Loader Plugin — Refined Requirements

## 0. Extracted Codebase Principles

The following 10 principles were derived from reviewing existing plugins (`session-tracker.ts`, `todo-enforcer.ts`) and helpers (`kv-store.ts`, `logger.ts`, `session-helpers.ts`). Every implementation step below must follow these patterns exactly:

| # | Principle | Implementation Rule | Source Evidence |
|---|-----------|--------------------|-----------------|
| 1 | **Plugin Factory Pattern**: `export const name: Plugin = async ({ client, project, directory }) => { return { hooks + dispose } }` | Use this exact function signature and return shape. No variations. | `session-tracker.ts` line 7, `todo-enforcer.ts` line 29 — both use exact signature |
| 2 | **Helper-first architecture**: All shared code goes into `/helpers/`: `log()`, `readState()/updateState()`, `sendMessage()` | Import helpers from relative paths (`./helpers/logger.ts`, etc.). Never inline helper logic in plugins. | Three helper files exist under `/helpers/`; no inline implementations in any plugin |
| 3 | **Functional state updates via immutable spread**: Always `updateState(id, (s) => ({ ...s, field }))` — never direct mutation | Every state change must use functional updater with object spread. No property assignment on `session`. | All plugins use `updateState(id, (s) => ({ ...s }))` exclusively; never direct mutation |
| 4 | **Guarded initialization**: Check before overwriting (`if (session[field]) return s`) | All timestamp/state recorders must guard against re-overwrite unless intentionally replacing. | `session-tracker.ts` line 11: `if (session[SESSION_FIELDS.startedAt]) return session` |
| 5 | **Logging conventions**: Use `log(client, "info"/"debug"/"warn", msg)` only — no error level. Messages auto-prefixed with `[PLUGIN_ID]`. Log init + dispose at `"info"` | Never call `client.app.log` directly. Always use the `log()` helper from helpers/logger.ts. No "error" log level exists. | `logger.ts`: only "debug"/"info"/"warn" levels; no error level exists |
| 6 | **Plugin ID convention**: Module-level `const PLUGIN_ID = "plugin-name"` — private, never exported | Every plugin must have one local PLUGIN_ID const used in all log messages and error references. | Every plugin has module-level `const PLUGIN_ID = "name"` — private, never exported |
| 7 | **Helper dependency injection**: All helpers receive `{ client }` as first parameter or via destructured object | Never pass raw SDK objects directly to user-facing APIs; always route through helper functions. | All helpers take `{ client }` as first parameter or destructured argument |
| 8 | **Disposal pattern**: Return `dispose: async () => { log(client, "info", ...) }` for cleanup logging | Every plugin must return a dispose handler that logs `"plugin-name disposed"`. No file cleanup needed beyond state writes. | All three plugins return `dispose: async () => { log(client, "info", ...) }` |
| 9 | **Event subscription model**: Return object keys = event names (`"event"`, `"chat.message"`). Handler receives `{ sessionID, properties, ... }` | Event handlers always destructure the first parameter for `sessionID` and `properties`. Use exact key names from SDK docs. | Keys match SDK event names; handlers destructure `{ sessionID, properties }` |
| 10 | **Type assertions from SDK types**: Use `as Type` casts when SDK returns loose union types | Never assume SDK return types match your expectations — always use explicit `as T` narrowing on properties read from the SDK. | `todo-enforcer.ts` lines 35-36: explicit `as string` and `as "..."` narrowing on SDK returns |

---

## 1. Purpose & Scope

The `instructions-context-loader` plugin scans scoped instruction files in `.github/instructions/`, matches them against agent file operations at runtime, and injects relevant context into the session.

**What it handles:** Scoped instructions (files with a specific `applyTo` glob).  
**What is out of scope:** Global instructions (`applyTo: "**"` or no frontmatter) — see Section 3 for classification rules.

---

## 2. Architecture Overview

### Plugin function signature (from documented interface)

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const instructionsContextLoader: Plugin = async ({ client, project, directory }) => {
  // ... initialization
  return {
    "tool.execute.before": beforeHook,
    "tool.execute.after": afterHook,
    dispose: async () => {},
  }
}
```

### Event subscriptions needed

| Hook | Fires for | Purpose |
|------|-----------|---------|
| `tool.execute.before` | All tools (filtered by tool name) | Intercept file operations, match paths against scoped instructions, inject context |
| `tool.execute.after` | All tools (filtered by tool name) | Attach visual indicator to output title |

### State management pattern

- **Sole persistence layer (kv-store):** Per-session instruction-loaded state is read from and written to kv-store on every runtime injection decision via `readState`/`updateState` helpers (see `.opencode/plugins/helpers/kv-store.ts`). The `loadedInstructions` field stores an array of absolute file paths for each session ID. **No in-memory cache or shortcut — every check reads from and writes to persistent storage.**
- **Lazy initialization:** When a new session is encountered, its kv-store entry may not yet exist. On first write, initialize the `loadedInstructions` field as an empty array (`{ ...s }` with no pre-populated entries). Subsequent checks behave identically — read returns empty set until instructions are injected and written back.
- **Rationale:** OpenCode sessions are inherently ephemeral but each gets a unique kv-store key. Persisting loaded-instruction state per session means the plugin can accurately track which scoped instructions have been injected into that specific session's context window across its entire lifetime, preventing duplicate injections regardless of how many times an instruction becomes relevant during the session.

---

## 3. Startup Phase — Scan & Compile

### Configuration (fixed constants, no user config)
- **Scan directory:** `.github/instructions/` relative to `directory` (project root)
- **File pattern:** `**/*.instructions.md` (recursive)

### Per-file processing pipeline

For each discovered file:

1. Read raw content
2. Parse YAML frontmatter (between leading `---` delimiters)
3. Extract `applyTo` directive — accepted formats: single string or array of strings
4. Classify:

| Condition | Action |
|-----------|--------|
| No frontmatter at all | Skip, log warning `[instructions-context-loader] Warning: no YAML frontmatter in <path>` |
| Invalid/unclosed frontmatter delimiters | Skip file, log warning `[instructions-context-loader] Warning: Failed to parse frontmatter in <path>` |
| No `applyTo` field | Global instruction — log note, skip runtime loading |
| `applyTo: "**"` or empty string | Global instruction — log note, skip runtime loading |
| Scoped `applyTo` (one+ non-wildcard globs) | **Store for runtime matching** |

### Stored data structure per scoped instruction

```typescript
interface ScopedInstruction {
  filePath: string           // Absolute path on disk
  title?: string             // Frontmatter "title" field
  description?: string       // Frontmatter "description" field
  applyToPatterns: string[]  // Parsed glob patterns from applyTo
  content: string            // Markdown body (everything after closing ---)
}
```

After all files processed, compile into `ScopedInstruction[]` for runtime matching.

---

### Persisted state schema for loaded-instruction tracking (sole authority)

Each session's kv-store entry carries an additional field alongside whatever other plugins store. **This is the single source of truth for loaded-state decisions.**

```typescript
interface SessionInstructionState {
  loadedInstructions?: string[]    // Absolute file paths of instructions injected into this session
}
```

- `loadedInstructions` is initialized as empty array on first write for a new (unseen) session.
- The field is appended to (never replaces) whatever state the session-tracker or other plugins have written — use immutable spread via `updateState`.
- Every runtime injection decision reads from and writes to this field directly via `readState(sessionID, s => s.loadedInstructions ?? [])` from kv-store — see Section 5 and Step 3. No in-memory cache shortcuts exist.

### Performance defense
- If >200 scoped instructions found at startup, log warning and continue normally.

---

## 4. Runtime Phase — Event Hooks

### `tool.execute.before` hook

#### Operation type: write/edit (full injection)
Tools that trigger **complete context injection** (inject full markdown body into model's conversation):

| Tool name | Category |
|-----------|----------|
| `write`, `file.write` | Write — full file replacement |
| `edit`, `file.edit` | Edit — in-place modification |
| `patch` | Patch — targeted diff application |
| `create`, `file.create` | Create — new file creation |

For each matched tool call:
1. Extract target file path from input (handle multiple input schemas: `input.path`, `input.args.file`, `input.filePath`)
2. Match path against pre-compiled scoped instruction patterns using glob matching
3. For each matching instruction not yet loaded into this session: inject full content via the `sendMessage()` helper (see Section 5)
4. Record loaded instructions in the per-session deduplication set

#### Operation type: read (lightweight reference injection)
Tools that trigger **reference-only injection** (inject path + description only):

| Tool name | Category |
|-----------|----------|
| `read`, `file.read` | Read — file content fetch |

For each matched tool call:
1. Same path extraction and glob matching as above
2. For each matching instruction not yet loaded into this session: inject a **brief reference** (not full content):
    ```typescript
    const ref = `📖 Instruction found: <relative_path> — "${description}"`
    await sendMessage({ client, sessionId: sessionID, message: ref })
    ```
    This lets the agent know an instruction exists for this file path without flooding context, allowing it to choose whether to read that instruction itself.

### `tool.execute.after` hook

Attach visual indicator via output title enhancement (matching Skills Plugin pattern from docs):

```typescript
const afterHook = async (input, output) => {
  const matchedInstructions = findMatchedScopedInstructions(input.path)
  if (matchedInstructions.length > 0 && !output.title) {
    const primary = matchedInstructions[0]
    let title = `📖 ${primary.filePath}`
    if (matchedInstructions.length > 1) title += ` (+${matchedInstructions.length - 1} more)`
    output.title = title
  }
}
```

---

## 5. Per-Session Deduplication — Persistent Storage Only

"Maximum 1 message per session per instruction" — implemented via direct kv-store read/write on every injection decision. **No in-memory cache exists.**

### Injection check pattern (every runtime call)
On each tool execution, before injecting an instruction:
1. Read the current `loadedInstructions` array for the active session:
   ```typescript
   const loaded = readState(sessionID, s => s.loadedInstructions ?? [])
   ```
2. Check if the instruction's file path is already in `loaded`. If present — skip injection entirely.
3. If not present — proceed with injection via `sendMessage()`, then write back:

### Injection write pattern (after successful inject)
After injecting an instruction into a session, update kv-store to record it:
```typescript
updateState(sessionID, (s) => ({ ...s, loadedInstructions: Array.from(new Set([...(s.loadedInstructions || []), instruction.filePath])) }))
```
- Functional updater with immutable spread per Principle #3.
- Uses `Set` dedup internally for correctness if the same file somehow triggers multiple writes in one tick.

### New session handling (lazy initialization)
When a new session is encountered, its kv-store entry may not yet have a `loadedInstructions` field. On first read: `readState(sessionID, s => s.loadedInstructions ?? [])` returns an empty set — the session has no prior injections recorded, so all matching instructions proceed normally. The first write initializes the field as an empty array plus the newly injected path.

### Injection via `sendMessage()` helper
All injection code must import and use `sendMessage()` exclusively — never call `client.session.prompt` directly. The `sendMessage()` helper from `helpers/session-helpers.ts` wraps `client.session.prompt({ noReply: true, parts: [{ type: "text", text }] })`.

### State schema reference
The kv-store entry carries a `loadedInstructions?: string[]` field (absolute file paths) alongside whatever other plugins store. This is defined in Section 3's "Persisted state schema" subsection. Every runtime check reads from and writes to this field directly — no shortcuts, no in-memory cache.

---

## 6. Edge Cases & Constraints

| Case | Handling |
|------|----------|
| Multiple overlapping globs on same path | Each matching instruction injects once. No deduplication across different instructions — authors should avoid overlap. |
| File deleted between startup and runtime | Uses pre-loaded content from startup — no re-read at match time. Acceptable for static instruction files. |
| Concurrent tool calls | Handled by OpenCode's sequential hook execution model — no explicit concurrency handling needed |
| New session has no pre-existing loaded state | First read of a new session's kv-store entry returns empty set (`loadedInstructions` field absent or undefined). On first successful injection, `updateState` initializes the field via immutable spread. Subsequent checks behave identically — every decision reads from and writes to persistent storage only, with no in-memory shortcuts. |

---

## 7. Non-Goals

Global `applyTo: "**"` or no-frontmatter file loading is handled per the classification rules in Section 3. All other non-goals (user-facing configuration, instruction caching/bundling, cross-agent distribution, toast notifications, sidebar panels, dynamic reloading) remain out of scope. Persistent memory via kv-store is explicitly in scope — see Sections 2, 3, and 5.

---

## 8. Implementation Plan (Discrete Steps)

### Step 1: Scaffold — Replace stub with plugin shell **aligned to codebase conventions**
**Files:** Modify `.opencode/plugins/instructions-glob-loader.ts`  

Export following the plugin factory pattern defined in Section 2. Define module-level private constant `const PLUGIN_ID = "instructions-context-loader"`. Return object with `"tool.execute.before"`, `"tool.execute.after"`, and `dispose` keys. In `dispose`, call `await log(client, "info", \`${PLUGIN_ID} disposed\`)` per Principle #8. Do not return any empty object — every hook must be wired even if initially a passthrough no-op.

### Step 2: Startup — Scan directory, parse frontmatter, compile scoped instructions **using helper patterns**
**Files:** Modify `.opencode/plugins/instructions-glob-loader.ts`, Create `helpers/instructions-parser.ts`  

Implement scan function using Bun's glob to find matching files under `.github/instructions/`. Create a new helper file `helpers/instructions-parser.ts` with a pure function `parseFrontmatter(rawContent: string): { title?: string; description?: string; applyTo: string | string[] }` that extracts YAML frontmatter between leading `---` delimiters. Use Bun's native YAML support or manual regex extraction — do not add external dependencies. The parser must handle both single-string and array `applyTo` values. Classify each file as global or scoped per the rules in Section 3 of this spec (invalid YAML, missing frontmatter, >200 threshold handled per those entries). During scanning, use `log(client, "warn", ...)` for files with invalid/missing YAML frontmatter: `[${PLUGIN_ID}] Warning: Failed to parse frontmatter in <relative_path>`. Log a note (not warning) for skipped global-scoped instructions: `[${PLUGIN_ID}] Note: <path> is globally scoped — outside plugin scope, skipping`. Build `ScopedInstruction[]` array during initialization. If >200 scoped instructions found at startup, log per Section 3's performance defense entry and continue normally.

### Step 3: Runtime A — `tool.execute.before` hook with differentiated injection **following helper patterns**
**Files:** Modify `.opencode/plugins/instructions-glob-loader.ts`  

Import `log`, `sendMessage`, and all helpers from their respective locations under `./helpers/`. Register the `"tool.execute.before"` hook as a function that destructures `{ sessionID, properties }` from its first parameter (per Principle #9). Extract target file path from tool input using guarded fallback chain: try `input.path`, then `input.args.file`, then `input.filePath` — each with explicit type narrowing via `as string | undefined` per principle #10. Match extracted path against pre-compiled scoped instruction patterns using Bun's built-in glob or a minimal micromatch-compatible pattern matcher. For write/edit tools (`write`, `file.write`, `edit`, `file.edit`, `patch`, `create`, `file.create`), call `sendMessage({ client, sessionId: sessionID, message })` with the full markdown content of each matching instruction not yet loaded into this session. For read tools (`read`, `file.read`), inject a lightweight reference instead. Use `sendMessage` for all injections — never call `client.session.prompt` directly.

### Per-instruction dedup (persistent storage only, no in-memory cache)
Every injection decision reads from and writes to kv-store directly:
1. **Check:** Read the session's loaded state via `const loaded = readState(sessionID, s => s.loadedInstructions ?? [])`. If the instruction's file path is present in `loaded`, skip injection entirely.
2. **Inject:** Call `sendMessage()` with the full content (write/edit) or reference (read).
3. **Record:** After successful injection, update kv-store via `updateState(sessionID, (s) => ({ ...s, loadedInstructions: Array.from(new Set([...(s.loadedInstructions || []), instruction.filePath])) })` — functional updater with immutable spread per Principle #3.

### New session handling
When a new session is encountered its kv-store entry may not yet contain `loadedInstructions`. The first `readState(...)` returns an empty set (`[]`). On the first successful injection, step 3 above initializes the field via `updateState` (empty array + injected path). All subsequent checks for this session behave identically — every decision is persistent storage only.

Persisted state schema defined in Section 3's "Persisted state schema" subsection.

### Step 4: Runtime B — `tool.execute.after` hook for visual indicator **aligned to event model**
**Files:** Modify `.opencode/plugins/instructions-glob-loader.ts`  

Implement as shown in the `afterHook` example in Section 4, setting `output.title` for matching instructions with a single-match or multi-match indicator.

### Step 5: Edge cases, logging consistency, and disposal **following codebase patterns**
**Files:** Modify `.opencode/plugins/instructions-glob-loader.ts`  

Add error boundaries around all frontmatter parsing in startup scan — invalid YAML should be caught and logged via `log(client, "warn", \`${PLUGIN_ID}] Warning: Failed to parse frontmatter in <relative_path>\`)`, not thrown. Ensure every state mutation uses functional updater with object spread (`updateState(id, (s) => ({ ...s, field: value }))`), never direct property assignment. Add guarded checks on all timestamp/state recorders: `if (state[field]) return s` before writing unless intentionally replacing. Implement `dispose` handler per convention: `dispose: async () => { await log(client, "info", \`\${PLUGIN_ID} disposed\`) }` per Principle #8. Create a helper module at `helpers/instruction-matcher.ts` with a pure function `matchPath(targetPath: string, patterns: string[]): ScopedInstruction[]` that handles glob matching — this keeps the plugin file focused on event handling per principle #2 (helper-first architecture). Ensure all log messages include `[${PLUGIN_ID}]` prefix via the helper, not manual string concatenation.

### Summary

| Step | Modified Files | New Files |
|------|---|-----------|
| 1: Scaffold | `.opencode/plugins/instructions-glob-loader.ts` | — |
| 2: Startup scan & parse | `instructions-glob-loader.ts` | `helpers/instructions-parser.ts` |
| 3: Before hook (write/edit + read) | `instructions-glob-loader.ts` | — |
| 4: After hook (visual indicator) | `instructions-glob-loader.ts` | — |
| 5: Edge cases + tests | `instructions-glob-loader.ts` | `helpers/instruction-matcher.ts` |

---

## 9. Current Implementation Samples Found

### Existing code in the workspace

| Artifact | Status | Location |
|----------|--------|----------|
| Plugin stub (unimplemented) | **Stub** — exports empty `{}` | `.opencode/plugins/instructions-glob-loader.ts` |
| session-tracker plugin | **Fully implemented** — subscribes to `chat.message`, `session.error`, `session.idle`; writes timestamps via kv-store | `.opencode/plugins/session-tracker.ts` |
| todo-enforcer plugin | **Fully implemented** — handles `session.idle` events, reads todos via SDK, sends followup messages with dedup logic | `.opencode/plugins/todo-enforcer.ts` |
| Session state persistence (kv-store) | Shared helper library | `.opencode/plugins/helpers/kv-store.ts` |
| Message injection helper (`sendMessage`) | Shared utility using `client.session.prompt()` | `.opencode/plugins/helpers/session-helpers.ts` |

### Existing instruction files that this plugin would process (scoped ones only)

| File | `applyTo` pattern | Would be loaded by plugin? |
|------|---|---|
| `cli-structure.instructions.md` | `"cli/**/*.py,tests/test_cli_*.py,tests/test_*_cli.py"` | Yes — scoped |
| `gh-actions.instructions.md` | `.github/workflows/*.{yml,yaml}` | Yes — scoped |
| `github-actions-tech-guidance.instructions.md` | `".github/workflows/**/*.yml"` | Yes — scoped |
| `justfiles.instructions.md` | `"justfile,**/justfile"` | Yes — scoped |
| `zombie-test-design.instructions.md` | `"**/*.{py,js,ts,sh,go,java,cpp,rs}"` | Yes — scoped (very broad) |
| `tdd-enforcement.instructions.md` | `"**/*.*"` | No — global (outside plugin scope) |
| `writing-style.instructions.md` | *(no frontmatter)* | No — no frontmatter |
| `human-approval.instructions.md` | *(no frontmatter)* | No — no frontmatter |
| `mcp-tool-usage.instructions.md` | *(no frontmatter)* | No — no frontmatter |

### Relevant patterns from existing plugins to reuse exactly

1. **Event subscription pattern** (from session-tracker): map event names to async functions in the return object, extract `event.properties.sessionID`
2. **Session state tracking** (from todo-enforcer): use `readState`/`updateState` from kv-store for per-session dedup logic with date-based conditional checks
3. **Message injection** (from session-helpers): call `client.session.prompt({ noReply: true, parts: [{ type: "text", text }] })` — the established pattern for non-intrusive context delivery
4. **Output enhancement** (from Skills Plugin docs): set `output.title` in `tool.execute.after` to attach emoji-prefixed indicators

---

## Summary

The instructions-context-loader plugin handles scoped instruction files only — those with a specific `applyTo` glob pattern. Global-scoped files (`applyTo: "**"` or no frontmatter) fall outside its scope and are classified per Section 3 rules. Per-session deduplication uses persistent storage exclusively: every injection decision reads from and writes to kv-store via `readState`/`updateState` — no in-memory cache or shortcut exists. New sessions initialize their first injected instruction on-demand (first write creates the `loadedInstructions` field), then all subsequent checks behave identically. Write/edit operations receive full content injection; read operations receive lightweight path-and-description references to avoid flooding the model's attention window. A helper-first architecture (see Section 0 principles) keeps all shared logic in `/helpers/`, with the plugin file focused exclusively on event handling and routing. Emoji-prefixed output title serves as the sole visual indicator of loaded instructions, attached via `tool.execute.after`.
