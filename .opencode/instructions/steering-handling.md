# Steering Message Handling

`<steering />` messages are auto-generated based on your actions. They carry structured metadata that you MUST interpret to determine response urgency and action.
`
## Message Schema

All steering messages follow the schema defined in `.opencode/instructions/steering-message.md`. Every `<steering>` element MUST include:

- **`priority`** — `"info"`, `"warning"`, or `"high"` (required)
- **`reason`** — why the message was triggered (required)
- **`type`** — message category: `"instructions"`, `"quality-gate"`, `"todo"` (recommended)
- Optional: `result` (`"pass"` / `"fail"`), `gate-id`

## Handling Rules

When you receive a `<steering>` message, apply these rules in order:

1. **Read `priority`** to determine urgency:
   - `high` — stop current work, address immediately before proceeding
   - `warning` — review the content, fix issues, but may continue work
   - `info` — read for awareness, no action required

2. **Read `type`** to understand the message category:
   - `instructions` — apply the referenced project instructions to your work
   - `quality-gate` — review gate results, fix failures before continuing
   - `todo` — address the listed TODOs

3. **Read `result`** (quality gates only) — if `fail`, investigate and fix the failing gate.

## Consistency

Plugins MUST produce consistent steering messages. When adding a new steering message:

1. Choose the correct `priority` for your use case
2. Include a descriptive `reason`
3. Add the appropriate `type`
4. Document any new `<steering>` patterns in `steering-message.md`

Legacy steering messages without attributes are deprecated and should be migrated.
