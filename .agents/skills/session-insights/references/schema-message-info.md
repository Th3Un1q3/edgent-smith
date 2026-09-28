# Session Message Info Schema

## Message Info Schema

Each message's `.info` field contains metadata about that specific message. There are **two variants** found across assistant messages and one schema for user messages:

### Assistant Messages — Variant A (14 fields)

| Field | Type | Notes |
|-------|------|-------|
| `agent` | string | Agent name |
| `cost` | number | Cost of this step |
| `finish` | object? | Completion reason/status marker |
| `id` | string | Message ID (`"msg_..."`) |
| `mode` | string? | The agent mode or persona active during this message (e.g., `"rug-expert"`, `"rug-swe"`). May be null for system-generated assistant messages. Indicates which sub-agent or processing mode produced the response. |
| `modelID` | string | Model identifier for this message |
| `parentID` | string? | Reference to prior message (nullable) |
| `path` | string | Agent path/identity |
| `providerID` | string | LLM provider ID |
| `role` | constant | Always `"assistant"` |
| `sessionID` | string | Session identifier |
| `summary` | string? | Short summary text (nullable — some messages omit it) |
| `time` | object | `{created: <epoch-ms>, completed: <epoch-ms>}` |
| `tokens` | object? | Token counts for this message (nullable) |

### Assistant Messages — Variant B (13 fields, missing `summary`)

Identical to Variant A but **without** the `summary` field. The `mode` field (agent mode/persona) follows the same schema as Variant A and is present in both variants. This is the only difference between variants.

### User Messages — Single Schema (7 fields)

| Field | Type | Notes |
|-------|------|-------|
| `agent` | string | Agent name |
| `id` | string | Message ID |
| `model` | object? | Model identifier object. Structure: `{providerID: string, modelID: string}`. May be null if undefined. |
| `role` | constant | Always `"user"` |
| `sessionID` | string | Session identifier |
| `summary` | object? | Structured summary data. Typically contains `{diffs: []}` describing file/content changes referenced by the user. Content may vary across OpenCode versions. |
| `time` | object | `{created: <epoch-ms>}` — timestamp of user message creation |
