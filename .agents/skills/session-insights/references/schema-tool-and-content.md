# Tool Parts and Instructional Content

## 8. `tool` — Most Complex Part Type

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

### `.parts[].state` — Per-Tool State Structure

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

## Skill Loading Operations

Skills are loaded during sessions via tool parts with `tool == "skill"`. To find which skills were loaded, query for these parts and inspect their `.state.input.name` or `.state.metadata.name` fields.

**Example jq queries:**
```bash
# Extract all skill names that were loaded
jq '[.messages[].parts[] | select(.type == "tool" and .tool == "skill") | {name: .state.input.name, dir: .state.metadata.dir}]' session.json

# Count unique skills loaded per session
jq '[.messages[].parts[] | select(.type == "tool" and .tool == "skill") | .state.input.name] | unique' session.json
```

## Instructional Content in Messages

Instructions shown to agents during a session are carried as `text` part types within **user** messages only. The schema does not distinguish instructional text from generative text at the part level — users must filter by message role:

- **User message text parts** (`messages[] | select(.info.role == "user") | .parts[] | select(.type == "text")`) carry all user-provided prompts and instructions.
- **Assistant message text parts** carry agent-generated responses, not instructions.

To extract only instructional content:
```bash
jq -r '.messages[] | select(.info.role == "user") | .parts[] | select(.type == "text") | "---INSTRUCTION---\n" + .text' session.json
```

## System-Injected Instructions (`<steering>`)

Some sessions contain system-injected instruction blocks wrapped in `<steering>` XML tags that appear as text parts within user messages. These are NOT user-provided content — they are framework-generated directives (e.g., scope limits, writing style guidelines, tool call warnings). To distinguish them from genuine user input:

```bash
# Extract only genuine user instructions (exclude steering blocks)
jq -r '.messages[] | select(.info.role == "user") | .parts[] | select(.type == "text" and (.text | startswith("<steering")) | not) | "---INSTRUCTION---\n" + .text' session.json

# Identify all steering blocks in the session
jq -r '.messages[].parts[] | select(.type == "text" and (.text | startswith("<steering"))) | .text' session.json
```

These blocks may carry `reason` and/or `severity` attributes (e.g., `<steering reason="Scope Creep Detected" severity="warning">`).

## Reasoning Parts as Diagnostic Content

While reasoning parts are NOT user instructions, they capture the agent's internal interpretation of whatever was shown to it. If you need to understand how the agent understood its instructions (rather than what the instructions literally were), extract reasoning text:

```bash
jq -r '.messages[].parts[] | select(.type == "reasoning") | .text' session.json
```

Every step-start part is paired with a corresponding reasoning part — this structural invariant means reasoning count always equals step-start count.
