# dsh ~/.dsh Config Schema

`$DSH_HOME` defaults to `~/.dsh`. `settings.yaml` top-level sections are keyed by PLUGIN ID: `llm-pi-ai: {providers: {<id>: {apiKeyEnv, displayName, api?, baseURL?, ...}}}`. `agent-default-model: {provider, model}` is a SIBLING top-level section — nesting it under `llm-pi-ai` is rejected and silently falls back (cost one debug cycle).

## Credentials & patches

- Providers reference env-var NAMES only (`apiKeyEnv`). Resolution order: env -> `~/.dsh/.credentials.yaml` -> cwd `.env` -> `~/.dsh/.env`.
- `cordis.patch.yml` (home level, outranks profile patches) is a top-level YAML ARRAY of `{id, disabled?, config?}` entries; hot-reloads.
- Inspect with `dsh --profile <name> --dump-config` — settings sections do NOT appear in dump-config; they apply at request time.

Patch-driven plugin toggles: mem:tooling/deepseek-harness/plugin-enablement.