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

## References

- `mem:refactoring/plugin-imports` — import alias rules for source vs test
- `mem:refactoring/restructure-patterns` — inner closure vs module scope for helpers
