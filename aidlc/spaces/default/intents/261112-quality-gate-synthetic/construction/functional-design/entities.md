# Entities

The entity set below is derived from the functional requirements in `aidlc/spaces/default/intents/261112-quality-gate-synthetic/inception/requirements-analysis/requirements.md` (FR1–FR4), with each value object existing to make one requirement's behaviour checkable.

```yaml
entities:
  - name: ToolInput
    description: The arguments a tool call carries, read only for the target file path.
    attributes:
      - name: path
        type: string?
        required: false
        constraints: "preferred key; non-empty string"
      - name: filePath
        type: string?
        required: false
        constraints: "fallback key; non-empty string"
    constraints:
      - "A value that is absent, not a string, or empty yields no path."

  - name: GateConfig
    description: One configured quality gate, read from the harness configuration section.
    attributes:
      - name: name
        type: string
        required: true
        unique: true
      - name: patterns
        type: string[]
        required: true
        constraints: "workspace-relative glob patterns; a gate matches when any pattern matches"
      - name: commands
        type: string[]
        required: true
        constraints: "first command is the one named in the signal"
      - name: timeoutMs
        type: number?
        required: false
        constraints: "greater than zero; applied per command"
    constraints:
      - "A gate is identified by its name across sessions."

  - name: GateStatus
    description: The last known result of a gate in one session.
    values: [unknown, pass, fail]

  - name: GateExecution
    description: The result of running one gate's commands once.
    attributes:
      - name: gate
        type: GateConfig
        required: true
      - name: previousStatus
        type: GateStatus
        required: true
      - name: newStatus
        type: GateStatus
        required: true
      - name: exitCode
        type: number
        required: true
      - name: stdout
        type: string
        required: true
      - name: stderr
        type: string
        required: true
    constraints:
      - "newStatus is pass when exitCode is zero, fail otherwise."

  - name: SessionGateStatusMap
    description: The per-session record of each gate's last known status.
    attributes:
      - name: sessionId
        type: string
        required: true
        unique: true
      - name: statuses
        type: "Record<string, GateStatus>"
        required: true
    constraints:
      - "One map per session; a gate absent from the map is unknown."

  - name: SteeringAttributes
    description: The attributes that open a steering message, shared by instruction and gate signals.
    attributes:
      - name: priority
        type: "info | warning | high"
        required: true
      - name: reason
        type: string
        required: true
      - name: type
        type: "instructions | quality-gate | todo"
        required: true
      - name: result
        type: "pass | fail?"
        required: false
      - name: gateId
        type: string?
        required: false
    constraints:
      - "result and gateId are emitted only when present."

  - name: GateSignal
    description: The synthetic message a gate transition produces.
    attributes:
      - name: text
        type: string
        required: true
        constraints: "one steering block with a header line and one line per transition"
      - name: gateName
        type: string
        required: true
      - name: previousStatus
        type: GateStatus
        required: true
      - name: newStatus
        type: GateStatus
        required: true
    constraints:
      - "Exactly one signal is emitted per status transition."
      - "The signal's metadata carries the gate name and the transition, never a message id."

relationships:
  - from: GateExecution
    to: GateConfig
    cardinality: "many-to-one"
    direction: "execution references its gate"
  - from: SessionGateStatusMap
    to: GateStatus
    cardinality: "one-to-many"
    direction: "map holds one status per gate name"
  - from: GateSignal
    to: GateExecution
    cardinality: "one-to-one"
    direction: "a signal is produced by one transition"
```

The entity set is the plugin's working vocabulary rather than a persistence model: a tool input yields a path, the path selects gate configurations, a gate run produces an execution whose status is compared with the session's last known status, and a transition becomes one signal. `ToolInput` and `SteeringAttributes` are value objects — they have no identity of their own. `SessionGateStatusMap` is the only state that survives a tool call, and it is keyed by session rather than by gate.
