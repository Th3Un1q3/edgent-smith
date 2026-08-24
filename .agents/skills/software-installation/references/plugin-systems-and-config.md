# Reference: Plugin Systems and Config

Wire plugin-managed tools and config-as-code templates so configured rows actually apply. Use when a plugin adds a package that does nothing, or a config file loads but its rows stay inert.

## Vocabulary

- **bundle/layer metadata** — package metadata (for example a `dsh.bundle` field) marking a package as a tool bundle with plugin hooks; a plain dependency lacks it.
- **config patch row** — one entry in a tool's config that patches behavior (for example adding an mcp-client server).
- **config-as-code** — tool config templates stored in the repo and restored idempotently to home-dir paths.

## Plugin-managed tools

A plugin manager forwards its package-manager verbs; dsh's plugin command forwards pnpm and requires pnpm on PATH:

```bash
dsh plugin --profile <name> add <pkg>@<version>
```

A package WITHOUT tool bundle metadata (no `dsh.bundle`) installs as a plain dependency, and config patch rows targeting it stay inert — verified: `@deepseek-ai/dsh-mcp-client@0.0.1-rc.1` produced `patch: entry "mcp-client" not found`. Check the bundle/layer metadata BEFORE wiring config; document a configured-but-inert tool honestly in the install notes.

## Config-as-code restore

Store templates under `.devcontainer/<tool>/`; create the target dir, then restore with a guarded `cp -u` (full block: [workflows/install-cli-tool.md](../workflows/install-cli-tool.md) Step 6). Home-dir config (`~/.dsh`) wipes on rebuild, and the workspace mount persists, so the template is the source of truth:

```bash
if [[ -f .devcontainer/dsh/settings.yaml ]]; then
  cp -u .devcontainer/dsh/settings.yaml ~/.dsh/settings.yaml
  cp -u .devcontainer/dsh/cordis.patch.yml ~/.dsh/cordis.patch.yml
fi
```

`cp -u` copies only when the source is newer, so user edits with newer mtimes survive restore.

## Schema source of truth

Treat the installed package as the schema source of truth — its docs, types, or `--dump-config`-style introspection — never third-party blogs. Blog examples carry wrong shapes that tools reject or ignore: dsh's `agent-default-model` nested shape was silently rejected, and the dsh-mcp-client real schema is per-server `serverName`, not a `servers:` map. Generate config from introspection, then diff it against the template.
