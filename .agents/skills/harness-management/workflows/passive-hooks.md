# Route a Rule to a Passive Hook

Enforce a recurring rule on a concrete event, so it fires whether or not the agent recalls it. This workflow covers the OpenCode plugin-hook path; where an environment has no hook layer, keep the rule as skill or instruction prose and name the verifier — a human, or a CI job running the repo's `just` gates.

**Failure this prevents:** a rule written in a skill or instruction fires only when the agent reads and recalls it. A plugin hook fires on the event whether or not the agent pays attention.

## When to Use This Change Type

Use this change type when:
- A recurring mistake should be caught on every relevant edit or session, not left to agent recall.
- An instruction already states the rule but the agent ignores it in practice.
- You need a deterministic pass or fail result rather than advisory prose.

**Harness coverage.** OpenCode has the `.opencode/plugins/` hook layer this workflow edits. Where an environment cannot run a hook, keep the rule as skill or instruction prose and name the verifier — a human, or a CI job running the repo's `just` gates.

## Decide: Is This the Right Change Type?

- Guidance that shapes how the agent reasons belongs in a skill or instruction: see [manage-skill.md](./manage-skill.md) and [scoped-instructions.md](./scoped-instructions.md).
- Enforcement that must fire on a concrete event belongs in the plugin layer. Instructions load on a file match; plugins run hooks.
- Plugin internals belong to the plugin directory knowledge base `.opencode/plugins/AGENTS.md` and the interface contract `.opencode/instructions/opencode-plugin-interfaces.instructions.md`. Reference them; do not restate them here.

## Procedure

1. Name the event the rule binds to: an edit or write to a path, a session start, a tool call, or a todo transition.
2. Pick the existing hook that owns that event, or add a new plugin entry point.
   - `.opencode/plugins/quality-gate-enforcer.ts` runs configured gates on `edit` and `write` through `tool.execute.before` and `tool.execute.after`, then reports status transitions.
   - `.opencode/plugins/skills-loader.ts` injects skills at server start.
   - `.opencode/plugins/session-tracker.ts` tracks per-session state.
   - `.opencode/plugins/todo-enforcer.ts` enforces todo transitions.
   The full set of entry points and helper roles is in `.opencode/plugins/AGENTS.md`.
3. Write the hook as a named-export async function that returns the registration object. Store per-session state through `helpers/kv-store.ts` (`SessionStorage`) and log through `helpers/logger.ts`. Namespace every state key so two plugins do not clobber each other.
4. Make the hook fail closed. An exception must report failure, never skip the check. `quality-gate-enforcer.ts` sets the reference: a thrown gate error becomes `{ exitCode: 1 }` (lines 89 to 96), so an errored gate counts as failed. For a new hook, trace what the caller sees when the check cannot run. If the error path allows, fix it.
5. Add tests under `.opencode/plugins/tests/` that match the source file name, per `.opencode/plugins/AGENTS.md`.
6. Run the plugin quality gates before declaring done.

## Format and Conventions

- Pure ESM, named exports only, no default exports, no classes (`.opencode/instructions/opencode-plugin-interfaces.instructions.md`).
- Entry points at `.opencode/plugins/*.ts`; shared helpers in `helpers/`; shared types in `types/`.
- Every `<steering>` message follows `.opencode/instructions/steering-message.md`.

## Verify

- Run the plugin gates. From `/workspace`: `just opencode::test`, `just opencode::lint`, `just opencode::typecheck` (`.opencode/justfile`). For a single test file, use the per-file form documented in `.opencode/plugins/AGENTS.md`.
- Confirm the hook fires on the intended event, not a neighboring one. Check this in the plugin tests; a passing unit test alone does not prove live wiring.
- Force the error path and confirm it reports failure, not success. This is the fail-closed check from step 4.

## Apply and Restart

- Plugins load by directory scan at opencode server start.
- Ask for an opencode restart. Unit tests cannot prove live hook wiring.

## Done When

- The hook's tests pass and the three gate commands exit 0.
- A restart loads the plugin with no error.
- The fail-closed check fails the run on a forced error.
