## Plugin Directory & Export Requirements

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.ts` (root) | Plugin entry points only | PascalCase or kebab-case plugins (`harness-plugin.ts`, `session-tracker.ts`) |
| `helpers/*.ts` | Shared utility modules, helpers, and discovery logic | camelCase filenames representing their domain (`kv-store.ts`, `logger.ts`, `file-discovery.ts`) |
| `AGENTS.md` | Discoverable instruction file matched by the `**/AGENTS.md` glob | Must be capitalized — lowercase `agents.md` is not discovered |
| `helpers/` | Shared plugin utilities (logging, KV store, session helpers) | camelCase filenames representing their domain |
| `types/` | TypeScript type definitions shared across modules | Descriptive singular or plural names (`instructions.ts`) |
| `sessions/` | Runtime JSON state files (1000+ files, auto-generated) | Pattern: `ses_<timestamp>_<random>.json` — do not create manually |


### Quality Gates

All these quality gates need to pass to conclude that the plugin is valid and ready for use.

Tests: `cd /workspace/.opencode && just test`
Linter: `cd /workspace/.opencode && just lint`
Typecheck: `cd /workspace/.opencode && just typecheck`

All commands support additional parameters eg. to run a single test file: `cd /workspace/.opencode && just test -- tests/helpers/instruction-indexer.test.ts`