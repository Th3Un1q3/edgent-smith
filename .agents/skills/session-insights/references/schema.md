# OpenCode Session Export JSON Schema

> Reference guide for navigating any OpenCode session export (e.g., `session.json`). All field names, types, and nested structures are preserved from the raw export format.

## Overview

The session review document has a two-level structure: session metadata and message history.

| Field | Type | Description |
|-------|------|-------------|
| `info` | Object | Session-level metadata (cost, tokens, model, timestamps) |
| `messages` | Array | Message objects, each with `info` (metadata) and `parts` (content payloads) |

## Top-Level Structure

### `info` — Session Metadata Object

The top-level `info` field is a single object containing session identity, model config, telemetry, and timestamps.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique session identifier (`"ses_..."`) |
| `slug` | string | Human-readable slug |
| `projectID` | string | Project/workspace identifier |
| `directory` | string | Root directory of the session |
| `path` | string | Sub-path within project (may be empty) |
| `title` | string | Session title |
| `agent` | string | Agent name |
| `model` | Object | Model configuration (see nested table below) |
| `version` | string | OpenCode version identifier |
| `summary` | Object | Session-level diff summary (see nested table) |
| `cost` | number | Total cost in USD |
| `parentID` | string? | Parent session identifier (nullable). Links to a parent/ancestor session for lineage tracing. |
| `permission` | array of objects | Permission policy entries applied during the session. Each object has: `permission` (string, permission name), `pattern` (string glob), and `action` (`"allow"` or `"deny"`). |
| `tokens` | Object | Token usage breakdown (see nested table) |
| `time` | Object | Session timestamps (see nested table) |

#### `.info.model` — Model Configuration

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Full model identifier |
| `providerID` | string | Provider identifier |
| `variant` | string? | Model variant or flavor. May be null if not applicable. |

#### `.info.summary` — Diff Summary

| Field | Type | Notes |
|-------|------|-------|
| `additions` | number | Total lines added across session |
| `deletions` | number | Total lines deleted across session |
| `files` | number | Number of files modified |

#### `.info.tokens` — Token Usage Breakdown

| Field | Type | Notes |
|-------|------|-------|
| `input` | number | Input tokens consumed |
| `output` | number | Output tokens generated |
| `reasoning` | number | Tokens used for reasoning steps |
| `cache.read` | number | Cache reads (prompt caching) |
| `cache.write` | number | Cache writes (prompt caching) |

> **Note:** The `cache` fields above are nested under `.tokens.cache`, not flat keys. Access via `.info.tokens.cache.read`.

#### `.info.time` — Timestamps

| Field | Type | Notes |
|-------|------|-------|
| `created` | number | Session creation time (epoch ms) |
| `updated` | number | Last update time (epoch ms) |

### `messages` — Message History Array

An array of message objects. Each message has exactly two keys: `info` and `parts`. Roles include `assistant` and `user`.

#### Role Distribution

| Role | Description |
|------|-------------|
| `assistant` | Agent/system messages (including tool responses) |
| `user` | User prompts |

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

## Part Type Schema

Every part shares these **base keys**:

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Unique part ID (`"prt_..."`) |
| `messageID` | string | Parent message ID |
| `sessionID` | string | Session identifier |
| `type` | constant | Type discriminator — one of 8 values |

### 1. `compaction`

Records session compaction events when context windows are managed. The `auto` flag indicates whether the agent or an external process triggered it; `tail_start_id` marks the first retained message after compaction.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key (always present) |
| `messageID` | string | Base key (always present) |
| `sessionID` | string | Base key (always present) |
| `type` | constant | `"compaction"` |
| `auto` | boolean? | Whether compaction was auto-triggered |
| `overflow` | string/array? | Overflow context data |
| `tail_start_id` | string | ID of first message retained after compaction |

### 2. `file`

Represents a standalone file attachment or reference within a message. Used for file previews, downloads, or external references.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"file"` |
| `filename` | string | Display filename |
| `mime` | string? | MIME type of the file content |
| `source` | string? | Origin/source reference |
| `url` | string? | URL to fetch the file content |

### 3. `patch`

Represents a set of file edits/diffs applied during an operation. Always multi-file (note plural `files`). Each element contains path, oldContent, newContent, and hunks (nested).

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"patch"` |
| `files` | array of objects | Per-file diff details; each element contains path, oldContent, newContent, hunks (nested) |

### 4. `reasoning`

Captures the agent's chain-of-thought / internal reasoning. Every step-start has a corresponding reasoning part. The `time` field tracks how long the model took to generate it.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"reasoning"` |
| `text` | string | The actual reasoning content |
| `time` | object | `{start: <epoch-ms>, end: <epoch-ms>}` — duration of reasoning generation |

### 5. `step-finish`

Signals the conclusion of an agent step, carrying cost/token telemetry and a full state snapshot at step end. Always paired with its corresponding `step-start`.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"step-finish"` |
| `cost` | number? | Monetary cost of this step |
| `reason` | string? | Reason for completion: e.g., `"completed"`, `"error"` |
| `snapshot` | string? | Hash reference to saved state (string). Previously documented as an object but live data shows it is a hash/string ID. |
| `tokens` | object? | Token counts (input/output) for the step |

### 6. `step-start`

Signals the beginning of an agent step. Has a `snapshot` that mirrors the one in its paired `step-finish`, allowing delta computation between start and end states. No extra metadata beyond identifiers.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"step-start"` |
| `snapshot` | string? | Hash reference to saved state (string). Previously documented as an object but live data shows it is a hash/string ID. |

### 7. `text`

Plain text content parts — human-readable messages, responses, or summaries within a message.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `type` | constant | `"text"` |
| `text` | string | The text content of the part |

> **Note:** Text parts appear in both user and assistant messages. User message text parts carry user-provided prompts/instructions — though some sessions may contain system-injected `<steering>` blocks within these same parts (see section on System-Injected Instructions for detection). Assistant message text parts carry agent-generated responses, not instructions. To distinguish instructional from generative text, filter by `.info.role == "user"` on the parent message object and then exclude any parts whose content starts with `<steering`.

> **Note:** Some text parts carry an additional `.time` object (`{start: <epoch-ms>, end: <epoch-ms>}`) not present in all text parts. This field is optional and appears when timing metadata is available for the text content.

### 8. `tool` — Most Complex Part Type

Represents a tool invocation and its result. Contains deeply nested `state` that varies by `tool` name. This is the most structurally complex part type, with per-tool input/output schemas and metadata.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `id` | string | Base key |
| `messageID` | string | Base key |
| `sessionID` | string | Base key |
| `parentMessageID` | string? | ID of the user message that triggered this tool call. **NOTE:** This field may be null, absent from the object entirely, or only present on certain tool types depending on OpenCode version. When `parentMessageID` is absent, correlate instructions to actions using step-level array ordering — each assistant message's parts (step-start + reasoning + step-finish + any tools) form a logical unit that corresponds to the most recent preceding user message in the messages array. |
| `type` | constant | `"tool"` |
| `callID` | string | Unique call ID for the tool invocation |
| `tool` | string | Tool name. Examples: `"bash"`, `"read"`, `"edit"`, `"write"`, `"patch"`, `"task"`, `"skill"`. Names may vary across OpenCode versions and installations. |
| `state` | object | Deeply nested state object (see sub-table below) |

> **Note:** This is an illustrative, non-exhaustive list. Tool names are dynamic and may include custom or skill-based tools depending on the session's active capabilities. Consumers should not hardcode tool name lists; instead, use the `type == "tool"` discriminator to identify invocations.

#### `.parts[].state` — Per-Tool State Structure

**Common fields across all tools:** When `status == "error"`, the `output` field is null and the actual error text appears in the `error` field.

| Key | Inferred Type | Notes |
|-----|---------------|-------|
| `status` | string | e.g., `"completed"`, `"error"` |
| `input` | object | Tool-specific input params (keyed by tool name) |
| `metadata` | object? | Tool-specific metadata fields (see "Tool-specific Metadata" section below). May be null. |
| `output` | string? | Result/output text from the tool call (may be null on error) |
| `error` | string? | Error message if `status == "error"`, null otherwise |
| `title` | string | Human-readable title (e.g., command or filepath) |
| `time` | object | `{start: <epoch-ms>, end: <epoch-ms>}` — call duration |

**Tool-specific `input` fields:**

| Tool | Input Fields | Notes |
|------|-------------|-------|
| `bash` | `{command, timeout}` | Shell command and execution timeout |
| `read` | `{filePath}` | File path to read |
| `edit` | `{filePath, oldString, newString}` | String replacement parameters |
| `write` | `{content, filePath}` | Content to write and target path |
| `patch` | `{patches...}` | Patch objects for multi-file diffs |
| `task` | object? | Input for session/task reference operations. Contains `{query: string}` — the query or reference details passed to the task tool. May be null. |
| `skill` | `{name: string}` | The skill identifier being loaded/requested. Used when loading skills during a session. |

**Tool-specific `metadata` fields (nested at `.state.metadata`):**

| Tool | Metadata Fields | Notes |
|------|-----------------|-------|
| `bash` | `{output, exit, truncated}` | Shell output, exit code, truncation flag |
| `read` | `{preview, display: {type, path, text, lineStart, lineEnd, totalLines}, loaded?}` | File preview and structured display info; `loaded` is a boolean indicating whether the file content was fully loaded |
| `edit` | `{diagnostics, diff, filediff: {file, patch, additions, deletions}}` | Edit diagnostics and computed diff stats |
| `write` | `{diagnostics, filepath, exists, truncated}` | Write result with existence/truncation flags |
| `task` | `{parentSessionId: string, sessionId: string, model: object?, truncated: boolean?}` | Session reference metadata. `model` contains `{providerID, modelID, variant?}`. Indicates which session and model context was referenced; `truncated` indicates if the output was truncated. |
| `skill` | `{name: string, dir: string, truncated: boolean}` | Loaded skill metadata: `name` is the identifier, `dir` is its installed directory path, `truncated` indicates if content was fully loaded. |

### Skill Loading Operations

Skills are loaded during sessions via tool parts with `tool == "skill"`. To find which skills were loaded, query for these parts and inspect their `.state.input.name` or `.state.metadata.name` fields.

**Example jq queries:**
```bash
# Extract all skill names that were loaded
jq '[.messages[].parts[] | select(.type == "tool" and .tool == "skill") | {name: .state.input.name, dir: .state.metadata.dir}]' session.json

# Count unique skills loaded per session
jq '[.messages[].parts[] | select(.type == "tool" and .tool == "skill") | .state.input.name] | unique' session.json
```

### Instructional Content in Messages

Instructions shown to agents during a session are carried as `text` part types within **user** messages only. The schema does not distinguish instructional text from generative text at the part level — users must filter by message role:

- **User message text parts** (`messages[] | select(.info.role == "user") | .parts[] | select(.type == "text")`) carry all user-provided prompts and instructions.
- **Assistant message text parts** carry agent-generated responses, not instructions.

To extract only instructional content:
```bash
jq -r '.messages[] | select(.info.role == "user") | .parts[] | select(.type == "text") | "---INSTRUCTION---\n" + .text' session.json
```

### System-Injected Instructions (`<steering>`)

Some sessions contain system-injected instruction blocks wrapped in `<steering>` XML tags that appear as text parts within user messages. These are NOT user-provided content — they are framework-generated directives (e.g., scope limits, writing style guidelines, tool call warnings). To distinguish them from genuine user input:

```bash
# Extract only genuine user instructions (exclude steering blocks)
jq -r '.messages[] | select(.info.role == "user") | .parts[] | select(.type == "text" and (.text | startswith("<steering")) | not) | "---INSTRUCTION---\n" + .text' session.json

# Identify all steering blocks in the session
jq -r '.messages[].parts[] | select(.type == "text" and (.text | startswith("<steering"))) | .text' session.json
```

These blocks may carry `reason` and/or `severity` attributes (e.g., `<steering reason="Scope Creep Detected" severity="warning">`).

### Reasoning Parts as Diagnostic Content

While reasoning parts are NOT user instructions, they capture the agent's internal interpretation of whatever was shown to it. If you need to understand how the agent understood its instructions (rather than what the instructions literally were), extract reasoning text:

```bash
jq -r '.messages[].parts[] | select(.type == "reasoning") | .text' session.json
```

Every step-start part is paired with a corresponding reasoning part — this structural invariant means reasoning count always equals step-start count.

## Valid Part Types

The following table lists all valid values for the `type` discriminator on parts:

| Type Name | Conceptual Purpose |
|-----------|--------------------|
| `compaction` | Session compaction events (context window management) |
| `file` | Standalone file attachment or reference |
| `patch` | Multi-file edit/diff operations |
| `reasoning` | Agent chain-of-thought / internal reasoning |
| `step-finish` | Agent step completion with telemetry and state snapshot |
| `step-start` | Agent step initiation with initial state snapshot |
| `text` | Plain text content (messages, responses, summaries) |
| `tool` | Tool invocation and result (most structurally complex) |

## Structural Rules

- **step-start / step-finish / reasoning are a triad**: Every agent step produces exactly one of each part type. This is a fixed structural invariant — no variation across sessions.
- **Tool parts vary by session context**: The ratio of tool to text parts depends on the nature of the work (code-heavy vs. discussion-heavy sessions).

## Info Schema Variants Summary

| Variant | Message Role | Fields | Key Difference |
|---------|-------------|--------|----------------|
| A | assistant | 14 | Has `summary`; uses separate `modelID` + `providerID` |
| B | assistant | 13 | Missing `summary`; everything else identical to A |
| User | user | 7 | Simpler schema; `model` is an optional object with `{providerID, modelID}` and `summary` is structured data |

## Useful jq Queries

### Navigation & Inspection

```bash
# Extract full session info metadata
jq '.info' session.json

# List all top-level keys and their types/sizes
jq 'to_entries[] | {key: .key, type: (.value | type), size: ((.value | if type == "array" then length elif type == "object" then (.keys | length) else null end))}' session.json

# Count messages
jq '.messages | length' session.json

# List all distinct part types with counts
jq '[.messages[].parts[].type] | group_by(.) | map({(.[0]): length}) | add' session.json

# Show first message structure in full
jq '.messages[0]' session.json
```

### Extraction

```bash
# Extract all user message summaries
jq '[.messages[] | select(.info.role == "user") | .info.summary]' session.json

# Extract all tool call names and their status
jq '[.messages[].parts[] | select(.type == "tool") | {tool: .tool, status: .state.status}]' session.json

# Extract reasoning text from all steps
jq -r '.messages[].parts[] | select(.type == "reasoning") | .text' session.json

# Get session total cost and token usage
jq '{cost: .info.cost, tokens: .info.tokens}' session.json

# Extract all patch file paths
jq -r '.messages[].parts[] | select(.type == "patch") | .files[].path' session.json
```

#### Extract All Instructions Shown to Agent

Extract all user-provided instructions carried as text parts from user messages:
```bash
jq -r '.messages[] | select(.info.role == "user") | .parts[] | select(.type == "text") | "---INSTRUCTION---\n" + .text' session.json
```

#### Count Instruction-Carrying Text Parts Per Message

Count how many instruction-carrying text parts each user message contains:
```bash
jq '[.messages[] | select(.info.role == "user") | {msgID: .info.id, instructionParts: [.parts[] | select(.type == "text")] | length}]' session.json
```

### Filtering

```bash
# Filter messages by role and get their part counts
jq '[.messages[] | {role: .info.role, parts: (.parts | length)}]' session.json

# Find all failed tool calls (state.status == "error")
jq -r '.messages[].parts[] | select(.type == "tool" and .state.status == "error") | "\(.callID): \(.tool) — \(.state.output // .state.error // "unknown")"' session.json

# Filter parts by type (e.g., only compaction events)
jq '.messages[].parts[] | select(.type == "compaction")' session.json

# Find messages with patch content
jq '[.messages[] | select([.parts[] | .type] | index("patch"))]' session.json

# Get step-by-step timing (start/end pairs)
jq '[.messages[].parts[] | select(.type == "step-start") | {id: .id, time: .state.time}]' session.json
```

## Schema Notes & Design Conventions

- **Base keys on all parts**: Every part object always has exactly four base keys (`id`, `messageID`, `sessionID`, `type`). Type-specific keys are added on top. This is a discriminated union pattern where `type` serves as the discriminant.
- **Tool metadata schemas may evolve**: The documented metadata fields per tool represent the known schema at the time this reference was written. Additional fields (e.g., `read`'s `loaded`) may exist in live data but were not captured during initial survey. Consumers should inspect raw export data for tool-specific fields not documented here, especially when working across OpenCode versions.
- **Null vs missing fields**: Some assistant info objects omit `summary` entirely (Variant B) rather than setting it to null — indicating that omission, not null, represents "no value." Similarly, `tokens` and `finish` in Variant A are optional (may be absent).
- **Nested state varies by tool name**: The `tool` part's `state.input` field is keyed by the tool name itself (`"bash"` → `{command}`, `"read"` → `{filePath}`), creating a dynamic schema that depends on the `tool` value. Consumers must handle this polymorphism.
- **Epoch millisecond timestamps**: All time fields use epoch milliseconds (not seconds or ISO strings). Duration is always computed as `end - start`.
- **Session compaction preserves tail**: The `tail_start_id` in compaction parts indicates which message ID became the new first message after older ones were removed — useful for reconstructing the session history with gaps.
