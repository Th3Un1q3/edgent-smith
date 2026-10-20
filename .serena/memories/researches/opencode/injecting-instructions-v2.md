# DeepWiki Q&A with Code Context for Repository: anomalyco/opencode
## Q1
How do code-mode instructions get generated and injected in the session?
### Answer
Code-mode instructions are generated from the session’s `Tool.Snapshot.codeModeCatalog` by `CodeModeInstructions.make(...)` during `SessionContext.select`. opencode:132-151  They are combined with MCP, reference, skill, discovered, built-in, and API-supplied instructions, then included in the initial system context; later catalog changes are rendered as chronological instruction-update system messages. opencode:118-135 opencode:53-64 

---

## Generation

1. `SessionContext.select` snapshots the currently available tools through `registry.snapshot(permissions)`. opencode:130-140 
2. That snapshot supplies `loaded.tools.codeModeCatalog`, which is passed to `CodeModeInstructions.make(...)`. opencode:144-151 
3. `CodeModeInstructions.render` formats the catalog summary:
   - An empty catalog produces a warning not to call `execute`. opencode:19-22 
   - A populated catalog produces the `# Code Mode` prompt, an explanation that listed tools are callable only through `execute`, and the namespace/tool lines. opencode:23-30 
   - A partial catalog additionally tells the model to use synchronous `search(...)` inside `execute` and not guess tool names. opencode:9-17 

## Injection into session context

`select` combines all instruction sources into one `Instructions.List`, with code-mode instructions placed first among the assembled instruction sources. opencode:147-158  The documented ordering confirms that code-mode guidance follows the agent/provider prompt and precedes MCP, reference, skill, `AGENTS.md`, built-in, and session-entry guidance. opencode:63-76 

`SessionContext.load` then passes that combined instruction list to `SessionHistory.entriesForRunner`. opencode:163-178  Inside `entriesForRunner`, `InstructionState.initial` converts the current instruction values into the request’s initial context while preserving the durable message transcript separately. opencode:124-132 

For non-mutating generation, `SessionGenerate.generate` previews the instruction state, builds the transcript with `SessionModelRequest.baseTranscript`, and appends any pending instruction update as a `Message.system(...)` before the user prompt. opencode:46-64 

## Catalog updates during a session

When the tool catalog changes, `CodeModeInstructions.update` compares the previous and current `CodeModeCatalog.Summary`. opencode:32-39 

- If the catalog becomes empty, completeness changes, namespace descriptions change, or the complete catalog’s entries change, it emits either a full replacement catalog or a shorter semantic delta. opencode:36-57 
- For a partial catalog, namespace-count changes can produce a targeted update telling the model which namespaces were added, changed, or removed. opencode:58-94 
- For a complete catalog, added, changed, and removed tools are described without necessarily resending the whole catalog. opencode:96-123 

These updates are durable chronological system messages rather than edits to the original system prompt. opencode:354-385  The runner test shows the same behavior: repeated requests retain the same initial system parts, while a later system message contains the changed instruction text. opencode:1708-1719 

## End-to-end flow

```mermaid
graph TD
  "Tool.Service.snapshot(permissions)" --> "codeModeCatalog"
  "codeModeCatalog" --> "CodeModeInstructions.make"
  "CodeModeInstructions.make" --> "Instructions.combine"
  "Instructions.combine" --> "SessionHistory.entriesForRunner"
  "SessionHistory.entriesForRunner" --> "InstructionState.initial"
  "InstructionState.initial" --> "SessionModelRequest.baseTranscript"
  "SessionModelRequest.baseTranscript" --> "LLM request system context"
  "catalog changes" --> "CodeModeInstructions.update"
  "CodeModeInstructions.update" --> "chronological system message"
```

## Notes

“Code-mode instructions” here are generated from the tool catalog, not discovered `AGENTS.md` files. Separately, `SessionInstructions.load` injects newly discovered instruction files as synthetic session messages with an `instruction.paths` metadata ledger for deduplication. opencode:46-79 

Wiki pages you might want to explore:
- [Session Runner & LLM Execution Loop (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.1)
- [Compaction & Context Management (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.2)
### Citations
**File:** packages/core/src/session/context.ts (L130-158)
```typescript
      // Session permissions narrow discovery the same way they narrow the tool snapshot.
      const permissions = Permission.merge(agent.info.permissions, session.permissions ?? [])
      const loaded = yield* Effect.all(
        {
          tools: registry.snapshot(permissions),
          builtins: builtins.load(),
          discovery: discovery.load(),
          skills: skillInstructions.load(permissions),
          references: referenceInstructions.load(),
          mcp: mcpInstructions.load(permissions),
          entries: entries.load(sessionID),
        },
        { concurrency: "unbounded" },
      )
      return {
        session,
        agent: { ...agent, info: agent.info },
        // Ordered from most to least shared across sessions so the baseline stays a reusable
        // prompt-cache prefix: user-level catalog and guidance, then project instructions, then
        // the date and environment, which vary by day and directory.
        instructions: Instructions.combine([
          CodeModeInstructions.make(loaded.tools.codeModeCatalog),
          loaded.mcp,
          loaded.references,
          loaded.skills,
          loaded.discovery,
          loaded.builtins,
          loaded.entries,
        ]),
```
**File:** packages/core/src/session/context.ts (L163-178)
```typescript
    const load = Effect.fn("SessionContext.load")(function* (selection: Selection) {
      const model = yield* resolveModel(selection.session)
      const history = yield* SessionHistory.entriesForRunner(
        db,
        selection.session.id,
        selection.instructions,
        SessionProviderContext.provenance(model) ?? "local",
      )
      return {
        session: selection.session,
        agent: selection.agent,
        model,
        initial: history.initial,
        messages: history.entries.map((entry) => entry.message),
        tools: selection.tools,
      }
```
**File:** packages/core/src/session/history.ts (L118-135)
```typescript
export const entriesForRunner = Effect.fn("SessionHistory.entriesForRunner")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  instructions: Instructions.List,
  boundary: Boundary,
) {
  return yield* db
    .transaction(() =>
      Effect.gen(function* () {
        const messages = yield* messageEntries(db, sessionID, boundary)
        return {
          initial: yield* InstructionState.initial(db, sessionID, instructions),
          entries: messages,
        }
      }),
    )
    .pipe(Effect.orDie)
})
```
**File:** packages/core/src/session/generate.ts (L46-64)
```typescript
    const transcript = SessionModelRequest.baseTranscript({
      agent: selection.agent.info,
      model,
      tools: selection.tools,
      initial: history.initial,
      messages: history.messages,
    })
    const prepared = yield* context.request.generate({
      session: selection.session,
      agent: selection.agent.id,
      model,
      tools: selection.tools,
      system: transcript.system,
      messages: [
        ...transcript.messages,
        ...(history.instructionUpdate ? [Message.system(history.instructionUpdate)] : []),
        Message.user(input.prompt),
      ],
    })
```
**File:** packages/core/src/codemode/instructions.ts (L9-17)
```typescript
const prompt = (hasMoreTools: boolean) => `# Code Mode

Use the \`execute\` tool to call the tools listed below. They cannot be called directly${hasMoreTools ? ", and neither can \`search\`. Both" : ". They"} only work inside code you pass to \`execute\`.

${hasMoreTools ? `The catalog is partial. Inside \`execute\`, use \`search(...)\` to find a tool, then call it by the \`path\` in the result. \`search\` is synchronous. Call it without \`await\`; it does not return a Promise. Do not guess tool names.

- ${searchSignature}` : "The catalog is complete. Do not guess tool names."}

## Available tools`
```
**File:** packages/core/src/codemode/instructions.ts (L19-22)
```typescript
export function render(catalog: CodeModeCatalog.Summary) {
  if (catalog.total === 0)
    return "No Code Mode tools are currently available. Later Code Mode catalog updates may add or remove tools. Do not call `execute` unless there is at least one available Code Mode tool."

```
**File:** packages/core/src/codemode/instructions.ts (L23-30)
```typescript
  const tools = catalog.namespaces.flatMap((namespace) => {
    return [CodeModeCatalog.namespaceLine(namespace), ...namespace.entries.map((entry) => entry.line)]
  })

  return `${prompt(catalog.shown < catalog.total)}

${tools.join("\n")}`
}
```
**File:** packages/core/src/codemode/instructions.ts (L32-57)
```typescript
export function update(previous: CodeModeCatalog.Summary, current: CodeModeCatalog.Summary) {
  const replacement = `The Code Mode tool catalog has changed. This catalog supersedes the previous Code Mode tool catalog.

${render(current)}`
  if (current.total === 0) return replacement
  const previousComplete = previous.shown === previous.total
  const currentComplete = current.shown === current.total
  if (previousComplete !== currentComplete) return replacement

  const descriptions = Instructions.diffByKey(
    previous.namespaces.filter((namespace) => namespace.description !== undefined),
    current.namespaces.filter((namespace) => namespace.description !== undefined),
    (namespace) => namespace.name,
    (before, after) => before.description !== after.description,
  )
  if (descriptions.added.length > 0 || descriptions.removed.length > 0 || descriptions.changed.length > 0)
    return replacement

  const diff = Instructions.diffByKey(
    previous.namespaces.flatMap((namespace) => namespace.entries),
    current.namespaces.flatMap((namespace) => namespace.entries),
    (entry) => entry.path,
    (before, after) => before.line !== after.line,
  )
  const entriesChanged = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0

```
**File:** packages/core/src/codemode/instructions.ts (L58-94)
```typescript
  if (!currentComplete) {
    if (entriesChanged) return replacement
    const namespaces = Instructions.diffByKey(
      previous.namespaces,
      current.namespaces,
      (namespace) => namespace.name,
      (before, after) => before.count !== after.count,
    )
    const changed = namespaces.added.length > 0 || namespaces.removed.length > 0 || namespaces.changed.length > 0
    if (!changed) return replacement

    const parts = ["The Code Mode tool catalog has changed."]
    if (namespaces.added.length > 0) {
      parts.push(
        `New tool namespaces are available: ${namespaces.added
          .map((namespace) => `\`${namespace.name}\` (${namespace.count} tools)`)
          .join(", ")}.`,
      )
    }
    if (namespaces.changed.length > 0) {
      parts.push(
        `The following namespace inventories changed; search them again before relying on previous results: ${namespaces.changed
          .map((change) => `\`${change.current.name}\` now has ${change.current.count} tools`)
          .join(", ")}.`,
      )
    }
    if (namespaces.removed.length > 0) {
      parts.push(
        `The following tool namespaces are no longer available and must not be used: ${namespaces.removed
          .map((namespace) => `\`${namespace.name}\``)
          .join(", ")}.`,
      )
    }
    const delta = parts.join("\n\n")
    if (delta.length < replacement.length) return delta
    return replacement
  }
```
**File:** packages/core/src/codemode/instructions.ts (L96-123)
```typescript
  if (!entriesChanged) return replacement
  const parts = ["The Code Mode tool catalog has changed."]
  if (diff.added.length > 0) {
    parts.push(
      [
        "New tools are available in addition to those previously listed:",
        ...diff.added.map((entry) => entry.line),
      ].join("\n"),
    )
  }
  if (diff.changed.length > 0) {
    parts.push(
      [
        "Changed tool listings supersede the previously listed ones:",
        ...diff.changed.map((change) => change.current.line),
      ].join("\n"),
    )
  }
  if (diff.removed.length > 0) {
    parts.push(
      `The following tools are no longer available and must not be called: ${diff.removed
        .map((entry) => toolExpression(entry.path))
        .join(", ")}.`,
    )
  }
  const delta = parts.join("\n\n")
  if (delta.length < replacement.length) return delta
  return replacement
```
**File:** services/www/src/docs/content/instructions.mdx (L63-76)
```text
## Ordering

The selected agent or provider system prompt is sent first. OpenCode then assembles initial instructions in this order:

```text
1. Agent or provider system prompt
2. Code Mode tool guidance, when enabled
3. MCP server, reference, and skill guidance
4. Global and project AGENTS.md files, then configured instructions
5. Built-in date and environment context
6. Session-specific instruction entries supplied through the API
```

These sources are combined rather than used as overrides. Nested `AGENTS.md` files discovered later are added to session history in discovery order.
```
**File:** packages/core/test/instruction-state.test.ts (L354-385)
```typescript
  it.effect("persists chronological updates as system messages", () =>
    Effect.gen(function* () {
      const sessionID = SessionSchema.ID.make("ses_instruction_messages")
      const { db, events } = yield* setup(sessionID)
      let value = "Initial context"
      const instructions = source(
        "test/context",
        Effect.sync(() => value),
      )
      const messages = () =>
        db
          .select()
          .from(SessionMessageTable)
          .where(and(eq(SessionMessageTable.session_id, sessionID), eq(SessionMessageTable.type, "system")))
          .orderBy(asc(SessionMessageTable.seq))
          .all()
          .pipe(Effect.orDie)

      // The initial baseline is not chronological history and produces no message.
      yield* InstructionState.prepare(db, events, instructions, sessionID)
      expect(yield* messages()).toEqual([])

      value = "Changed context"
      yield* InstructionState.prepare(db, events, instructions, sessionID)
      const rows = yield* messages()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.data).toMatchObject({ text: "Changed context" })
      expect(rows.map((row) => row.seq)).toEqual([(yield* instructionEvents(db, sessionID)).at(-1)!.seq])

      // A no-op observation adds nothing.
      yield* InstructionState.prepare(db, events, instructions, sessionID)
      expect(yield* messages()).toHaveLength(1)
```
**File:** packages/core/test/session-runner.test.ts (L1708-1719)
```typescript
    expect(s.requests[0].messages).toHaveLength(1)
    expect(s.requests[1].messages.slice(0, 1)).toEqual([...s.requests[0].messages])
    expect(s.requests.map((request) => request.system.map((part) => part.text))).toEqual([
      [defaultSystem, fakeIdentity, "Initial context"],
      [defaultSystem, fakeIdentity, "Initial context"],
    ])
    expect(messageRoles(s.requests[1])).toEqual(["user", "system", "user"])
    expect(s.requests[1]?.messages.at(1)?.content).toEqual([Expected.text("Changed context")])
    // The chronological update is a durable client-visible system message.
    const messages = yield* s.messages
    expect(messages).toHaveLength(3)
    expect(messages[1]).toMatchObject({ type: "system", text: "Changed context" })
```
**File:** packages/core/src/session/instructions.ts (L46-79)
```typescript
    const load = Effect.fn("SessionInstructions.load")(function* (input: Parameters<Interface["load"]>[0]) {
      const claimed = yield* Ref.modify(inFlight, (map) => {
        const existing = map.get(input.sessionID) ?? new Set<string>()
        const newlyClaimed = input.paths.filter((path) => !existing.has(path))
        if (newlyClaimed.length === 0) return [newlyClaimed, map]
        const next = new Map(map)
        next.set(input.sessionID, new Set([...existing, ...newlyClaimed]))
        return [newlyClaimed, next]
      })
      if (claimed.length === 0) return
      yield* Effect.gen(function* () {
        const alreadyInjected = yield* previouslyInjected(store, input.sessionID)
        const toInject = claimed.filter((path) => !alreadyInjected.has(path))
        if (toInject.length === 0) return
        const files = yield* Effect.forEach(
          toInject,
          (path) =>
            fs
              .readFileStringSafe(path)
              .pipe(Effect.map((content) => (content === undefined ? undefined : { path, content }))),
          { concurrency: "unbounded" },
        )
        const readable = files.filter((file): file is { path: string; content: string } => file !== undefined)
        if (readable.length === 0) return
        // Publish directly rather than through Session.synthetic: a Location-scoped layer
        // cannot depend on Session (it routes through LocationServiceMap, forming a type
        // cycle with this node). The durable publish commits the synthetic and its metadata
        // ledger atomically, so releasing the claim afterwards cannot readmit the paths.
        yield* bus.publish(SessionEvent.Synthetic, {
          sessionID: input.sessionID,
          text: readable.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n"),
          description: `Loaded ${readable.map((file) => describePath(root, file.path)).join(", ")}`,
          metadata: { instruction: { paths: readable.map((file) => file.path) } },
        })
```
## Q2
What are the references instructions?
### Answer
"Reference instructions" are the `Instructions.List` produced by `ReferenceInstructions.Service.load()` — one of the instruction sources loaded in `SessionContext.select` and folded into the session's baseline system context, alongside MCP, skills, discovery, built-ins, and API entries. opencode:132-158 

---

## What they are

- The service is imported from `packages/core/src/reference/instructions.ts` as `ReferenceInstructions` and resolved via `ReferenceInstructions.Service` in the `SessionContext` layer. opencode:16-16 opencode:88-88 
- During `select`, `referenceInstructions.load()` is called in parallel with the other sources. Note it takes **no `permissions` argument**, unlike `skills.load(permissions)` and `mcp.load(permissions)`. opencode:132-142 
- Its output (`loaded.references`) is inserted between `loaded.mcp` and `loaded.skills` in `Instructions.combine`, matching the documented ordering step "MCP server, reference, and skill guidance" — i.e., it lands inside the initial system prompt, before `AGENTS.md`/built-ins/entries. opencode:150-158 opencode:63-76 

## How they flow through

1. `select` returns `selection.instructions` including the references source. opencode:144-160 
2. `load` passes them to `SessionHistory.entriesForRunner`, which renders them into the epoch baseline via `InstructionState.initial` → `Instructions.renderInitial`. opencode:163-178 opencode:173-182 
3. If reference values change between requests, they're rendered as a chronological update via `renderUpdateText`/`Instructions.renderUpdate` and persisted as a durable system message — same mechanism as every other `Instructions` source. opencode:38-78 

In tests it's stubbed to `Instructions.empty`, confirming it's just another pluggable source in the same framework rather than a special-case pipeline. opencode:392-394 

## Notes

The provided context doesn't include `packages/core/src/reference/instructions.ts` itself (or `reference.ts`, which declares the underlying `Reference` domain service referenced in `packages/core/src/instance.ts:35`), so I can't tell you what a "reference" concretely is — most likely guidance derived from reference items configured for the project — or what `load()` renders. Due to index size limits not all files are indexed; if you need that file's contents, start a Devin session to read the full source.

Wiki pages you might want to explore:
- [Session Runner & LLM Execution Loop (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.1)
- [Compaction & Context Management (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.2)
### Citations
**File:** packages/core/src/session/context.ts (L16-16)
```typescript
import { ReferenceInstructions } from "../reference/instructions.js"
```
**File:** packages/core/src/session/context.ts (L88-88)
```typescript
    const referenceInstructions = yield* ReferenceInstructions.Service
```
**File:** packages/core/src/session/context.ts (L132-160)
```typescript
      const loaded = yield* Effect.all(
        {
          tools: registry.snapshot(permissions),
          builtins: builtins.load(),
          discovery: discovery.load(),
          skills: skillInstructions.load(permissions),
          references: referenceInstructions.load(),
          mcp: mcpInstructions.load(permissions),
          entries: entries.load(sessionID),
        },
        { concurrency: "unbounded" },
      )
      return {
        session,
        agent: { ...agent, info: agent.info },
        // Ordered from most to least shared across sessions so the baseline stays a reusable
        // prompt-cache prefix: user-level catalog and guidance, then project instructions, then
        // the date and environment, which vary by day and directory.
        instructions: Instructions.combine([
          CodeModeInstructions.make(loaded.tools.codeModeCatalog),
          loaded.mcp,
          loaded.references,
          loaded.skills,
          loaded.discovery,
          loaded.builtins,
          loaded.entries,
        ]),
        tools: loaded.tools,
      }
```
**File:** packages/core/src/session/context.ts (L163-178)
```typescript
    const load = Effect.fn("SessionContext.load")(function* (selection: Selection) {
      const model = yield* resolveModel(selection.session)
      const history = yield* SessionHistory.entriesForRunner(
        db,
        selection.session.id,
        selection.instructions,
        SessionProviderContext.provenance(model) ?? "local",
      )
      return {
        session: selection.session,
        agent: selection.agent,
        model,
        initial: history.initial,
        messages: history.entries.map((entry) => entry.message),
        tools: selection.tools,
      }
```
**File:** services/www/src/docs/content/instructions.mdx (L63-76)
```text
## Ordering

The selected agent or provider system prompt is sent first. OpenCode then assembles initial instructions in this order:

```text
1. Agent or provider system prompt
2. Code Mode tool guidance, when enabled
3. MCP server, reference, and skill guidance
4. Global and project AGENTS.md files, then configured instructions
5. Built-in date and environment context
6. Session-specific instruction entries supplied through the API
```

These sources are combined rather than used as overrides. Nested `AGENTS.md` files discovered later are added to session history in discovery order.
```
**File:** packages/core/src/session/instruction-state.ts (L38-78)
```typescript
export const commit = Effect.fn("InstructionState.commit")(function* (
  db: DatabaseService,
  bus: Bus.Interface,
  instructions: Instructions.List,
  observation: Observation,
) {
  if (!observation.initial && Object.keys(observation.delta).length === 0) return
  // The rendered text is frozen into the durable event because re-rendering it
  // later would require the original Location-scoped instruction sources.
  const text = observation.initial ? "" : yield* renderUpdateText(db, instructions, observation)
  yield* bus.publish(
    SessionEvent.InstructionsUpdated,
    {
      sessionID: observation.sessionID,
      delta: observation.delta,
      ...(text.length > 0 ? { text } : {}),
    },
    {
      // Initial sync establishes the baseline; unlike later deltas it is not chronological history.
      ...(observation.initial ? { metadata: { instructions: { initial: true } } } : {}),
      commit: () => insertBlobs(db, observation.blobs),
    },
  )
})

const renderUpdateText = Effect.fnUntraced(function* (
  db: DatabaseService,
  instructions: Instructions.List,
  observation: Observation,
) {
  const replaced = Object.entries(observation.previous).filter(([key]) => Object.hasOwn(observation.delta, key))
  const blobs = yield* loadBlobs(
    db,
    replaced.map(([, hash]) => hash),
  )
  const previous = Object.fromEntries(replaced.map(([key, hash]) => [key, requireBlob(blobs, hash)]))
  const admitted = new Map(
    Object.entries(observation.blobs).map(([hash, value]) => [Instructions.Hash.make(hash), value]),
  )
  return Instructions.renderUpdate(instructions, previous, dereferenceDelta(observation.delta, admitted))
})
```
**File:** packages/core/src/session/instruction-state.ts (L173-182)
```typescript
export const initial = Effect.fn("InstructionState.initial")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  instructions: Instructions.List,
) {
  const state = yield* find(db, sessionID)
  if (!state) return yield* Effect.die(new Error(`Instruction state not found during assembly: ${sessionID}`))
  const blobs = yield* loadBlobs(db, Object.values(state.initial_values))
  return Instructions.renderInitial(instructions, dereference(state.initial_values, blobs))
})
```
**File:** packages/core/test/session-runner.test.ts (L392-394)
```typescript
    const referenceInstructions = Layer.mock(ReferenceInstructions.Service, {
      load: () => Effect.succeed(Instructions.empty),
    })
```
## Q3
How do I extend the instructions that being visible to the agent?
### Answer
There are four ways to extend agent-visible instructions, ordered by effort: write `AGENTS.md` files, add entries to the `instructions` config array, write session-scoped instruction entries through the API, or register a new `Instructions` source in `SessionContext.select`. All feed into the combined `Instructions.List` that is rendered into the system context before each model request. opencode:150-158 

---

## 1. `AGENTS.md` files (no code changes)

`ConfigInstructionPlugin` automatically loads a global `AGENTS.md` from the global config dir plus every `AGENTS.md` walking upward from the working directory to the project root. opencode:51-58 opencode:84-94 

Edits while a session runs are picked up by the `Watcher`, debounced, and pushed through `discovery.reload()`, so the next request emits an instruction update — no restart needed. opencode:203-218 opencode:78-97 

## 2. `instructions` array in `opencode.jsonc` (no code changes)

Add file paths, glob patterns, `~/` paths, or HTTP(S) URLs; they load after `AGENTS.md` files in listed order. opencode:101-117 

```jsonc
{ "instructions": ["CONTRIBUTING.md", "docs/guidelines/*.md", "https://example.com/instructions.md"] }
```

`reconfigure` collects these from all config documents, fetches URLs (5s timeout, keeps last-good on failure), and `configuredSource`/`match` resolves globs relative to project root or global config dir. opencode:98-110 opencode:143-171 

## 3. Session-scoped entries via `InstructionEntry.put` (per-session, API)

`InstructionEntry.Service.put` stores a key → JSON value per session; `load` turns each row into an `Instructions` source keyed `api/<key>` that renders as a `<context key="...">` block. opencode:83-104 opencode:134-156 

- Updates render as "The context under X changed and supersedes the previous value", removals as "no longer applies. Disregard it." opencode:95-103 
- These load last in the combine order — session-specific entries sit at the end of the system context. opencode:140-158 

## 4. A new `Instructions` source (code change)

To inject programmatically generated guidance, create an `Instructions.make({...})` with a key, JSON codec, `read` effect, and `render` hooks (`initial`/`changed`/`removed`) — this is the pattern used by `InstructionDiscovery`, `InstructionBuiltIns`, and `InstructionEntry`. opencode:80-90 opencode:24-32 

Then add its `load()` result into the `Instructions.combine` array in `SessionContext.select`; position in the array determines prompt placement. opencode:132-158 

## How values reach the model

Every source is value-based: before each request the runner reads all sources, hashes values, stores blobs, and diffs against `InstructionStateTable`. The baseline renders via `Instructions.renderInitial` into `initial`; later changes render once via `renderUpdate` and freeze into a durable `session.instructions.updated` event that appears as a chronological system message. opencode:90-96 opencode:173-182 opencode:192-216 

```mermaid
graph TD
  "AGENTS.md / config instructions" --> "InstructionDiscovery"
  "API entries" --> "InstructionEntry"
  "custom Instructions.make" --> "SessionContext.select"
  "InstructionDiscovery" --> "SessionContext.select"
  "InstructionEntry" --> "SessionContext.select"
  "SessionContext.select" --> "Instructions.combine"
  "Instructions.combine" --> "InstructionState (diff + blobs)"
  "InstructionState (diff + blobs)" --> "system baseline + update messages"
```

## Notes

- Nested `AGENTS.md` found when tools touch deeper paths is injected as synthetic session messages via `SessionInstructions.load`, not into the baseline — dedup is by path metadata. opencode:46-79 
- Skills (`SKILL.md`) and MCP servers also inject guidance earlier in the ordering, if your extension fits those shapes. opencode:63-76 

Wiki pages you might want to explore:
- [Session Runner & LLM Execution Loop (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.1)
- [Compaction & Context Management (anomalyco/opencode)](/wiki/anomalyco/opencode#2.1.2)
- [Agents, Skills & Commands (anomalyco/opencode)](/wiki/anomalyco/opencode#2.4)
### Citations
**File:** packages/core/src/session/context.ts (L132-158)
```typescript
      const loaded = yield* Effect.all(
        {
          tools: registry.snapshot(permissions),
          builtins: builtins.load(),
          discovery: discovery.load(),
          skills: skillInstructions.load(permissions),
          references: referenceInstructions.load(),
          mcp: mcpInstructions.load(permissions),
          entries: entries.load(sessionID),
        },
        { concurrency: "unbounded" },
      )
      return {
        session,
        agent: { ...agent, info: agent.info },
        // Ordered from most to least shared across sessions so the baseline stays a reusable
        // prompt-cache prefix: user-level catalog and guidance, then project instructions, then
        // the date and environment, which vary by day and directory.
        instructions: Instructions.combine([
          CodeModeInstructions.make(loaded.tools.codeModeCatalog),
          loaded.mcp,
          loaded.references,
          loaded.skills,
          loaded.discovery,
          loaded.builtins,
          loaded.entries,
        ]),
```
**File:** packages/core/src/config/plugin/instruction.ts (L51-58)
```typescript
      const candidates = [
        ...(discovery.global ? [globalFile] : []),
        ...(project
          ? ancestorDirectories(start, stop)
              .map((directory) => join(directory, "AGENTS.md"))
              .filter((file) => discovery.global || file !== globalFile)
          : []),
      ]
```
**File:** packages/core/src/config/plugin/instruction.ts (L84-94)
```typescript
      const projectSource = Effect.fn("ConfigInstructionPlugin.projectSource")(function* () {
        if (!project) return []
        const walked = yield* Effect.forEach(
          yield* fs.up({ targets: ["AGENTS.md"], start, stop, type: "file" }),
          fs.resolve,
        )
        const discovered = new Set(walked.filter((file) => discovery.global || file !== globalFile))
        const files = yield* Effect.forEach(discovered, read, { concurrency: "unbounded" })
        if (files.some((file) => file === undefined)) return Instructions.unavailable
        return files.filter((file) => file instanceof InstructionDiscovery.File)
      })
```
**File:** packages/core/src/config/plugin/instruction.ts (L98-110)
```typescript
      const match = Effect.fn("ConfigInstructionPlugin.match")(function* (source: string) {
        const expanded = source.startsWith("~/") ? path.join(global.home, source.slice(2)) : source
        const options = { absolute: true, include: "file", dot: true } as const
        if (path.isAbsolute(expanded))
          return yield* fs
            .scan(path.basename(expanded), { ...options, cwd: path.dirname(expanded) })
            .pipe(Effect.orElseSucceed(() => [] as string[]))
        if (project) return yield* fs.globUp(expanded, start, root)
        if (!discovery.global) return []
        return yield* fs
          .scan(expanded, { ...options, cwd: global.config })
          .pipe(Effect.orElseSucceed(() => [] as string[]))
      })
```
**File:** packages/core/src/config/plugin/instruction.ts (L143-171)
```typescript
      const reconfigure = Effect.fn("ConfigInstructionPlugin.reconfigure")(
        function* () {
          const entries = yield* config.entries()
          const sources = Array.from(
            new Set(entries.flatMap((entry) => (entry.type === "document" ? (entry.info.instructions ?? []) : []))),
          )
          const fetched = yield* Effect.forEach(
            sources.filter(isUrl),
            (url) =>
              HttpClientRequest.get(url).pipe(
                http.execute,
                Effect.flatMap((response) => response.text),
                Effect.timeout("5 seconds"),
                Effect.map((content) => new InstructionDiscovery.File({ path: url, content })),
                Effect.catchCause((cause) =>
                  Effect.logWarning("failed to fetch instruction url", { url, cause }).pipe(
                    Effect.as(configured.remote.get(url)),
                  ),
                ),
              ),
            { concurrency: 4 },
          )
          configured.sources = sources
          configured.remote = new Map(
            fetched.filter((file) => file !== undefined).map((file) => [file.path, file] as const),
          )
        },
        (effect) => lock.withPermit(effect),
      )
```
**File:** packages/core/src/config/plugin/instruction.ts (L203-218)
```typescript
      // Editor saves arrive as bursts of watcher events; settle before rescanning once. Subscribe
      // before debouncing so no update slips through while the debounce starts its pull.
      const updates = yield* PubSub.subscribe(changes)
      yield* Stream.fromSubscription(updates).pipe(
        Stream.debounce("100 millis"),
        Stream.runForEach((file) => refresh(file).pipe(Effect.andThen(discovery.reload()))),
        Effect.forkScoped({ startImmediately: true }),
      )
      // Subscribe before the first config read so an update in between still triggers a reload.
      yield* ctx.event.subscribe().pipe(
        Stream.filter((event) => event.type === "config.updated"),
        Stream.runForEach(() => reconfigure().pipe(Effect.andThen(refresh()), Effect.andThen(discovery.reload()))),
        Effect.forkScoped({ startImmediately: true }),
      )
      yield* reconfigure()
      yield* refresh()
```
**File:** services/www/src/docs/content/instructions.mdx (L63-76)
```text
## Ordering

The selected agent or provider system prompt is sent first. OpenCode then assembles initial instructions in this order:

```text
1. Agent or provider system prompt
2. Code Mode tool guidance, when enabled
3. MCP server, reference, and skill guidance
4. Global and project AGENTS.md files, then configured instructions
5. Built-in date and environment context
6. Session-specific instruction entries supplied through the API
```

These sources are combined rather than used as overrides. Nested `AGENTS.md` files discovered later are added to session history in discovery order.
```
**File:** services/www/src/docs/content/instructions.mdx (L78-97)
```text
## Updates

Edit a global or upward-discovered `AGENTS.md` while a session is running to update its guidance.

```bash
$ printf '\n- Run the integration suite before committing.\n' >> AGENTS.md
```

Before the next model request, OpenCode detects the change and adds an instruction update before delivering pending input:

```text
AGENTS.md changes
→ instruction update
→ next prompt
```

- Removing every ambient `AGENTS.md` tells the session that the previous ambient instructions no longer apply.
- A temporary read failure preserves the last known instructions instead of treating them as deleted.
- Moving a session retains its instruction state, so guidance at the destination is introduced as an update.
- Committing a session revert clears its instruction state and reloads instructions before the next prompt.
```
**File:** services/www/src/docs/content/instructions.mdx (L101-117)
```text
## Configuration

Use the `instructions` array to add files, glob patterns, or HTTP(S) URLs alongside discovered `AGENTS.md` files:

```jsonc title="opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines/*.md",
    "~/rules/opencode.md",
    "https://example.com/instructions.md",
  ],
}
```

Configured instructions load after `AGENTS.md` files, in the order they are listed. Entries from every config document are combined.
```
**File:** packages/core/src/session/instruction-entry.ts (L83-104)
```typescript
const renderValue = (value: Schema.Json) => (typeof value === "string" ? value : JSON.stringify(value, null, 2))

const renderBlock = (key: Key, value: Schema.Json) =>
  [`<context key="${key}">`, renderValue(value), "</context>"].join("\n")

// Rendering stays mechanism-neutral: the model sees session context, not how
// it was attached. Only chronological updates and removals carry narration.
const source = (entry: Info & { readonly removed: boolean }) =>
  Instructions.make<Schema.Json>({
    key: Instructions.Key.make(`api/${entry.key}`),
    codec: Schema.toCodecJson(Schema.Json),
    read: Effect.succeed(entry.removed ? Instructions.removed : entry.value),
    render: {
      initial: (value) => renderBlock(entry.key, value),
      changed: (_previous, value) =>
        [
          `The context under "${entry.key}" changed and supersedes the previous value:`,
          renderBlock(entry.key, value),
        ].join("\n"),
      removed: () => `The context under "${entry.key}" no longer applies. Disregard it.`,
    },
  })
```
**File:** packages/core/src/session/instruction-entry.ts (L134-156)
```typescript
    const put = Effect.fn("InstructionEntry.put")(function* (input: Parameters<Interface["put"]>[0]) {
      const actualBytes = Buffer.byteLength(JSON.stringify(input.value), "utf8")
      if (actualBytes > MaxValueBytes)
        yield* new ValueTooLargeError({
          actualBytes,
          maxBytes: MaxValueBytes,
          message: `Instruction entry value is ${actualBytes} bytes; the limit is ${MaxValueBytes} bytes`,
        })
      const changed =
        input.value === null
          ? isNotNull(InstructionEntryTable.value)
          : or(isNull(InstructionEntryTable.value), ne(InstructionEntryTable.value, input.value))
      yield* db
        .insert(InstructionEntryTable)
        .values({ session_id: input.sessionID, key: input.key, value: input.value, removed: false })
        .onConflictDoUpdate({
          target: [InstructionEntryTable.session_id, InstructionEntryTable.key],
          set: { value: input.value, removed: false, time_updated: Date.now() },
          setWhere: or(eq(InstructionEntryTable.removed, true), changed),
        })
        .run()
        .pipe(Effect.orDie)
    })
```
**File:** packages/core/src/instruction-discovery.ts (L80-90)
```typescript
      const source = (value: ReadonlyArray<File> | Instructions.Unavailable | Instructions.Removed) =>
        Instructions.make<ReadonlyArray<File>>({
          key,
          codec: Schema.toCodecJson(Files),
          read: Effect.succeed(value),
          render: {
            initial: render,
            changed: renderUpdate,
            removed: () => "Previously loaded instructions no longer apply.",
          },
        })
```
**File:** packages/core/src/instructions/builtins.ts (L24-32)
```typescript
            Instructions.make({
              key: Instructions.Key.make("core/date"),
              codec: Schema.toCodecJson(Schema.String),
              read: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
              render: {
                initial: (date) => `Today's date: ${date}`,
                changed: (_previous, date) => `Today's date is now: ${date}`,
              },
            }),
```
**File:** specs/v2/session.md (L90-96)
```markdown
## Instructions Are Value Deltas

Instruction sync persists content-addressed values and may freeze rendered chronological prose. `session.instructions.updated { delta, text? }` maps each changed source key to a SHA-256 content hash, with the literal `"removed"` for observed absence. Canonical JSON bodies live once in the machine-local `instruction_blob` store. The projected `instruction_state` row supplies current and epoch-initial values during normal boundary processing. The runner explicitly combines built-ins, ambient discovery, selected-agent skill guidance, references, MCP guidance, and API-managed instruction entries. There is no instruction registry.

Before each Physical Attempt that reaches model execution, the runner reads every source concurrently exactly once, hashes encoded values, and admits one delta atomically with its new blobs before input delivery. The initial delta must be complete; it carries no update text. An unavailable source blocks only that initial delta and otherwise silently retains the stored value. Request assembly renders the epoch baseline from stored values. Later changes render once at admission, freeze optional `text` in the durable event, and project that text as a chronological System message; clients display changed keys rather than privileged prose.

An instruction epoch spans completed compactions. `session.compaction.ended` moves the epoch start to its exact sequence, making current values initial, without reading sources or authoring an instruction event. Session movement retains state so destination changes become chronological updates; committed revert retains state unless it removed an instruction update, in which case it clears state so the next boundary establishes a fresh baseline. A fork copies messages only through its selected boundary but adopts the parent's newest instruction values as its baseline. Model selection affects request assembly but is not itself an instruction source.
```
**File:** packages/core/src/session/instruction-state.ts (L173-182)
```typescript
export const initial = Effect.fn("InstructionState.initial")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  instructions: Instructions.List,
) {
  const state = yield* find(db, sessionID)
  if (!state) return yield* Effect.die(new Error(`Instruction state not found during assembly: ${sessionID}`))
  const blobs = yield* loadBlobs(db, Object.values(state.initial_values))
  return Instructions.renderInitial(instructions, dereference(state.initial_values, blobs))
})
```
**File:** packages/core/src/session/instruction-state.ts (L192-216)
```typescript
export const preview = Effect.fn("InstructionState.preview")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  instructions: Instructions.List,
  observed: Instructions.ReadResult,
) {
  const state = yield* find(db, sessionID)
  const result = yield* observeAgainst(observed, state?.current_values)
  const observedBlobs = new Map<Instructions.Hash, Schema.Json>(
    Object.entries(result.blobs).map(([hash, value]) => [Instructions.Hash.make(hash), value]),
  )
  if (!state) {
    const values = dereference(result.current, observedBlobs)
    return { initial: Instructions.renderInitial(instructions, values), update: "" }
  }
  const stored = yield* loadBlobs(db, [...Object.values(state.initial_values), ...Object.values(state.current_values)])
  return {
    initial: Instructions.renderInitial(instructions, dereference(state.initial_values, stored)),
    update: Instructions.renderUpdate(
      instructions,
      dereference(state.current_values, stored),
      dereferenceDelta(result.delta, observedBlobs),
    ),
  }
})
```
**File:** packages/core/src/session/instructions.ts (L46-79)
```typescript
    const load = Effect.fn("SessionInstructions.load")(function* (input: Parameters<Interface["load"]>[0]) {
      const claimed = yield* Ref.modify(inFlight, (map) => {
        const existing = map.get(input.sessionID) ?? new Set<string>()
        const newlyClaimed = input.paths.filter((path) => !existing.has(path))
        if (newlyClaimed.length === 0) return [newlyClaimed, map]
        const next = new Map(map)
        next.set(input.sessionID, new Set([...existing, ...newlyClaimed]))
        return [newlyClaimed, next]
      })
      if (claimed.length === 0) return
      yield* Effect.gen(function* () {
        const alreadyInjected = yield* previouslyInjected(store, input.sessionID)
        const toInject = claimed.filter((path) => !alreadyInjected.has(path))
        if (toInject.length === 0) return
        const files = yield* Effect.forEach(
          toInject,
          (path) =>
            fs
              .readFileStringSafe(path)
              .pipe(Effect.map((content) => (content === undefined ? undefined : { path, content }))),
          { concurrency: "unbounded" },
        )
        const readable = files.filter((file): file is { path: string; content: string } => file !== undefined)
        if (readable.length === 0) return
        // Publish directly rather than through Session.synthetic: a Location-scoped layer
        // cannot depend on Session (it routes through LocationServiceMap, forming a type
        // cycle with this node). The durable publish commits the synthetic and its metadata
        // ledger atomically, so releasing the claim afterwards cannot readmit the paths.
        yield* bus.publish(SessionEvent.Synthetic, {
          sessionID: input.sessionID,
          text: readable.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n"),
          description: `Loaded ${readable.map((file) => describePath(root, file.path)).join(", ")}`,
          metadata: { instruction: { paths: readable.map((file) => file.path) } },
        })
```
## Q4
How do I add session scopped instructions entries from a plugin?
### Answer
You can't reach `InstructionEntry.Service` through the plugin host's session API — the context built in `host.ts` exposes `prompt`, `generate`, `synthetic`, `update`, etc., but no instruction-entry method. opencode:560-594  So from a plugin, you call the experimental HTTP endpoints (via the generated client or raw fetch): `PUT /api/experimental/session/:sessionID/instructions/entries/:key` with `{ value }`, plus `GET`/`DELETE` siblings. opencode:571-630 

---

## The API surface

The session group defines three endpoints, all routed through `sessionLocationMiddleware`: opencode:571-630 

| Operation | Method & path | Semantics |
|---|---|---|
| `entry.list` | `GET /api/experimental/session/:sessionID/instructions/entries` | List `InstructionEntry.Info[]` |
| `entry.put` | `PUT .../entries/:key` body `{ value: Json }` | Attach/replace; errors `404`, `413` |
| `entry.remove` | `DELETE .../entries/:key` | Mark removed; announced at next step boundary |

The server handlers delegate straight to `InstructionEntry.Service`: opencode:543-565 

## Client-side call (from a plugin)

The generated promise client exposes `client.session.instructions.entry.put/remove/list`: opencode:927-961  The Effect client test shows the exact call shape: opencode:93-106 

```ts
await client.session.instructions.entry.put({
  sessionID: "ses_...",
  key: "review-notes",
  value: { text: "Check the diff", priority: 1 },
})
```

## Constraints & rendering

- **Key**: `^[a-z0-9][a-z0-9._-]*$` — slash-free; the server namespaces it as `api/<key>`. opencode:10-13 
- **Value**: any JSON, up to `MaxValueBytes = 256 KiB`; over that you get `ValueTooLargeError` (HTTP 413). opencode:30-40 opencode:2037-2056 
- **Rendering**: values appear to the model as `<context key="...">value</context>` blocks, positioned last in the instruction ordering; changes render as "changed and supersedes", removals as "no longer applies. Disregard it." opencode:83-104 
- **Timing**: `put` only writes the `InstructionEntryTable` row; the diff is observed at the next request boundary and announced as a chronological system message — it does not interrupt a running step. opencode:134-156 
- **Forking**: entries are inherited by forked sessions (removed entries carry over as `removed`). opencode:657-708 

## Notes

- If you only need one-shot visible text (not a durable, updatable context block), `session.synthetic` on the plugin API injects a durable synthetic message — but it won't get the `api/<key>` diff/update lifecycle. opencode:583-583 
- If you're writing a *core* plugin (inside `packages/core`), you can `yield* InstructionEntry.Service` directly and call `put`/`remove` — that's what the HTTP handlers do. opencode:550-556 
- The endpoints are under `/api/experimental/`, so the contract may change; the generated clients track it automatically via codegen from `openapi.json`. opencode:3647-3739 

Wiki pages you might want to explore:
- [Protocol & OpenAPI Contract (anomalyco/opencode)](/wiki/anomalyco/opencode#4.2)
### Citations
**File:** packages/core/src/plugin/host.ts (L560-594)
```typescript
                location:
                  input?.location ??
                  Location.Ref.make({ directory: location.directory, workspaceID: location.workspaceID }),
              }
            : { parentID: input.parentID }),
        }),
      get: (input) => sessions.get(input.sessionID),
      remove: (input) => sessions.remove(input.sessionID),
      switchAgent: sessions.switchAgent,
      switchModel: sessions.switchModel,
      prompt: sessions.prompt,
      generate: (input) => sessions.generate(input).pipe(Effect.map((text) => ({ text }))),
      command: (input) => sessions.command({ ...input, command: input.name }),
      compact: sessions.compact,
      update: Effect.fn(function* (input) {
        yield* sessions.get(input.sessionID)
        if (input.title !== undefined) yield* sessions.rename({ sessionID: input.sessionID, title: input.title })
        if (input.metadata !== undefined)
          yield* sessions.setMetadata({ sessionID: input.sessionID, metadata: input.metadata })
        if (input.permissions !== undefined)
          yield* sessions.setPermissions({ sessionID: input.sessionID, permissions: input.permissions })
      }),
      move: sessions.move,
      synthetic: sessions.synthetic,
      interrupt: (input) =>
        sessions
          .interrupt(input.sessionID, { resume: input.resume })
          .pipe(Effect.map((interrupted) => ({ interrupted }))),
      wait: (input) => sessions.wait(input.sessionID),
      context: (input) => sessions.context(input.sessionID),
    },
  }
  return context
})

```
**File:** packages/protocol/src/groups/session.ts (L571-630)
```typescript
    .add(
      HttpApiEndpoint.get(
        "session.instructions.entry.list",
        "/api/experimental/session/:sessionID/instructions/entries",
        {
          params: { sessionID: Session.ID },
          success: Schema.Struct({ data: Schema.Array(InstructionEntry.Info) }),
          error: SessionNotFoundError,
        },
      )
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.session.instructions.entry.list",
            summary: "List instruction entries",
            description: "List API-managed instruction entries attached to the session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.put(
        "session.instructions.entry.put",
        "/api/experimental/session/:sessionID/instructions/entries/:key",
        {
          params: { sessionID: Session.ID, key: InstructionEntry.Key },
          payload: Schema.Struct({ value: Schema.Json }),
          success: HttpApiSchema.NoContent,
          error: [SessionNotFoundError, InstructionEntry.ValueTooLargeError],
        },
      )
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.session.instructions.entry.put",
            summary: "Put instruction entry",
            description:
              "Attach or replace one durable instruction entry. Changes announce as updates at the next step boundary.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.delete(
        "session.instructions.entry.remove",
        "/api/experimental/session/:sessionID/instructions/entries/:key",
        {
          params: { sessionID: Session.ID, key: InstructionEntry.Key },
          success: HttpApiSchema.NoContent,
          error: SessionNotFoundError,
        },
      )
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "experimental.session.instructions.entry.remove",
            summary: "Remove instruction entry",
            description:
              "Remove one instruction entry; the removal is announced to the model at the next step boundary.",
          }),
        ),
    )
```
**File:** packages/server/src/handlers/session.ts (L543-565)
```typescript
      .handle(
        "session.instructions.entry.list",
        Effect.fn(function* (ctx) {
          const instructions = yield* InstructionEntry.Service
          return { data: yield* instructions.list(ctx.params.sessionID) }
        }),
      )
      .handle(
        "session.instructions.entry.put",
        Effect.fn(function* (ctx) {
          const instructions = yield* InstructionEntry.Service
          yield* instructions.put({ sessionID: ctx.params.sessionID, key: ctx.params.key, value: ctx.payload.value })
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.instructions.entry.remove",
        Effect.fn(function* (ctx) {
          const instructions = yield* InstructionEntry.Service
          yield* instructions.remove({ sessionID: ctx.params.sessionID, key: ctx.params.key })
          return HttpApiSchema.NoContent.make()
        }),
      )
```
**File:** packages/client/src/promise/generated/client.ts (L927-961)
```typescript
      instructions: {
        entry: {
          list: (input: SessionInstructionsEntryListInput, requestOptions?: RequestOptions) =>
            request<{ readonly data: SessionInstructionsEntryListOutput }>(
              {
                method: "GET",
                path: `/api/experimental/session/${encodeURIComponent(input.sessionID)}/instructions/entries`,
                successStatus: 200,
                declaredStatuses: [400, 401, 404],
                empty: false,
              },
              requestOptions,
            ).then((value) => value.data),
          put: (input: SessionInstructionsEntryPutInput, requestOptions?: RequestOptions) =>
            request<SessionInstructionsEntryPutOutput>(
              {
                method: "PUT",
                path: `/api/experimental/session/${encodeURIComponent(input.sessionID)}/instructions/entries/${encodeURIComponent(input.key)}`,
                body: { value: input["value"] },
                successStatus: 204,
                declaredStatuses: [400, 401, 404, 413],
                empty: true,
              },
              requestOptions,
            ),
          remove: (input: SessionInstructionsEntryRemoveInput, requestOptions?: RequestOptions) =>
            request<SessionInstructionsEntryRemoveOutput>(
              {
                method: "DELETE",
                path: `/api/experimental/session/${encodeURIComponent(input.sessionID)}/instructions/entries/${encodeURIComponent(input.key)}`,
                successStatus: 204,
                declaredStatuses: [400, 401, 404],
                empty: true,
              },
              requestOptions,
```
**File:** packages/client/test/effect.test.ts (L93-106)
```typescript
  const result = await Effect.gen(function* () {
    const client = yield* OpenCode.make({ baseUrl: "http://localhost:3000" })
    const listed = yield* client.session.instructions.entry.list({ sessionID: Session.ID.make("ses_test") })
    yield* client.session.instructions.entry.put({
      sessionID: Session.ID.make("ses_test"),
      key: "review-notes",
      value: instructions[0].value,
    })
    yield* client.session.instructions.entry.remove({
      sessionID: Session.ID.make("ses_test"),
      key: "review-notes",
    })
    return listed
  }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient), Effect.runPromise)
```
**File:** packages/schema/src/instruction-entry.ts (L10-13)
```typescript
export const Key = Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9._-]*$/u)).annotate({
  identifier: "InstructionEntry.Key",
  description: "Instruction entry key (lowercase alphanumerics plus . _ -)",
})
```
**File:** packages/schema/src/instruction-entry.ts (L30-40)
```typescript
export const MaxValueBytes = 256 * 1024

export class ValueTooLargeError extends Schema.TaggedError<ValueTooLargeError>()(
  "InstructionEntryValueTooLargeError",
  {
    actualBytes: Schema.Int,
    maxBytes: Schema.Int,
    message: Schema.String,
  },
  { httpApiStatus: 413 },
) {}
```
**File:** packages/core/test/session-runner.test.ts (L2037-2056)
```typescript
  scenario("accepts API instruction entries up to 256 KiB", function* () {
    const entries = yield* InstructionEntry.Service
    const value = "x".repeat(InstructionEntry.MaxValueBytes - 2)

    yield* entries.put({ sessionID, key: "large", value })

    expect(yield* entries.list(sessionID)).toEqual([{ key: "large", value }])
  })

  scenario("rejects API instruction entries larger than 256 KiB", function* () {
    const entries = yield* InstructionEntry.Service

    const exit = yield* entries
      .put({ sessionID, key: "oversized", value: "x".repeat(InstructionEntry.MaxValueBytes) })
      .pipe(Effect.exit)

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(InstructionEntry.ValueTooLargeError)
    expect(yield* entries.list(sessionID)).toEqual([])
  })
```
**File:** packages/core/src/session/instruction-entry.ts (L83-104)
```typescript
const renderValue = (value: Schema.Json) => (typeof value === "string" ? value : JSON.stringify(value, null, 2))

const renderBlock = (key: Key, value: Schema.Json) =>
  [`<context key="${key}">`, renderValue(value), "</context>"].join("\n")

// Rendering stays mechanism-neutral: the model sees session context, not how
// it was attached. Only chronological updates and removals carry narration.
const source = (entry: Info & { readonly removed: boolean }) =>
  Instructions.make<Schema.Json>({
    key: Instructions.Key.make(`api/${entry.key}`),
    codec: Schema.toCodecJson(Schema.Json),
    read: Effect.succeed(entry.removed ? Instructions.removed : entry.value),
    render: {
      initial: (value) => renderBlock(entry.key, value),
      changed: (_previous, value) =>
        [
          `The context under "${entry.key}" changed and supersedes the previous value:`,
          renderBlock(entry.key, value),
        ].join("\n"),
      removed: () => `The context under "${entry.key}" no longer applies. Disregard it.`,
    },
  })
```
**File:** packages/core/src/session/instruction-entry.ts (L134-156)
```typescript
    const put = Effect.fn("InstructionEntry.put")(function* (input: Parameters<Interface["put"]>[0]) {
      const actualBytes = Buffer.byteLength(JSON.stringify(input.value), "utf8")
      if (actualBytes > MaxValueBytes)
        yield* new ValueTooLargeError({
          actualBytes,
          maxBytes: MaxValueBytes,
          message: `Instruction entry value is ${actualBytes} bytes; the limit is ${MaxValueBytes} bytes`,
        })
      const changed =
        input.value === null
          ? isNotNull(InstructionEntryTable.value)
          : or(isNull(InstructionEntryTable.value), ne(InstructionEntryTable.value, input.value))
      yield* db
        .insert(InstructionEntryTable)
        .values({ session_id: input.sessionID, key: input.key, value: input.value, removed: false })
        .onConflictDoUpdate({
          target: [InstructionEntryTable.session_id, InstructionEntryTable.key],
          set: { value: input.value, removed: false, time_updated: Date.now() },
          setWhere: or(eq(InstructionEntryTable.removed, true), changed),
        })
        .run()
        .pipe(Effect.orDie)
    })
```
**File:** packages/core/test/session-create.test.ts (L657-708)
```typescript
  it.effect("inherits instruction entries when forking", () =>
    Effect.gen(function* () {
      const session = yield* Session.Service
      const entries = yield* InstructionEntry.Service
      const bus = yield* Bus.Service
      const { db } = yield* Database.Service
      const parent = yield* session.create({ location })
      yield* session.prompt({ sessionID: parent.id, text: "Fork context", resume: false })
      yield* SessionInbox.promote(db, bus, parent.id, "steer")
      yield* entries.put({ sessionID: parent.id, key: "deploy-target", value: "production" })
      yield* entries.put({ sessionID: parent.id, key: "retired", value: true })
      yield* entries.remove({ sessionID: parent.id, key: "retired" })
      yield* Effect.forEach(
        Array.from({ length: 20 }, (_, index) => index),
        (index) => entries.put({ sessionID: parent.id, key: `entry-${String(index).padStart(2, "0")}`, value: index }),
        { discard: true },
      )

      const forked = yield* session.fork({ sessionID: parent.id })
      const inheritedList = yield* entries.list(forked.id)
      const inheritedValues = yield* entries.load(forked.id).pipe(Effect.flatMap(Instructions.read))

      expect(inheritedList).toHaveLength(21)
      expect(inheritedList).toContainEqual({ key: "deploy-target", value: "production" })
      expect(inheritedValues).toContainEqual({
        key: Instructions.Key.make("api/retired"),
        value: Instructions.removed,
      })

      const recorded = yield* db
        .select()
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, forked.id))
        .get()
        .pipe(Effect.orDie)
      if (!recorded) return yield* Effect.die(new Error("Fork event not found"))
      yield* entries.put({ sessionID: parent.id, key: "deploy-target", value: "staging" })
      yield* entries.put({ sessionID: parent.id, key: "new-parent-entry", value: true })
      yield* bus.remove(forked.id)
      yield* db.delete(SessionTable).where(eq(SessionTable.id, forked.id)).run().pipe(Effect.orDie)
      yield* bus.replay({
        id: recorded.id,
        created: recorded.created,
        aggregateID: recorded.aggregate_id,
        seq: recorded.seq,
        type: recorded.type,
        data: recorded.data,
      })

      expect(yield* entries.list(forked.id)).toEqual(inheritedList)
      expect(yield* entries.load(forked.id).pipe(Effect.flatMap(Instructions.read))).toEqual(inheritedValues)
    }),
```
**File:** packages/protocol/openapi.json (L3647-3739)
```json
    "/api/experimental/session/{sessionID}/instructions/entries/{key}": {
      "put": {
        "tags": ["session"],
        "operationId": "experimental.session.instructions.entry.put",
        "parameters": [
          {
            "name": "sessionID",
            "in": "path",
            "schema": {
              "$ref": "#/components/schemas/Session.ID"
            },
            "required": true
          },
          {
            "name": "key",
            "in": "path",
            "schema": {
              "$ref": "#/components/schemas/InstructionEntry.Key"
            },
            "required": true
          }
        ],
        "security": [],
        "responses": {
          "204": {
            "description": "<No Content>"
          },
          "400": {
            "description": "InvalidRequestError",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InvalidRequestErrorEncoded"
                }
              }
            }
          },
          "401": {
            "description": "UnauthorizedError",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnauthorizedErrorEncoded"
                }
              }
            }
          },
          "404": {
            "description": "SessionNotFoundError | LocationNotFoundError",
            "content": {
              "application/json": {
                "schema": {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/SessionNotFoundErrorEncoded"
                    },
                    {
                      "$ref": "#/components/schemas/LocationNotFoundErrorEncoded"
                    }
                  ]
                }
              }
            }
          },
          "413": {
            "description": "InstructionEntryValueTooLargeError",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InstructionEntryValueTooLargeErrorEncoded"
                }
              }
            }
          }
        },
        "description": "Attach or replace one durable instruction entry. Changes announce as updates at the next step boundary.",
        "summary": "Put instruction entry",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "value": {}
                },
                "required": ["value"],
                "additionalProperties": false
              }
            }
          },
          "required": true
        }
      },
```