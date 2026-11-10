---
id: cases/orchestration/root-cause-isolation-and-branded-type-validation
type: cases
L0: "A plugin hook that throws on a matching path fails the tool only for matched files: the failing set reveals the matcher, not the tool."
hotness: 0.7
ttl: 180d
freshness: 2026-11-10
provenance: .opencode/plugins/instructions-loader.ts (runSynthetic, read 2026-11-10), .opencode/instructions/opencode-plugin-interfaces.instructions.md, .opencode/agents/rug.md
scope: cases — one failure plus its fix; promotion to trajectories/experiences needs 3 such cases.
---
# Root-cause isolation and branded-type validation

Lesson: a plugin tool hook that throws on a matching path makes the tool fail only for the files that match, so the failure set reveals the matcher, not the tool.

Observed: one repo tool failed for .md, .py, .json, .ts, .js, .sh, .html and passed for .txt, .log, .csv. Cause: .opencode/plugins/instructions-loader.ts called context.session.synthetic with id "instruction_load:<path>". SessionMessage.ID requires a msg_ prefix (Schema.String.check(Schema.isStartsWith("msg_"))), so the call failed schema validation, the failure surfaced at the caller's tool, and .txt never reached the call because no instruction applyTo glob matched. Current code omits id and carries correlation in metadata.

False attributions, in order: an extension-based read schema restriction; the agent permission block; a harness-level defect. Each was probed with an adjacent hypothesis (another extension, another permission), none by disabling the loader.

Rules:
- Disable the plugin or hook and repeat one failing and one passing input; only a failure that survives removal is harness-level.
- The failing set equals the hook's match set; name the component with that match set before concluding.
- A schema error names no owner; read the throwing call from the stack.
- Confirm a fix by re-running the identical failing input with the culprit disabled, then patched.