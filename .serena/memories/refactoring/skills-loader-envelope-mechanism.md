# OpenCode Skills-Loader Envelope Mechanism

How the `skills-loader` plugin passes complete skill XML to recipient sessions without polluting the parent agent prompt: a generic self-closing `<envelope>` placeholder tag in the prompt plus the full payload in an in-memory store, unwrapped by a `chat.message` hook on the recipient side. (Source: current implementation in `.opencode/plugins/skills-loader.ts`, validation reports, operator decisions.)

## Mechanism (current design)

- **Inject side - `tool.execute.before` hook (parent session)**: builds the full `<task_skills>...</task_skills>` payload, stores it via `createEnvelope(payload, metadata)` under a `crypto.randomUUID()` key, and injects ONLY a standalone self-closing tag into the prompt prefix: `<envelope id="<uuid>" description="..."/>` - no `<task_skills>` wrapper.

- **`description` is a constant**: `System-managed envelope; skill content is attached automatically. Do not modify.` A static description cannot be misread by the model as a directive to re-create or echo anything - the previous per-name array template was hallucinated back into prompts as a fake tag. The `allNames`/`escapeAttribute` code was removed; the constant needs no escaping.

- **Generic tag -> multiple envelopes**: skill-agnostic and self-closing, so several envelopes can be placed anywhere in the prompt and unwrapped independently.

- **Idempotency guard (UUID-precise)**: before creating an envelope, test the prompt with the shared UUID-pattern regex - a tag counts only when its id matches the UUID-v4 shape ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}), always crypto.randomUUID() lowercase hex. No prose example (id="...", id="<uuid>") can match. Loose substring detection caused the live failure in mem:troubleshooting/opencode-plugin-live-diagnosis.

- **Unwrap side - `chat.message` hook (recipient session)**: unwraps EACH envelope via the shared UUID-pattern regex (fresh global `RegExp` per part; id must match UUID-v4 shape), calls `resolveEnvelope(key)` (get + delete, one-time, atomic in the event loop), and mutates the part text in place via `part.text` - never `output.parts` reassignment. Outcome per tag: payload replaces it, or it is removed (next bullet).

- **Consumed/unknown/TTL-pruned envelope -> tag REMOVED**: when `resolveEnvelope(id)` returns `undefined` (consumed, TTL-pruned, never existed, hallucinated), the tag is STRIPPED from the part text so the model never sees or re-creates a fake envelope. The warn - `Envelope ${id} not found - removing placeholder.` - remains the only runtime diagnostic signal. This reverses the earlier leave-the-tag-in-place decision (previously considered harmless), per explicit operator request.

## Skill index - shell-based `ls -R`

`buildSkillIndex(name, directory, $)` renders each resolved skill `<skill_index>` payload via the plugin-integrated shell: `($`ls -R .`).cwd(<directory>/.agents/skills/<name>).nothrow().quiet()` - replacing the earlier `readdir` + manual sort + join. The payload is the raw `ls -R` stdout - a nested tree with section headers and bare file names, which reads better in prompts than a flat path list. Non-zero exit (or any throw) falls back to `<skill_index>` wrapping `.agents/skills/<name>/SKILL.md`. The plugin factory destructures `$` from `PluginInput` (`{ client, directory, $ }`).

## Why

The envelope keeps the parent prompt minimal while preserving the exact payload: injecting the COMPLETE skill XML into the task prompt polluted the parent agent context and caused hallucinated re-injection of the skill tag.

## In-memory store decision

The store is a module-scope `Map<string, Envelope>` - NOT disk-backed. Rationale: content lives only briefly between the two same-process hooks (`tool.execute.before` parent, `chat.message` recipient) and is not session-bound. `pruneStaleEnvelopes(maxAgeMs=24h)` bounds growth.

## CRITICAL plugin-API lesson: mutate in place, never reassign

`chat.message` output mutations reach storage and LLM context ONLY via in-place object mutation (`part.text = ...`) - reassigning `output.parts` does NOT propagate. Verified statically against the opencode server binary: after the hook trigger it iterates the same resolved-parts array and persists via `updatePart`/`updateMessage` - reassignment is invisible to it.

## Detection precision - UUID-shaped ids only

Envelope detection uses ONE shared UUID-pattern regex for the idempotency guard, the chat.message pre-guard, the per-part filter, and unwrap (fresh global `RegExp` per part). The id must match the UUID-v4 shape; ids are always `crypto.randomUUID()`. Substring or loose-id detection is fragile: prompts and docs routinely contain literal tag examples. In the live failure a prompt with tag-shaped prose defeated loose detection - the guard skipped creation and the unwrap regex captured the bogus ids, logging false warns (the smoking gun in the runtime log). Regression tests reproduce this: prompt prose with tag-shaped examples must NOT suppress envelope creation, and message prose must NOT trigger unwrap warnings.

## References

- mem:refactoring/plugin-lifecycle - hook phases (chat.message, tool.execute.before); the envelope adds a chat.message unwrap use case
- mem:refactoring/permission-hooks - typed hooks are contracts, not guarantees (prove dispatch before relying)
- mem:refactoring/plugin-imports - import aliases are test-only
- mem:subagent-workflows/prompt-discipline - motivation: oversized skill injection wastes budget
- mem:testing/plugin-mock-patterns - driving plugin hooks in Vitest
- mem:troubleshooting/opencode-plugin-live-diagnosis - the live failure that motivated UUID-precise detection
- mem:architecture/adr/ADR-001-envelope-tag-detection - regex-vs-XML-parser decision (detection pattern unchanged)