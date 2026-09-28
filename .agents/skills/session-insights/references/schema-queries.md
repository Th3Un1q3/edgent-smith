# Session Schema Queries and Design Notes

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
