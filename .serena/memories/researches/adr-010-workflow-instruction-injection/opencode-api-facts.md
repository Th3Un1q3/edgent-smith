---
id: researches/adr-010-workflow-instruction-injection/opencode-api-facts
title: OpenCode plugin instruction injection — file-verified API facts
description: "File-verified OpenCode v2 Effect plugin and v1 SDK facts for conditional instruction injection. Errata: the helper idempotency key is at instruction-context-helper.ts:62, and the v1-hook claim only means those hook names appear in comments."
tags: [opencode, plugin-api, effect, instruction-injection, verified-facts, errata]
domain: researches
source: /workspace/.tmp/adr-workflow-instruction-injection/opencode-api-facts.md
date: 2026-10-19
---

> **Errata 1:** The mirrored helper idempotency key is at plugins/helpers/instruction-context-helper.ts:62; the body's :52 reference is stale.
> **Errata 2:** The zero-v1-hook-names correction means those hook names appear only in comments; it does not show the names are absent from the source files.

# OpenCode plugin instruction-injection: file-verified facts

Independent verification of how an OpenCode plugin injects instructions into a session
conditioned on the available tool set, and how the equivalent runs in this repository today.
Every fact below cites a path; quotes are verbatim from the file at that path.

Versions in force in this workspace:

| Artifact | Path | Version |
|---|---|---|
| Repo plugin deps | `/workspace/.opencode/package.json` | `@opencode-ai/sdk ^1.18.34`, `@opencode/plugin ^2.0.24` |
| Resolved plugin API | `/workspace/.opencode/node_modules/@opencode/plugin/package.json` | `2.0.24` |
| Resolved v1 SDK | `/workspace/.opencode/node_modules/@opencode-ai/sdk/package.json` | `1.18.34` |
| Legacy v1 plugin pkg (nested) | `/workspace/.opencode/.opencode/node_modules/@opencode-ai/plugin/package.json` | `1.18.18` |
| Installed OpenCode runtime | `/home/vscode/.opencode/bin/opencode` (`opencode --version`) | `v2.0.32` |

Exact resolution from `/workspace/.opencode/bun.lock`: `"@opencode/plugin": ["@opencode/plugin@2.0.24", ...]` (L345),
`"@opencode-ai/sdk": ["@opencode-ai/sdk@1.18.34", ...]` (L339).

---

## VERIFIED FACTS

### 1. The repo uses the v2 Effect plugin surface, and the installed package ships both surfaces

**Claim:** `@opencode/plugin@2.0.24` exports two plugin surfaces, and every repo plugin uses the
Effect one.

Verbatim, `/workspace/.opencode/node_modules/@opencode/plugin/package.json`:

```json
"exports": {
  ".": { "import": "./dist/promise/index.js", "types": "./dist/promise/index.d.ts" },
  "./effect": { "import": "./dist/effect/index.js", "types": "./dist/effect/index.d.ts" },
```

- Promise surface, `/workspace/.opencode/node_modules/@opencode/plugin/dist/promise/plugin.d.ts`:
  `export interface Plugin { readonly id: string; readonly setup: (context: Context) => Promise<Cleanup | void> | Cleanup | void; }`
- Effect surface, `/workspace/.opencode/node_modules/@opencode/plugin/dist/effect/plugin.d.ts`:
  `export interface Plugin<R = Scope.Scope> { readonly id: string; readonly effect: (context: Context) => Effect.Effect<void, never, R>; }`

All five repo plugins import the Effect surface (`grep -rn "@opencode/plugin/effect/plugin" .opencode/plugins --include=*.ts`):

- `plugins/workflow.ts:10`, `plugins/quality-gate-enforcer.ts:10`, `plugins/tool-limit-reminder.ts:25`,
  `plugins/goal-continuation.ts:19`, `plugins/instructions-loader.ts:8`.

`@opencode-ai/sdk` (v1) is imported only as a client type in `plugins/helpers/logger.ts:6` and
`plugins/helpers/session-helpers.ts:1`, plus tests. No repo plugin source uses the promise surface.

### 2. The v2 hook set (the API the repo actually uses)

Domain hook/transform surfaces, verbatim from `.../dist/effect/*.d.ts`:

- Tool — `.../effect/tool.d.ts`:
  - `execute.before` input: `{ tool: string; sessionID; agent; messageID; id; input: unknown }` (mutable `tool`, `input`).
  - `execute.after` input: same plus `{ status: "completed"; result } | { status: "error"; error }`.
  - `ToolDomain` also exposes `transform: Transform<ToolEditor>`, `reload()`, and
    `list: () => Effect.Effect<readonly (Tool.Info & { readonly id: string })[]>` with the comment
    `/** Currently registered tools, after every transform, keyed by effective name. */`.
- Session — `.../effect/session.d.ts`: `SessionHooks` keys are `prompt`, `context`, `compaction`,
  `generate`, `title`, `model.request`, `http.request`, `http.response`,
  `experimental.ws.handshake`, `experimental.ws.send`, `experimental.ws.receive`, `retry`.
- Registration — `.../effect/registration.d.ts`:
  `export type Hooks<Spec, ...> = <Name extends keyof Spec>(name: Name, callback: (input: Spec[Name]) => Effect.Effect<void, ...>) => Effect.Effect<Registration, never, Scope.Scope>;`
  and `Transform<Input> = (callback: (input: Input) => void) => Effect.Effect<Registration, never, Scope.Scope>`.

Repo usage confirms the runtime shape: `plugins/instructions-loader.ts:84` (`context.tool.hook('execute.before', ...)`),
`:124` (`context.session.hook('context', ...)`), `plugins/workflow.ts:94` (`context.tool.transform((editor) => { editor.add(...) })`).

### 3. A hook CAN observe the session's available tool set

**Claim:** the `context` session hook receives the effective per-request tool map.

Verbatim, `/workspace/.opencode/node_modules/@opencode/plugin/dist/effect/session.d.ts`:

```ts
export interface SessionContext extends SessionRequest {
    readonly agent: Agent.ID;
    tools: Record<string, {
        description: string;
        input: JsonSchema.JsonSchema;
    }>;
}
```

`SessionHooks.context: SessionContext` (`session.d.ts:129-141`); `tools` is declared at L31.
`SessionCompaction extends SessionContext` and `SessionGenerate extends SessionContext`, so the
map is also present on `compaction`/`generate` hooks. `ToolDomain.list()` (fact 2) is the other
observer, returning the globally registered set.

### 4. The repository's conditional-injection precedent

**Claim:** `plugins/instructions-loader.ts` is the repo's existing "inject instructions gated on tool
use" mechanism, and the instruction source text lives in `.opencode/instructions/*.instructions.md`.

- Gate: `const TARGETED_TOOLS = new Set(['edit', 'write', 'read'])` (`plugins/instructions-loader.ts:14`),
  applied at L85-86: `const filePath = readFilePath(event.input); if (filePath === undefined || !TARGETED_TOOLS.has(event.tool)) return`.
- Source: `createIndex({ agent, instructionsGlob: '.opencode/instructions/*.instructions.md', currentWorkingDirectory: context.location.directory, type: 'custom' })` (L66-70).
- Injection payload: `buildSteeringMessage(blocks)` → `<steering priority="high" reason="relevant files touched" type="instructions">...</steering>` (L55-56), sent via
  `context.session.prompt({ sessionID: event.sessionID, text: message, resume: false })` (L114) and stashed in
  `context.storage.set(pendingKey(...), message)` (L115).
- Actual system-prompt injection happens in `context.session.hook('context', ...)` (L124-129):
  `const pending = ...; if (!pending) return; event.system.push({ type: 'text', text: pending }); yield* context.storage.remove(pendingKey(event.sessionID))`.
- Idempotency keys: `instruction_load:<path>` with `:full` / `:ref` suffixes stored under `idempotency/<sessionID>` (L93-121, mirrored in `plugins/helpers/instruction-context-helper.ts:52`).
- Instruction body files present: 16 files matching `.opencode/instructions/*.instructions.md`
  (e.g. `writing-style.instructions.md`, `serena-gateway.instructions.md`, `harness-verify.instructions.md`).

The `workflow` tool itself is registered by `plugins/workflow.ts` (plugin id `opencode.workflow`,
tool name `workflow`, L92-113) with `description: WORKFLOW_TOOL_DESCRIPTION` (L16-52, L97). It is
the *only* repo plugin that adds the tool; no repo plugin currently gates instruction injection on
it.

### 5. The v1 hook surface exists (legacy nested install) and lacks a tool map

`/workspace/.opencode/.opencode/node_modules/@opencode-ai/plugin` is version `1.18.18` and its
`dist/index.d.ts` declares `export interface Hooks {` (L173) including
`"tool.execute.before"` (L235) and `"experimental.chat.system.transform"?: (input: { sessionID?: string; model: Model }, output: { system: string[] }) => Promise<void>;` (L265).
The system-transform input carries no tool list.

---

## UNVERIFIED / OPEN

1. **Code Mode instruction text provenance.** The fragments `# Code Mode`,
   `core/codemode`, and `No Code Mode tools are currently available` are present in
   `/tmp/opencode/oc-strings.txt` (a 21 MB, non-repo string file). That file also contains 444
   `dsh` and 34 `deepseek` substrings and 803 `opencode` substrings, so calling it "the OpenCode v2
   client string dump" is not established from the artifact. Evidence that would settle it: a
   provenance record for `oc-strings.txt` (which binary/bundle it was dumped from) plus a
   source-level path for the `core/codemode` renderer. Do not assert OpenCode-core ownership until
   then; note also that a *separate* "Code Mode" exists in the DSH plane
   (`/usr/local/share/nvm/versions/node/v24.21.0/lib/node_modules/@deepseek-ai/dsh/config/agent-presets/code/agent.cordis.yml`,
   "the standard coding agent, presented as Code Mode", tool `run_code`).
2. **No repo file stores Code Mode instruction text.** Verified absence in-repo; the only on-disk
   occurrences are the dump above. If the ADR needs Code Mode's exact injection point (system
   prompt vs. instruction pipeline), it must be sourced, not inferred from strings.
3. **Hook ordering across plugins/phases.** The typings give no inter-plugin ordering guarantee for
   `session.hook("context")` callbacks. Evidence that would settle it: `@opencode/client` engine
   source or upstream docs.
4. **Persistence of `system` mutations.** Whether a `context`-hook `system.push` persists across the
   agent loop's turns or is recomputed per request is not stated in the typings.
5. **`tool.list()` vs per-agent filtering.** The typing comment says "Currently registered tools,
   after every transform"; it does not state whether that set is filtered per agent/session. Only
   `SessionContext.tools` is typed as per-request.
6. **Exact `SystemPart` variant for `system.push`.** Repo code uses `{ type: 'text', text }`
   (`instructions-loader.ts:127`); the `SystemPart` type from `@opencode/ai` was not inspected.
7. **Standalone tarball `/tmp/opencode/package`.** Present (package.json exists) but its contents and
   version were not re-read this session.

---

## CORRECTIONS (errors in `opencode-api.md`)

1. **Finding 0 (L32) is refuted.** "its own plugins still use the v1 promise-style hook surface" is
   false. All five repo plugins import `@opencode/plugin/effect/plugin` and use the Effect surface
   (`{ id, effect }` with `context.tool.hook` / `context.session.hook` / `context.tool.transform`);
   zero v1 hook names (`tool.execute.before`, `experimental.chat.system.transform`,
   `chat.message`) appear in any `.opencode/plugins/**/*.ts` source. The promise surface ships
   *inside* `@opencode/plugin@2.0.24` as the default export; the report's clean v1-package /
   v2-package split is wrong.
2. **§7.1 (L472) "Keep the tool description short (as today)" is false.** `WORKFLOW_TOOL_DESCRIPTION`
   is a 36-line array (`plugins/workflow.ts:16-52`) joined into one string and used verbatim as the
   tool description (L97). The workflow description is already long, not short.
3. **§5.1 provenance (L410) is asserted, not shown.** The `core/codemode` evidence rests on
   `/tmp/opencode/oc-strings.txt`, whose OpenCode origin is not established; the file also carries
   DSH/DeepSeek strings (see OPEN item 1). The §5 mechanism claims (injection point, "documented v2
   extension point") are downstream of that unproven attribution.
4. **§3.4 (L196) overstates.** "neither reflects per-agent exposure" for `tool.list()` is not stated
   by the typing; only `SessionContext.tools` is typed as per-request. Mark as unverified rather than
   contrasted as fact.
5. **Variable identifiers in §5.1 renderer quote are not reproducible verbatim.** The report shows
   `var Nf=JT.make("core/codemode")`; the dump fragment reads
   `core/codemode"),Wf=mn(If),Jf=(e)=>{let T=...return Tr({key:Nf,codec:Wf,read:l(T),render:{initial:ud,changed:Lf,removed:()=>"Code Mode tools are no longer available. Do not use any previously liste...`.
   The mechanism is corroborated; the exact identifier assignment is not.
6. **§5.1 config-flag citation (L442) is not re-verified.** `codemode: Schema.Boolean.pipe(optional...)`
   exists in `@opencode/schema/dist/mcp.js`, but the specific promise-generated `types.d.ts` line
   numbers were not re-read; treat the exact locations as unverified.
7. **Cross-file:** `repo-surfaces.md` §6 row 1 attributes hook load-order dependence to
   `.opencode/plugins/AGENTS.md`; that file documents directory layout and quality gates, not
   ordering. Load-order remains OPEN (item 3).

---

## Answers to the two mandated questions

1. **Which hooks/APIs exist in the API version this repo uses, and do v1 and v2 both exist?**
   `@opencode/plugin@2.0.24` (the declared and lock-resolved version) ships two surfaces — the
   default promise surface (`Plugin { id, setup }`, `dist/promise`) and the Effect surface
   (`Plugin { id, effect }`, `@opencode/plugin/effect/plugin`, `dist/effect`), with the legacy
   standalone `@opencode-ai/plugin@1.18.18` also present as a nested install, and every repo plugin
   uses the Effect surface.
2. **Can any hook observe the enabled/available tool set for the current session or agent?**
   Yes — the Effect surface's `session.hook('context', ...)` callback receives `SessionContext`
   whose `tools: Record<string, { description, input }>` is the effective per-request tool map
   (`context.tool.list()` separately exposes the globally registered set), so a plugin can gate
   injection on `'workflow' in event.tools`.