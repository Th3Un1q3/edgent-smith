---
id: cases/opencode-plugin-v2-effect-migration
type: cases
L0: "OpenCode v2 plugin migration: quarantine broken plugins; real Effect types imported type-only; send messages via session.prompt(resume:false); tool input field is path"
hotness: 0.8
ttl: 180d
freshness: 2026-10-06
version: 2
directory: cases
provenance: session opencode-plugin-v2-effect-migration
---
#
# OpenCode v2 plugin (Effect) migration - mistakes and fixes

Environment: OpenCode v2.0.23, .opencode/plugins, bun 1.4.2.
Source: observed runtime logs, tsc output, and the installed @opencode/plugin@2.0.24 types.

## M1 Fabricated context types
Mistake: hand-wrote V2 context interfaces (a PluginContext shim). tsc then verified the shim, not the real API, and hid a real bug.
Fix/avoid: import the REAL type - import type { Plugin } from "@opencode/plugin/effect/plugin" - and annotate. Never invent API types.

## M2 All-at-once migration
Mistake: migrated all 9 plugins at once, broke the environment and the quality gates.
Fix/avoid: quarantine broken plugins in .opencode/plugins-quarantine/ (the loader scans only the root of .opencode/plugin and .opencode/plugins, no recursion), then migrate ONE at a time, verify, keep.

## M3 Wrong message method
Mistake: ctx.session.synthetic({sessionID,text}) produces SessionInbox.Synthetic (internal, not shown).
Fix/avoid: ctx.session.prompt({sessionID,text,resume:false}) produces SessionInbox.User (visible) and does not wake the runner - the V2 equivalent of V1 noReply:true. Verify which inbox type a method yields.

## M4 Wrong tool-input guard field
Mistake: read event.input.filePath; V2 tools pass path, so the hook always returned early and injected nothing.
Fix/avoid: read event.input.path ?? filePath. Verify the tool input schema before guarding.

## M5 Runtime effect mismatch
Mistake: runtime-imported @opencode/plugin/effect; its dep @opencode/schema calls Schema.TaggedError, absent from the effect the runtime bundles (4.0.0-beta.13) -> plugin fails to load.
Fix/avoid: type-only import of the native Plugin type plus a plain default export { id, effect }; the loader only reads default.id/effect. Do not runtime-import the plugin package schema modules.

## M6 Duplicate effect versions
Mistake: kept V1 @opencode-ai/plugin (effect beta.83) beside @opencode/plugin (effect rc.112); two Effect types broke tsc with [NodeInspectSymbol] missing.
Fix/avoid: remove @opencode-ai/plugin (unused by compiled code), add @opencode-ai/sdk directly, bun add @opencode/plugin; a single effect version.

## M7 context-gathering gateway misuse
Mistake: called server tools directly through mcp-exec.
Fix/avoid: follow the chain gateway_mcp-find (server keywords) -> gateway_code-mode {name,servers} -> gateway_mcp-exec.

## Native facts
- Package @opencode/plugin@2.0.24, ./effect entry; context has 25 domains; define is identity.
- SessionDomain = Pick<SessionApi, ... prompt ... synthetic ... context>; SessionPromptInput = { sessionID, id?, text, files?, agents?, skills?, metadata?, delivery?, resume? }.
- Effect hooks: callback returns an Effect; registrations are Scope-scoped.
- Loader scans .opencode/plugin and .opencode/plugins ROOT only (no recursion, no .d.ts exclusion).\n## M8 Absolute tool paths vs anchored patterns (live-test catch)\nMistake: matching used event.input.path directly. V2 edit/write pass ABSOLUTE paths; gate patterns are workspace-relative, so anchored patterns never matched and zero gates ran (the plugin loaded but was dead). V1's extractFilePath relativized first; the migration dropped it.\nFix/avoid: relativize tool paths against ctx.location.directory before matching; port V1 normalization steps explicitly; fixtures must use the real absolute-path shape; require a live run.