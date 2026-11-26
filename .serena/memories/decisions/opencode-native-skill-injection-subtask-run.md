---
id: decisions/opencode-native-skill-injection-subtask-run
type: claims
status: active
L0: "subtask_run skill injection is native: the tool takes names, the workflow resolves ids, and client-adapter attaches them to the child prompt; the text-envelope builder is deleted."
hotness: 0.7
freshness: 2026-11-26
ttl: 180d
provenance: .opencode/plugins/workflow/subtask-skills.ts, .opencode/plugins/workflow/client-adapter.ts, .opencode/plugins/workflow/subtask-turn.ts
---
# Verdict
`subtask_run` injects skills natively. The `skills` string array stays on the tool input (schema in `.opencode/plugins/workflow.ts`), and no plugin code reads a SKILL.md to build prompt text.

# Route
- `resolveSkillIds` (`.opencode/plugins/workflow/subtask-skills.ts`) lists native skills through the service client and resolves each input name to a skill id. An unknown name is skipped with the existing `skill not found: <name>` log; a name failing `^[a-z0-9][a-z0-9_-]*$` is dropped; a failed list passes pattern-valid names through instead of dropping them.
- The resolved ids ride the child prompt body; `skillAttachments` (`.opencode/plugins/workflow/client-adapter.ts`) converts them to `{ skills: [{ id }] }` on `session.prompt`, and omits the key entirely when the list is empty, so a skill-less call stays as it was.

# Why the alternatives lost
- `session.skill` cannot carry the turn: it takes no text or agent, returns void, and fixes no ordering against the prompt.
- The plugin-API `session.prompt` without attachments loses the assistant reply the turn needs.

# Why the harness expands an attached id
In the installed binary at `/home/vscode/.opencode/bin/opencode`, `SessionPrompt.prepare` clones the prompt input skills array onto the outgoing user message; each attachment id is resolved through the host Skill service — a class registered as `"@opencode/Skill"` holding a Map, whose `get` performs a normalized-id lookup and raises `Session.SkillNotFoundError` for an unresolved id — and the resolved record is rendered by a function emitting a literal `<skill_content name="...">` block, with the rendered text stored per attachment on the persisted user message. A live dispatch in this repo received a `<skill_content name="context-gathering">` block for the skill it was dispatched with. The attachment therefore is the whole injection mechanism.

# Removed
The text-envelope builder and its frontmatter, description, and relative-path helpers — 22 symbols — plus their re-exports. No `.opencode/plugins` file builds a `<skill_content>` string now.

# Residual risk
Attachment is first-prompt-only: the attempt's first prompt carries the ids, and the in-attempt retry carries none, because the retry rides the first prompt's message, the session already holds that content, and the host re-renders every attachment. A new attempt, including a resumed subtask, re-attaches on its first prompt. A retry therefore inherits the set the attempt started with and can neither add nor drop a skill.

Source: the three plugin files above; harness rendering verified in the installed binary at `/home/vscode/.opencode/bin/opencode`.