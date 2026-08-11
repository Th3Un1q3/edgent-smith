# OpenCode Plugin Live Failure Diagnosis

How to diagnose opencode plugin behavior when unit tests pass but live runs fail. Source: operator-verified session history - implementation and validation subagent reports, runtime logs at ~/.local/share/opencode/log/opencode.log, and /workspace/.opencode/plugins/ files.

## Live-vs-unit divergence is real

Unit tests drive hooks directly with hand-built input/output objects - they prove hook LOGIC, not live WIRING (registration, dispatch order, real prompt and message content). A live task call can fail where the suite passes; 480 green tests did not catch the envelope bug. Proof requires hook-level evidence: correlate runtime logs by timestamp to the exact subagent session id.

## Diagnosis method

- Enable logging: OPENCODE_LOG_LEVEL=INFO; runtime logs are key=value at ~/.local/share/opencode/log/opencode.log.
- Correlate log lines by timestamp and session id to the failing subagent.
- A false warn is a smoking gun: in the envelope bug, `Envelope <id> not found - removing placeholder.` lines carrying literal bogus ids proved the unwrap regex matched prompt prose, not a real tag.

## Detection: substring is fragile, precise tokens win

Loose detection (prompt.includes substring, id="([^"]+)") matches LITERAL PROSE: agent prompts and docs routinely contain example tags for the very mechanisms they describe. The live test prompt explained the envelope mechanism and contained `<envelope id="..." .../>` and `<envelope id="<uuid>" .../>`; the loose guard concluded already-enveloped and skipped creation, and the loose unwrap regex captured the prose ids and logged false warns. Fix: require precise, verifiable token shapes - UUID-v4-pattern ids (real ids are always crypto.randomUUID(): lowercase hex), full tag structure including self-closing `/>`, one shared regex for guard, pre-guard, filter, and unwrap. Mechanism detail: mem:refactoring/skills-loader-envelope-mechanism.

## Gotchas

- Plugins load at server start: applying a plugin change requires an opencode restart (operator-in-the-loop); unit tests cannot prove live hook wiring.
- Log attribution: helpers/logger.ts hardcodes PLUGIN_ID=harness-plugin, so skills-loader logs appear as [harness-plugin] - attribute log lines per-plugin, not by the label.
- A typed hook is a contract, not a guarantee - prove dispatch with runtime logs (mem:refactoring/permission-hooks).

## Related

- mem:refactoring/skills-loader-envelope-mechanism - mechanism design and the UUID-precise detection fix
- mem:refactoring/permission-hooks - typed-hook dispatch lesson
- mem:testing/plugin-mock-patterns - what unit tests can and cannot prove
- mem:subagent-workflows/skill-envelope-session-retrospective - process lessons from this session
