# Steering Message System

All plugins that send `<steering>` messages to the agent MUST follow this schema.

## Attributes

| Attribute | Required | Values | Description |
|-----------|----------|--------|-------------|
| `priority` | Yes | `"info"`, `"warning"`, `"high"` | How urgently the agent should respond |
| `reason` | Yes | descriptive string | Why the message was triggered (e.g., `"relevant files touched"`, `"quiet period ended; ran dirty quality gates"`) |
| `type` | No | `"instructions"`, `"quality-gate"`, `"todo"` | Message category for routing/handling |
| `result` | No | `"pass"`, `"fail"` | For quality gate results only |
| `gate-id` | No | string | Identifier of a specific quality gate |

## Handling Rules

When the agent receives a `<steering>` message, it SHOULD:

1. **Check `priority`** to determine response urgency:
   - `high` — must be addressed before proceeding
   - `warning` — review and correct but may proceed
   - `info` — informational only, no action required

2. **Check `type`** to determine how to process:
   - `instructions` — read and apply the referenced instructions
   - `quality-gate` — review gate results, fix failures
   - `todo` — address the listed TODOs

3. **Check `result`** (quality gates) — if `fail`, investigate and fix before continuing.

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

### Quality Gate Enforcer
```xml
<steering priority="warning" reason="quiet period ended; ran dirty quality gates" result="fail">
  Quality gate results (0 passed, 1 failed):
  ✗ lint: pass → fail — `just lint` (exit 1):
  error output here
</steering>
```

### Legacy (deprecated)
```xml
<!-- Old format — should be migrated -->
<steering reason="Relevant files touched">...</steering>
```

## Adding a New Steer Message

1. Choose the right `priority` for your use case
2. Include `reason` describing what triggered the message
3. Add `type` for routing
4. Follow the established XML inner structure for your message type
