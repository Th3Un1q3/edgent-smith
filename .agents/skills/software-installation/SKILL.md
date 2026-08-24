---
name: software-installation
description: Install packages, software, and libraries with the full set of nuances that break naive installs in this repo's devcontainer: version pinning (incl. rc tags), idempotent version-checked install guards, npm's allow-scripts gate and native-module/ABI pitfalls, devcontainer lifecycle (Features vs postCreateCommand) and rebuild persistence, named-volume ownership, PATH/containerEnv, config-as-code, verification (introspection, smoke tests, native-load checks), and secret hygiene. Trigger on: "install a package/tool/library", "how do I install X", "npm install", "add a dependency", "setup-dev.sh", "install a CLI", "what could go wrong installing X". Not for: opencode config mechanics (customize-opencode), devcontainer.json spec authoring (devcontainers-best-practices — cross-reference it), or application code.
license: MIT
metadata:
  version: "1.0.0"
  author: SWE
  delta: "1.0.0: initial authoring — 3 workflows + 4 references covering verified devcontainer install nuances (pinned rc-tag installs, version-checked guards, allow-scripts whitelists, lifecycle placement, volume ownership, config-as-code, smoke classification, secret and telemetry hygiene)."
---

# Software Installation

Install software so it survives this repo's devcontainer lifecycle: pinned versions, version-checked guards, npm allow-scripts whitelists, home-mounted volumes, config-as-code restore, and verification with explicit pass/fail classification. Naive installs fail silently here — npm skips postinstalls, fresh volumes deny writes, and rebuilds wipe home-dir state.

## When to Use

- Installing a CLI, npm package, Python package, or library into the devcontainer.
- Answering "how do I install X" or "what could go wrong installing X".
- Adding a dependency, editing setup scripts (`setup-dev.sh`), or wiring tool config.
- Debugging an install that fails or silently misbehaves (missing binary, native-load error, EACCES, inert config).

## When Not to Use

- OpenCode config mechanics (agents, skills, MCP servers, permissions) — load the `customize-opencode` skill with the Skill tool.
- devcontainer.json spec authoring, Feature authoring, or schema questions — load the `devcontainers-best-practices` skill with the Skill tool and cross-reference its lifecycle and Features references.
- Broad research on a tool or library — load the `context-gathering` skill with the Skill tool.
- Application code changes unrelated to installing or wiring tooling.

## Principles

- Pin exact versions, rc tags included; verify with a version-checked guard, not a bare presence check.
- Install idempotently — a guard that checks the wrong thing silently never reinstalls.
- Whitelist npm scripts explicitly; the allow-scripts gate skips postinstall by default.
- Resolve PATH dynamically from `npm prefix -g`; hardcoding a node-versioned path breaks on rebuild.
- Restore config from repo templates with `cp -u`; keep user edits with newer mtimes.
- Verify from the installed artifact: introspection, native-load checks, bounded smokes with explicit classification.
- Keep secrets out of config: store env-var names, never values.
- Prefer disabled telemetry defaults and set opt-out env vars.

## File Map

| Need | File |
|------|------|
| End-to-end CLI tool install (pin → guard → allow-scripts → PATH → volume → config → verify) | [workflows/install-cli-tool.md](workflows/install-cli-tool.md) |
| Python package installs with uv (sync, tool install, uvx, dependency groups) | [workflows/install-python-package.md](workflows/install-python-package.md) |
| Diagnose a failing install (version vs native-load vs ABI vs permission vs schema vs external) | [workflows/debug-install-failure.md](workflows/debug-install-failure.md) |
| Lifecycle semantics, placement, rebuild wipes, volumes, PATH, ports | [references/devcontainer-lifecycle-and-persistence.md](references/devcontainer-lifecycle-and-persistence.md) |
| npm allow-scripts gate, native modules, ABI, global prefix, platform prebuilds | [references/npm-and-native-modules.md](references/npm-and-native-modules.md) |
| Plugin-managed tools, bundle metadata, config-as-code, schema source of truth | [references/plugin-systems-and-config.md](references/plugin-systems-and-config.md) |
| Verification: introspection, native-load checks, smoke classification, secrets, telemetry | [references/verification-and-hygiene.md](references/verification-and-hygiene.md) |

## Related Skills

- `devcontainers-best-practices` — lifecycle spec, Features authoring, schema validation.
- `customize-opencode` — opencode configuration mechanics.
- `context-gathering` — research on tools and libraries.
