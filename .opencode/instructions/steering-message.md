# Steering Message System

`<steering />` messages are auto-generated. They carry structured metadata that the agent MUST interpret to determine response urgency and action.

## Schema

| Attribute | Required | Values | Description |
|-----------|----------|--------|-------------|
| `priority` | Yes | `"info"`, `"warning"`, `"high"` | How urgently the agent must respond |
| `reason` | Yes | descriptive string | Why the message was triggered (e.g., `"relevant files touched"`, `"ran quality checks on files changed since last check"`) |
| `type` | No | `"instructions"`, `"quality-gate"`, `"todo"` | Message category for routing/handling |
| `result` | No | `"pass"`, `"fail"` | Quality gate results only |
| `gate-id` | No | string | Identifier of a specific quality gate |

## Handling Rules (Agent)

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

## Existing Usage

### Instructions Loader
```xml
<steering priority="high" reason="relevant files touched" type="instructions">
  <instruction>
    <description>...</description>
    <path>...</path>
    <content>...</content>
  </instruction>
</steering>
```
> File-visit instructions are delivered as **one appended synthetic message per visit** (`context.session.synthetic`), with no re-delivery for a repeated path. The correlation key is `instruction_load:<path>` in `metadata` (the `id` field is omitted — `SessionMessage.ID` requires a `msg_` prefix, so a correlation key cannot be carried there; the runtime generates the id), the loader enforces it through its session token map, the path is carried in `description`, and an appended message is final — there is no edit or removal path, so the size and budget limits must be satisfied before the append.

### Quality Gate Enforcer
```xml
<steering priority="warning" reason="ran quality checks on files changed since last check" result="fail">
  Quality gate results (0 passed, 1 failed):
  ✗ lint: pass → fail — `just lint` (exit 1):
  error output here
</steering>
```

## Adding a New Steer Message

Plugins MUST produce consistent steering messages. When adding a new steering message:

1. Choose the correct `priority` for your use case
2. Include a descriptive `reason`
3. Add the appropriate `type`
4. Deliver steering through `context.session.synthetic(...)` — never `event.system` and never `session.prompt`; the append is the only delivery path for steering, so the author steps must name it
5. Document any new `<steering>` patterns in this file

Legacy steering messages without attributes are deprecated and must be migrated.
