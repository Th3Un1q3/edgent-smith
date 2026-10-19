---
id: entities/opencode-plugin/retired-skills-loader
type: entities
L0: "Retired v1 plugin skills-loader: added a skills array to the task tool and wrapped .agents/skills/<name>/SKILL.md payloads in an in-memory envelope tag unwrapped at chat.message."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/skills-loader.ts; git index .opencode/plugins-quarantine/skills-loader.ts
---

# skills-loader (retired OpenCode v1 plugin)

## What it did in v1
Loaded named skills into a `task` subagent prompt, deferring the large payload behind a tiny envelope placeholder that was unwrapped at message time.

## Key behaviours / signals
- `tool.definition`: adds an optional `skills: string[]` property to the `task` tool JSON schema (idempotent).
- `tool.execute.before`: reads `.agents/skills/<name>/SKILL.md` via `Bun.file`; sorts resolved skills by `mtimeMs` ascending; builds a `<task_skills>` payload; stores it in the in-memory envelope store under a `crypto.randomUUID()` key; injects only `<envelope id="<uuid>" description="..."/>`; wraps the prompt in `<user_request>`.
- `chat.message`: unwraps each envelope tag in-place (`part.text` mutation), strips dead/hallucinated tags, and warns when an envelope is not found.
- `ENVELOPE_TAG_PATTERN` is UUID-precise and non-global; a fresh global instance is derived per part to avoid `lastIndex` hazards. Unresolved skills become `<skill ... reference="true">` blocks.

## Dependencies / config
`Bun` file API; helpers `./helpers/envelope-store` (createEnvelope/hasEnvelope/resolveEnvelope), `./helpers/logger`.

## Retirement
Retired; absent from the live `.opencode/plugins/` set. Skill loading is native in v2, so the envelope-injection mechanism is not carried forward; no live plugin replacement identified (UNVERIFIED).

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/skills-loader.ts`; recovered copy at `.tmp/retired-plugins/skills-loader.ts`; test `.opencode/plugins-quarantine/tests/skills-loader.test.ts`.

Source: recovered source `.tmp/retired-plugins/skills-loader.ts`; live plugin set inspected at `.opencode/plugins/`.