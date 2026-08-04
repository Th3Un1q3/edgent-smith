# OpenCode Plugin Lifecycle & State Patterns

Reusable architectural patterns for OpenCode plugin development — hook lifecycle, state management, and configuration.

## Hook Lifecycle

Plugins register hooks at startup across four phases: **message** (`chat.message`, inspect prompts for directives), **execution** (`tool.execute.before`/`after`, intercept tool calls for counting, logging, or enforcement), **idle** (`event`, session.idle, evaluate accumulated state and persist flags), and **cleanup** (`dispose`). Session-tracking plugins operate across all four phases; stateless plugins (validators, formatters) use one or two.

## State Management

- **SessionStorage**: State persists under a namespaced key (e.g., `"skillUsageTracker"`) via `readState`/`updateState` hooks to read/modify/persist.
- **Null guards**: Hooks must guard on null state (`if (!state) return`) — state may be absent before first write.
- **Plugin isolation**: Each plugin uses its own namespace key. No shared state between plugins.

## Configuration

Plugin-specific config lives in the plugin harness configuration file under a `plugins` key, keyed by plugin ID. The plugin reads its config from the harness context.

## Permission Gating

Permission interception runs on the `event` hook for `permission.asked` — NOT the `permission.ask` hook, which is typed but never dispatched at runtime in opencode 1.18.4 (see mem:refactoring/permission-hooks).

- **Reject** with `client.postSessionIdPermissionsPermissionId({ path: { id: sessionID, permissionID: requestID }, body: { response: 'reject' } })` — the SDK body type has NO `message` field, so the rationale is delivered separately via `sendMessage({ noReply: true })`.
- **Gate on an out-of-band flag file**, not in-memory state, so the mode toggles from outside a running session. Default `.tmp/is_afk`, overridable via a plugin option (`flagPath`).
- **Emit an automated `<steering priority="warning">` message**, not a plain string — plugins follow the schema in `.opencode/instructions/steering-message.md`. The body must be actionable and noise-free: state that the permission was auto-denied because the user is AFK, and instruct the agent not to retry but to stop and report the blocked step. The constant is exported (`AFK_MESSAGE`) so tests assert against it instead of a hardcoded literal.
- **Operator toggle**: `just agent_utils/afk [on|off|status]`; path overridable via the `AFK_FLAG_FILE` env var.
- **Blanket deny**: while the flag file exists every permission request is denied — this is not a per-tool denylist.

Reference implementation: `.opencode/plugins/afk-enforcer.ts`. Hook-dispatch pitfall and SDK method details: mem:refactoring/permission-hooks.

## References

- `mem:refactoring/plugin-imports` — import alias rules for source vs test
- `mem:refactoring/restructure-patterns` — inner closure vs module scope for helpers
