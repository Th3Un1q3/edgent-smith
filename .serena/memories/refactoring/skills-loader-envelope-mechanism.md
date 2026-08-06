# OpenCode Skills-Loader Envelope Mechanism

How the `skills-loader` plugin passes complete skill XML to recipient sessions without polluting the parent agent's prompt: a generic self-closing `<envelope>` placeholder tag in the prompt plus the full payload in an in-memory store, unwrapped by a `chat.message` hook on the recipient side. (Source: implementation and validation subagent reports for the mechanism; the generic-tag redesign is the operator's design decision, applied per the operator's FIXME — operator wins over the earlier `<skill_envelope>` format.)

## Mechanism (current design)

- **Inject side — `tool.execute.before` hook (parent session)**: builds the full `<task_skills>...</task_skills>` payload, stores it via `createEnvelope(payload, metadata)` in the in-memory envelope store under a `crypto.randomUUID()` key, and injects ONLY a standalone self-closing tag into the prompt prefix: `<envelope id="<uuid>" description="..."/>` — no `<task_skills>` wrapper in the prompt.
- **`description` attribute**: `Skills specified by skills array: ['skill-a', 'skill-b']. Subagent will unpack full skills content.` (operator's exact template) — lets the parent agent orient and prevents hallucinated re-injection of full skill content. XML-attribute escaping applies: `&`→`&amp;`, `"`→`&quot;`, `'`→`&apos;`.
- **Generic tag → multiple envelopes**: the tag is skill-agnostic and self-closing, so several envelopes can be placed anywhere in the prompt; each is unwrapped independently.
- **Idempotency guard (UUID-precise)**: before creating an envelope, test the prompt with the shared UUID-pattern regex - a tag counts as present only when its id matches the UUID-v4 shape ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}), always crypto.randomUUID() lowercase hex. Every real tag matches; no prose example (id="...", id="<uuid>", any non-UUID id) can. Loose substring detection here caused the live failure documented in mem:troubleshooting/opencode-plugin-live-diagnosis.
- **Unwrap side — `chat.message` hook (recipient session)**: unwraps EACH envelope via the shared UUID-pattern regex (fresh `new RegExp(source, 'g')` per part - the id must match the UUID-v4 shape, see Detection precision below), calls `resolveEnvelope(key)` (get + delete, one-time, atomic in the event loop), and replaces the tag with the payload in-place via `part.text` mutation — never `output.parts` reassignment.
- **Consumed/unknown key**: the tag is left in place and a warn is logged — the placeholder carries no usable skill content, so a re-echoed tag is harmless by design.

## Why

Injecting the COMPLETE skill XML into the task prompt polluted the parent agent's context and caused hallucinated re-injection of the skill tag. The envelope keeps the parent prompt minimal while preserving the exact payload for the recipient.

## In-memory store decision

The store is a module-scope `Map<string, Envelope>` — NOT disk-backed. Rationale: content lives only briefly between `tool.execute.before` (parent session) and `chat.message` (recipient session), both hooks run in the SAME opencode server process, and the content is not session-bound. `pruneStaleEnvelopes(maxAgeMs=24h)` bounds growth.

## CRITICAL plugin-API lesson: mutate in place, never reassign

`chat.message` output mutations reach storage and LLM context ONLY via in-place object mutation (`part.text = ...`). Reassigning the `output.parts` array does NOT propagate. Verified statically against the opencode server binary (not shipped as readable source): after the `chat.message` hook trigger, the server iterates the same resolved-parts array and persists via `updatePart`/`updateMessage` — array reassignment is invisible to the server.

## Detection precision - UUID-shaped ids only

Envelope detection uses ONE shared UUID-pattern regex for the idempotency guard (`.test`), the chat.message pre-guard, the per-part filter, and unwrap (`new RegExp(source, 'g')` fresh per part). The id must match the UUID-v4 shape; ids are always `crypto.randomUUID()`. Substring or loose-id detection (`'<envelope '` includes, `id="([^"]+)"`) is fragile: agent prompts and docs frequently contain literal examples of the very tags you detect. In the live failure the test prompt itself explained the mechanism and contained `<envelope id="..." .../>` and `<envelope id="<uuid>" .../>` prose - the loose guard skipped creation and the loose unwrap regex captured the literal bogus ids and logged false warns (the smoking gun in the runtime log). Regression tests reproduce this exact shape: prompt prose containing tag-shaped examples must NOT suppress envelope creation, and message prose must NOT trigger unwrap warnings.

## References

- mem:refactoring/plugin-lifecycle — hook phases (chat.message, tool.execute.before); the envelope adds a chat.message unwrap use case
- mem:refactoring/permission-hooks — typed hooks are contracts, not guarantees (prove dispatch before relying)
- mem:refactoring/plugin-imports — import aliases are test-only
- mem:subagent-workflows/prompt-discipline — motivation: oversized skill injection wastes budget
- mem:testing/plugin-mock-patterns — driving plugin hooks in Vitest