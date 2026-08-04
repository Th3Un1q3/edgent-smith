# Quality Gate Design Rules

Rules for deciding which check runs on which file change. They keep the feedback loop short: a gate that runs checks unrelated to the edit burns wall-clock time and trains the agent to ignore gate output. The schema these rules configure lives in `mem:quality-gates/configuration`.

- **Narrow triggers** — scope patterns to the directories and file types the check actually applies to; avoid broad globs that catch unrelated files.
- **Check appropriate to the target** — ruff on fast-changing sources, mypy on core modules only, tests only when source or test files change.
- **Do not run irrelevant checks** — no typecheck for scripts, no lint for test-only changes, no Python checks for justfile edits.
- **Sequential early exit** — commands inside a gate run in order and stop at the first failure, so the agent sees the first real error instead of a cascade.
- **Debounce** — a short delay (~300ms) absorbs multi-file saves, so one logical edit produces one gate run.

When adding a gate, name the single check that would have caught the class of bug you care about, then pick the narrowest pattern that reaches it. A gate that fires on every save is worse than no gate: a permanently red gate stops carrying information.
