# Session Part Type Schema

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
>
> **Note:** Some text parts carry an additional `.time` object (`{start: <epoch-ms>, end: <epoch-ms>}`) not present in all text parts. This field is optional and appears when timing metadata is available for the text content.
