# Cross-Unit Traceability

## Verdict

**PASS** — every requirement this run traced is covered; no uncovered IDs.

Zero-Unit work: one stage-level implementation under `construction/code-generation/`, no per-Unit split. The sensor output (`aidlc engine sensor-traceability --stage build-and-test`) reports `pass: true` with `uncovered: []`.

## Coverage

| ID | Covered | Owning stage | Target file |
|---|---|---|---|
| FR1.1 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR1.2 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR1.3 | Yes | code-generation | `.opencode/plugins/helpers/gate-formatter.ts` |
| FR1.4 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR2.1 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR2.2 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR2.3 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| FR3.1 | Yes | code-generation | `.opencode/plugins/helpers/tool-input.ts` |
| FR3.2 | Yes | code-generation | `.opencode/plugins/helpers/tool-input.ts` |
| FR3.3 | Yes | code-generation | `.opencode/plugins/helpers/steering-message.ts` |
| FR3.4 | Yes | code-generation | `.opencode/plugins/instructions-loader.ts` |
| FR4.1 | Yes | code-generation | `.opencode/plugins/helpers/gate-runner.ts` |
| FR4.2 | Yes | code-generation | `.opencode/plugins/helpers/gate-formatter.ts` |
| FR4.3 | Yes | code-generation | `.opencode/plugins/types/quality-gate.ts` |
| FR4.4 | Yes | code-generation | `.opencode/plugins/types/quality-gate.ts` |
| FR5.1 | Yes | code-generation | `.opencode/plugins/tests/quality-gate-enforcer.test.ts` |
| FR5.2 | Yes | code-generation | `.opencode/plugins/tests/helpers/tool-input.test.ts` |
| FR5.3 | Yes | code-generation | `.opencode/plugins/tests/quality-gate-enforcer.test.ts` |
| NFR1 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| NFR2 | Yes | code-generation | `.opencode/plugins/helpers/steering-message.ts` |
| NFR3 | Yes | code-generation | `.opencode/plugins/quality-gate-enforcer.ts` |
| NFR4 | Yes | code-generation | `.opencode/plugins/tests/quality-gate-enforcer.test.ts` |

## Uncovered elements

None reported by the sensor.

## Observations

- FR5.2's recorded target is `tests/helpers/tool-input.test.ts`; the delivery cases it names live in `tests/quality-gate-enforcer.test.ts`. The code review recorded this as R-03; both files exist and are green, so coverage is not lost, but the target pointer is imprecise.
- BR-level rules were traced at the functional-design stage and carried into the code-generation traceability table; this stage's sensor reports FR and NFR IDs.
