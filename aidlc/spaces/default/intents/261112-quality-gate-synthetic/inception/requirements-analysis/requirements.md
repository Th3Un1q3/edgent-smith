# Requirements

## Intent Analysis

The quality-gate-enforcer plugin reports gate results by calling `session.prompt({ resume: false })`. That call starts a model turn, so a signal about a command's exit status is delivered as if a person had spoken. Every other signalling plugin in this repository uses the synthetic carrier instead, and the knowledge base records the split as an inconsistency and a design defect (`codekb/workspace/architecture.md`, Improvement Opportunities; `codekb/workspace/business-overview.md`, Success Measures).

This change makes the gate enforcer deliver its signals the same way instructions-loader does, and pays down the duplication that made the two plugins diverge: shared path helpers and a shared steering-message builder, plus removal of dead code the scan found. The goal is one carrier contract for plugin signals, a smaller plugin body, and no change to which gates run or what they check.

## Functional Requirements

### FR1 — Synthetic delivery for every gate signal

The system shall deliver gate signals as synthetic messages appended to the session, never as model turns.

- FR1.1 The pre-change gate evaluation result shall be delivered with `session.synthetic` and shall not call `session.prompt`.
- FR1.2 The post-change status-transition result shall be delivered with `session.synthetic` and shall not call `session.prompt`.
- FR1.3 The synthetic payload shall keep the existing `<steering>` message shape: the gate name, the status transition, and the captured command output.
- FR1.4 A gate signal shall not depend on, or trigger, a model turn.

Acceptance criteria: with a gate whose status changes, the session message log contains one synthetic entry and no prompt entry; with no status change, it contains neither.

### FR2 — Status-diff reporting preserved

The system shall report a gate only when its status changes.

- FR2.1 Exactly one synthetic message shall be appended per status transition (`unknown` to `pass` or `fail`, and `pass` to `fail` or `fail` to `pass`).
- FR2.2 No synthetic message shall be appended when a gate's status is unchanged.
- FR2.3 The pre-change pass shall keep skipping any gate whose status is already known for the session.

Acceptance criteria: the first run of a failing gate appends one message; an immediate re-run appends none; a later passing run appends one.

### FR3 — Shared helper consolidation

The system shall provide the duplicated helpers once and use them from both plugins.

- FR3.1 A single shared helper module shall extract a file path from a tool input, accepting both `path` and `filePath`.
- FR3.2 A single shared helper shall convert an absolute tool path to a workspace-relative path.
- FR3.3 A single shared helper shall build the `<steering>` message from gate results.
- FR3.4 The quality-gate-enforcer and instructions-loader shall import these helpers; their local copies shall be removed.

Acceptance criteria: neither entry point defines its own path extraction, relative-path conversion, or steering builder; both plugins import the same module paths.

### FR4 — Dead code and unused configuration removed

The system shall remove the production surface that nothing calls.

- FR4.1 The unused debounce batcher shall be removed.
- FR4.2 The unused single-gate formatter shall be removed.
- FR4.3 The `debounceMs` setting and its type shall be removed from the harness configuration.
- FR4.4 The two unused status types shall be removed, and their tests and configuration entries deleted or re-pointed.

Acceptance criteria: no production import or configuration key references the removed symbols, and the plugin package still typechecks.

### FR5 — Tests aligned with the carrier contract

The system shall prove the new delivery path with the existing test harness.

- FR5.1 Gate tests shall assert on captured synthetic messages instead of captured prompts.
- FR5.2 Tests shall cover pre-change delivery, post-change delivery, status-diff suppression, and the shared-helper imports.
- FR5.3 `just test`, `just lint`, and `just typecheck` shall pass for the plugin package.

## Non-Functional Requirements

- NFR1 **Behavioural fidelity**: gate selection, command execution, exit-code-to-status mapping, and timeouts shall not change; the same file and gate configuration produces the same pass/fail result as before.
- NFR2 **Type safety**: the change shall introduce no new `any` or unchecked cast; the package shall keep typechecking against the installed OpenCode v2 plugin types.
- NFR3 **Cost and latency**: a synthetic append shall add no model call and no additional gate execution beyond the runs the status-diff rule already requires.
- NFR4 **Quality floors**: plugin test coverage shall stay at or above the existing 90% threshold and the mutation score at or above its configured break threshold; no threshold shall be lowered (`scripts/verify_thresholds.sh`).

## Constraints

- **C1** The plugin id `opencode.quality-gate-enforcer` and its configuration section key shall not change, so existing harness configuration keeps loading.
- **C2** Shared helpers shall live under `.opencode/plugins/helpers/`; helpers shall not import an entry point, and plugin source shall use relative imports because the runtime does not resolve path aliases.
- **C3** Only the OpenCode v2 synthetic carrier shall be used for signals; the native carrier behaviour of instructions-loader is out of scope.
- **C4** Tests, lint, and typecheck shall run through the repository's `just` recipes, and the change shall follow the no-`src/` and command-layer rules recorded in `project.md`.

## Assumptions

- **A1** `context.session.synthetic` is available to every plugin in the running OpenCode v2 host, as instructions-loader already relies on it.
- **A2** A synthetic append becomes visible at the next request boundary rather than inside the tool call that wrote it; the gate signal is therefore advisory to the following model turn, not to the current one.
- **A3** The plugin test harness can capture synthetic appends alongside prompts, so existing gate tests can be re-pointed rather than rewritten.
- **A4** No other plugin or test imports the removed dead exports or reads `debounceMs`.

## Out of Scope

- Changing which gates run, their commands, or their match patterns.
- Reworking the other plugins beyond importing the shared helpers.
- Making the delivery carrier configurable per gate.
- Implementing a working debounce or batching behaviour.
- Changing the mutation or coverage thresholds.

## Open Questions

- Whether the synthetic gate message should carry a correlation key. The knowledge base records that a session message id requires a `msg_` prefix, so instructions-loader correlates through `metadata` and loader-side tokens (`codekb/workspace/architecture.md`, Instruction delivery). The design stage shall decide whether gate signals need the same correlation.
- Whether the shared helpers belong in one module or several. The requirements fix the behaviour and the import boundary; the design stage chooses the file split.
