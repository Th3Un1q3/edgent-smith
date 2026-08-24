# DeepSeek Harness (dsh) Domain

Covers the DeepSeek Harness CLI (`dsh`) as wired into this repo: install and version pinning, `~/.dsh` config schema, provider/credential state, sandbox backend selection, plugin enablement, devcontainer persistence and rebuild survivability, and the `just dsh` integration.

## Scope

- Install mechanics, version pinning, Node/npm requirements: mem:tooling/deepseek-harness/install-pinning.
- `~/.dsh` config: settings.yaml, cordis.patch.yml, credentials; dump-config behavior: mem:tooling/deepseek-harness/settings-schema.
- Provider and model wiring, credential resolution, quota state: mem:tooling/deepseek-harness/provider-state.
- Sandbox backend capability probing and selection: mem:tooling/deepseek-harness/sandbox-backend.
- Plugin toggles for coding-harness parity: mem:tooling/deepseek-harness/plugin-enablement.
- Devcontainer persistence: volume ownership, config-as-code, rebuild survivability: mem:tooling/deepseek-harness/devcontainer-persistence.
- Docs/justfile integration: mem:tooling/deepseek-harness/docs-just-integration.

## Boundaries (out of scope)

- opencode harness internals: mem:refactoring/about, mem:researches/opencode/observability/about.
- Generic devcontainer lifecycle mechanics: mem:devcontainer-workflows/about.
- General npm/tooling outside this container: mem:tooling/bun-workflow.