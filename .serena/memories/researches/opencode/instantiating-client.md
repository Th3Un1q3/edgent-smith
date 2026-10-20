Short answer: the plugin `Context` doesn't hand you an `OpenCodeClient` — `ctx.session` is the narrower `SessionDomain` from the host, which has no `instructions.entry` methods. [1](#4-0) [2](#4-1)  You either construct the client yourself with `OpenCode.make({ baseUrl, fetch })` inside your plugin's `setup`, or — if you're writing an Effect/core plugin — skip HTTP entirely and `yield* InstructionEntry.Service` directly. [3](#4-2) 

---

## Option A — Promise plugin: build the client in `setup`

`OpenCode.make` is the factory behind the generated promise client; it takes `baseUrl` and optionally a `fetch` implementation. [4](#4-3)  The verbatim pattern, including the `instructions.entry` calls, is in the client test: [3](#4-2) 

```ts
import { OpenCode } from "@opencode/client"
import { define } from "@opencode/plugin"

export default define({
  id: "my-plugin",
  setup: async (ctx) => {
    const client = OpenCode.make({ baseUrl: "http://localhost:PORT" })
    await client.session.instructions.entry.put({
      sessionID: "ses_...",
      key: "deploy-target",
      value: "production",
    })
  },
})
```

The three methods available are `list` / `put` / `remove`, mapped to the experimental endpoints. [5](#4-4) 

**Caveat**: `ctx` does not expose the server's own URL or port, so you must supply `baseUrl` yourself — via `ctx.options`, env vars, or config. [1](#4-0)  For an in-process embedded host, the pattern used by the SDK is a synthetic base URL plus the host's in-process fetch — but `host.fetch` is only reachable where you create the SDK, not inside a plugin's `ctx`. [6](#4-5)  So inside a plugin this only works cleanly if you can close over a `fetch`/`baseUrl` when defining the plugin, e.g. via `instances.configure` or a plugin factory. [7](#4-6) 

## Option B — Effect plugin / core plugin: no client needed

If your plugin runs inside `packages/core` (or as an Effect plugin where you control the layer requirements), the instruction-entry API is a service, not an HTTP call. `InstructionEntry.Service` exposes `put`/`list`/`remove` — this is exactly what the server's HTTP handlers delegate to. [8](#4-7) 

```ts
const entries = yield* InstructionEntry.Service
yield* entries.put({ sessionID, key: "deploy-target", value: "production" })
```

Core plugins access services through `Effect` requirements — see how `OpencodePlugin` declares `HttpClient.HttpClient | Bus.Service | ...` and yields them in `define({ effect })`. [9](#4-8) 

## Option C — Effect client (if you already run Effect code against a remote server)

`OpenCode.make({ baseUrl })` from `@opencode/client/effect` returns an Effect that requires `HttpClient.HttpClient`; the generated wrappers call `raw["session.instructions.entry.put"]` under the hood. [10](#4-9) [11](#4-10) 

## Which to pick

| Situation | Resolution |
|---|---|
| External/remote plugin (JS, HTTP) | `OpenCode.make({ baseUrl })` — Option A |
| Embedded host; you define the plugin | Close over the URL or build the client in `configure`/factory — Option A |
| Core plugin with Effect `ctx` | `yield* InstructionEntry.Service` — Option B (no HTTP round-trip) |
| Effect code talking to a server | `OpenCode.make` from `@opencode/client/effect` — Option C |

## Notes

- `put` returns `void` (HTTP 204); failures surface as declared errors `404`/`413`. [12](#4-11) 
- The embedded test exercises the full path — `opencode.sessions.instructions.entry.put` hitting the real router — confirming the generated client's `session.instructions.entry` is what you want. [13](#4-12) 
- If your constraint is "no known baseUrl at all", `ctx.session.synthetic` on the plugin API is the in-context fallback for injecting session-visible text, though it lacks the durable `api/<key>` entry lifecycle. [14](#4-13) 

Wiki pages you might want to explore:
- [Server, Protocol & Clients (anomalyco/opencode)](/wiki/anomalyco/opencode#4)

### Citations

**File:** packages/plugin/src/promise/plugin.ts (L26-55)
```typescript
export interface Context {
  readonly app: App
  readonly location: Location.Info
  readonly options: PluginOptions
  readonly agent: AgentDomain
  readonly aisdk: AISDKDomain
  readonly command: CommandDomain
  readonly credential: Pick<CredentialApi, "activate">
  readonly event: EventDomain
  readonly experimental: {
    readonly terminal: Pick<OpenCodeClient["experimental"]["persistentPty"], "read">
  }
  readonly integration: IntegrationDomain
  readonly mcp: MCPDomain
  readonly model: ModelDomain
  readonly generate: GenerateApi
  readonly permission: PermissionDomain
  readonly plugin: Pick<PluginApi, "list">
  readonly provider: ProviderDomain
  readonly reference: ReferenceDomain
  readonly rpc: RpcDomain
  readonly session: SessionDomain
  readonly shell: ShellDomain
  readonly skill: SkillDomain
  readonly storage: StorageDomain
  readonly tool: ToolDomain
  readonly vcs: VcsDomain
  readonly websearch: WebSearchDomain
  readonly worktree: WorktreeDomain
}
```

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

**File:** packages/client/test/promise.test.ts (L570-593)
```typescript
test("session instructions methods use the public HTTP contract", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = []
  const instructions = [{ key: "review-notes", value: { text: "Check the diff", priority: 1 } }]
  const client = OpenCode.make({
    baseUrl: "http://localhost:3000",
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      requests.push({
        method: request.method,
        url: request.url,
        body: request.method === "PUT" ? await request.json() : undefined,
      })
      if (request.method === "GET") return Response.json({ data: instructions })
      return new Response(null, { status: 204 })
    },
  })

  const result = await client.session.instructions.entry.list({ sessionID: "ses_test" })
  await client.session.instructions.entry.put({
    sessionID: "ses_test",
    key: "review-notes",
    value: instructions[0].value,
  })
  await client.session.instructions.entry.remove({ sessionID: "ses_test", key: "review-notes" })
```

**File:** packages/client/src/promise/generated/client.ts (L872-964)
```typescript
            path: `/api/session/${encodeURIComponent(input.sessionID)}/context`,
            successStatus: 200,
            declaredStatuses: [400, 401, 404, 500],
            empty: false,
          },
          requestOptions,
        ).then((value) => value.data),
      diff: (input: SessionDiffInput, requestOptions?: RequestOptions) =>
        request<{ readonly data: SessionDiffOutput }>(
          {
            method: "GET",
            path: `/api/session/${encodeURIComponent(input.sessionID)}/diff`,
            query: { from: input["from"], to: input["to"], context: input["context"] },
            successStatus: 200,
            declaredStatuses: [400, 401, 404, 500],
            empty: false,
          },
          requestOptions,
        ).then((value) => value.data),
      inbox: {
        list: (input: SessionInboxListInput, requestOptions?: RequestOptions) =>
          request<{ readonly data: SessionInboxListOutput }>(
            {
              method: "GET",
              path: `/api/session/${encodeURIComponent(input.sessionID)}/inbox`,
              successStatus: 200,
              declaredStatuses: [400, 401, 404],
              empty: false,
            },
            requestOptions,
          ).then((value) => value.data),
        cancel: (input: SessionInboxCancelInput, requestOptions?: RequestOptions) =>
          request<SessionInboxCancelOutput>(
            {
              method: "DELETE",
              path: `/api/session/${encodeURIComponent(input.sessionID)}/inbox/${encodeURIComponent(input.inboxID)}`,
              successStatus: 204,
              declaredStatuses: [400, 401, 404],
              empty: true,
            },
            requestOptions,
          ),
        update: (input: SessionInboxUpdateInput, requestOptions?: RequestOptions) =>
          request<SessionInboxUpdateOutput>(
            {
              method: "PATCH",
              path: `/api/session/${encodeURIComponent(input.sessionID)}/inbox/${encodeURIComponent(input.inboxID)}`,
              body: { delivery: input["delivery"] },
              successStatus: 204,
              declaredStatuses: [400, 401, 404, 409],
              empty: true,
            },
            requestOptions,
          ),
      },
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
            ),
        },
      },
```

**File:** packages/sdk/src/promise.ts (L56-60)
```typescript
  const client = OpenCode.make({ baseUrl: "http://opencode.local", fetch: host.fetch })
  const register = async (plugin: Plugin.Plugin) => {
    const { PluginPromise } = await import("@opencode/core/plugin/promise")
    return host.runtime.runPromise(host.plugins.register(PluginPromise.fromPromise(plugin)))
  }
```

**File:** packages/sdk/README.md (L61-68)
```markdown
`threads` and `slackPlugin` are application-owned modules. `key` is synchronous and should only select identity, not initialize plugins. `configure` returns plugin definitions; their setup receives the selected instance's `ctx.location`.

- The same key and Location share one live instance. Different directories or workspace IDs always select separate instances, even with the same application key.
- `configure` runs on a cache miss, not on each prompt. Loaded instances live until the host closes; change the application key or restart the host to reconstruct their birth configuration. Plugin transforms and reloads remain available within that lifetime.
- Session metadata, message, inbox, and context reads do not initialize plugins; permission and form lists read instance services and therefore acquire the Session's instance. Configuration failure or a supplied plugin reported as failed after activation, including initial setup failure or an ID that collides with a host `plugins` entry (the host plugin keeps the ID), prevents capability acquisition, without falling back to another instance. A subsequent request can retry a failed construction.
- Existing HTTP prompt middleware also acquires capabilities for an idempotent retry. After restart, that retry can reconstruct plugins before returning the original admission; prompt preparation and hooks do not rerun. Configuration failure can therefore block the retry even when its input was already saved.
- Instance selection is not an authorization or storage-isolation boundary. Plugin Session APIs and the existing plugin-ID-based durable storage retain their normal scope.
- Omitting `instances` preserves default Location sharing. Host-wide plugins remain separate from Session-selected configuration; retain host-wide catalog policy when locationless generation needs it.
```

**File:** packages/core/src/plugin/provider/opencode.ts (L185-194)
```typescript
export const OpencodePlugin = define<HttpClient.HttpClient | Bus.Service | ManagedPolicy.Service | Scope.Scope>({
  id: "opencode.provider.opencode",
  effect: Effect.fn(function* (ctx) {
    const bus = yield* Bus.Service
    const client = yield* HttpClient.HttpClient
    // Every request here goes to the Console, which reads the User-Agent to tell which OpenCode a member runs
    // and whether it evaluates the policies it is being sent.
    const http = HttpClient.mapRequest(client, HttpClientRequest.setHeader("User-Agent", App.useragent(ctx.app)))
    const managed = yield* ManagedPolicy.Service
    const scope = yield* Scope.Scope
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

**File:** packages/client/src/effect/generated/client.ts (L669-684)
```typescript
const EndpointSessionInstructionsEntryPut =
  (raw: RawClient["server.session"]) => (input: SessionInstructionsEntryPutInput) =>
    preserveEffect<SessionInstructionsEntryPutOutput>()(
      raw["session.instructions.entry.put"]({
        params: { sessionID: input["sessionID"], key: input["key"] },
        payload: { value: input["value"] },
      }).pipe(Effect.mapError(mapClientError)),
    )

const EndpointSessionInstructionsEntryRemove =
  (raw: RawClient["server.session"]) => (input: SessionInstructionsEntryRemoveInput) =>
    preserveEffect<SessionInstructionsEntryRemoveOutput>()(
      raw["session.instructions.entry.remove"]({ params: { sessionID: input["sessionID"], key: input["key"] } }).pipe(
        Effect.mapError(mapClientError),
      ),
    )
```

**File:** packages/protocol/src/groups/session.ts (L590-630)
```typescript
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

**File:** packages/sdk/test/embedded.test.ts (L226-230)
```typescript
        yield* opencode.sessions.instructions.entry.put({ sessionID: id, key: "deploy-target", value: "production" })
        yield* opencode.sessions.instructions.entry.put({ sessionID: id, key: "flags", value: { beta: true } })
        const contextEntries = yield* opencode.sessions.instructions.entry.list({ sessionID: id })
        yield* opencode.sessions.instructions.entry.remove({ sessionID: id, key: "flags" })
        const remainingContextEntries = yield* opencode.sessions.instructions.entry.list({ sessionID: id })
```
