# Business Rules

```yaml
rules:
  - id: BR1.1
    statement: A gate status transition is delivered as a synthetic session message.
    category: policy
    applies_to: GateSignal
    trigger: A gate's status changes between the compared runs
    logic: "IF new status differs from the last known status THEN append one synthetic message."
    violation_behaviour: The agent never learns the gate result.
    source: FR1.1, FR1.2

  - id: BR1.2
    statement: Gate signals do not start a model turn.
    category: constraint
    applies_to: "quality-gate-enforcer delivery path"
    trigger: Any gate signal is produced
    logic: "IF a gate signal is produced THEN deliver it with the synthetic carrier and never with the prompt carrier."
    violation_behaviour: A command result is presented to the model as a human utterance.
    source: FR1.4

  - id: BR1.3
    statement: The signal keeps the existing steering shape and content.
    category: constraint
    applies_to: GateSignal.text
    trigger: A signal is formatted
    logic: "IF a signal is formatted THEN emit one steering block with a header line and one line per gate carrying the check mark, gate name, previous and new status, first command, and exit code; append captured output only when the new status is fail."
    violation_behaviour: The signal loses the information the agent needs or gains per-run noise.
    source: FR1.3

  - id: BR2.1
    statement: A gate is reported only when its status changes.
    category: policy
    applies_to: "gate evaluation"
    trigger: A gate run completes
    logic: "IF new status equals previous status THEN emit no message; OTHERWISE emit exactly one."
    violation_behaviour: Every edit produces a message, including unchanged results.
    source: FR2.1, FR2.2

  - id: BR2.2
    statement: The pre-change pass skips gates whose status is already known.
    category: constraint
    applies_to: "pre-change evaluation"
    trigger: The host fires the pre-change hook
    logic: "IF the session map holds a status for the gate THEN do not run it; OTHERWISE run it and compare against unknown."
    violation_behaviour: Every edit reruns every gate before the change, doubling work.
    source: FR2.3

  - id: BR2.3
    statement: The post-change pass evaluates every matched gate.
    category: constraint
    applies_to: "post-change evaluation"
    trigger: The host fires the post-change hook
    logic: "IF a gate's patterns match the changed path THEN run it and compare with the session map."
    violation_behaviour: A gate that passed before the edit never re-checks the edited file.
    source: FR2.3

  - id: BR3.1
    statement: A tool input yields a file path from path, then filePath.
    category: validation
    applies_to: ToolInput
    trigger: A tool hook reads the input
    logic: "IF path is a non-empty string THEN use it; ELSE IF filePath is a non-empty string THEN use it; ELSE yield no path."
    violation_behaviour: A hook silently skips a file it should have checked.
    source: FR3.1

  - id: BR3.2
    statement: An absolute tool path becomes workspace-relative before matching.
    category: calculation
    applies_to: "path matching"
    trigger: A path is read from the tool input
    logic: "IF the path starts with the workspace directory and a separator THEN strip that prefix; ELSE leave it unchanged."
    violation_behaviour: Configured relative patterns never match absolute tool paths.
    source: FR3.2

  - id: BR3.3
    statement: One shared builder renders every steering block.
    category: constraint
    applies_to: SteeringAttributes
    trigger: An instruction or gate signal is formatted
    logic: "IF a steering block is built THEN pass its attributes and body to the shared builder; the builder defaults to the instruction attributes when none are passed."
    violation_behaviour: Two wrappers drift in attribute order or escaping.
    source: FR3.3

  - id: BR3.4
    statement: Both entry points import the shared helpers; neither keeps a local copy.
    category: policy
    applies_to: "plugin source layout"
    trigger: The plugins are built
    logic: "IF an entry point needs path extraction, relative conversion, or a steering block THEN import it from the shared helper module."
    violation_behaviour: The copies diverge again on the next change.
    source: FR3.4

  - id: BR4.1
    statement: The unused production surface is removed, not retained.
    category: policy
    applies_to: "plugin source and configuration"
    trigger: The change is implemented
    logic: "IF a symbol or setting has no caller THEN remove it together with its test and its configuration key."
    violation_behaviour: Tested-but-dead code suggests behaviour the plugin does not have.
    source: FR4.1, FR4.2, FR4.3, FR4.4

  - id: BR5.1
    statement: A failed synthetic append does not block the tool call.
    category: policy
    applies_to: "signal delivery"
    trigger: The synthetic append rejects or throws
    logic: "IF the append fails THEN log a warning with the failure and continue the tool call."
    violation_behaviour: A messaging failure blocks an edit that already succeeded.
    source: "design decision Q2 (no requirement names it)"

  - id: BR6.1
    statement: A signal carries its gate and transition as metadata.
    category: constraint
    applies_to: GateSignal
    trigger: A signal is appended
    logic: "IF a signal is appended THEN pass the gate name and the transition in metadata and pass no message id."
    violation_behaviour: A reader cannot attribute the signal, or the runtime rejects the append.
    source: FR1.3, design decision Q3

  - id: BR6.2
    statement: Configuration shape is unchanged apart from the removed key.
    category: constraint
    applies_to: "harness configuration"
    trigger: The plugin loads its section
    logic: "IF the configuration carries gate entries THEN keep the plugin id and the gates key; the removed debounce key is no longer read."
    violation_behaviour: Existing configurations fail to load or silently change meaning.
    source: NR1, FR4.3
```

## Rules Summary

| Rule | Category | Statement | Source |
|------|----------|-----------|--------|
| BR1.1 | policy | A status transition is one synthetic message | FR1.1, FR1.2 |
| BR1.2 | constraint | Signals never start a model turn | FR1.4 |
| BR1.3 | constraint | Signal keeps the existing steering shape and content | FR1.3 |
| BR2.1 | policy | Report only on a status change | FR2.1, FR2.2 |
| BR2.2 | constraint | Pre-change pass skips known gates | FR2.3 |
| BR2.3 | constraint | Post-change pass evaluates every matched gate | FR2.3 |
| BR3.1 | validation | Path comes from `path`, then `filePath` | FR3.1 |
| BR3.2 | calculation | Absolute paths become workspace-relative | FR3.2 |
| BR3.3 | constraint | One shared steering builder | FR3.3 |
| BR3.4 | policy | Both entry points import the shared helpers | FR3.4 |
| BR4.1 | policy | Dead surface is removed with its tests and keys | FR4.1–FR4.4 |
| BR5.1 | policy | A failed append warns and continues | design decision |
| BR6.1 | constraint | Metadata carries gate and transition, no id | FR1.3 |
| BR6.2 | constraint | Configuration shape unchanged apart from the removed key | NFR1, FR4.3 |
