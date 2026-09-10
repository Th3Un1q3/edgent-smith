# Reference: Feature anatomy

Use this reference when you author `devcontainer-feature.json` and `install.sh`.

## When to load

Load when you define Feature metadata, options, dependencies, or container settings.

## Vocabulary

- **Feature** — a reusable Dev Container unit with `devcontainer-feature.json` and `install.sh` in `src/<id>/`.
- **FeatureOption** — a typed input (`boolean` or `string`) defined under `options`; the runner exposes the selected value as an environment variable during `install.sh`.
- **devcontainer-feature.json** — the Feature metadata file validated against `devContainerFeature.schema.json`.
- **install.sh** — the POSIX-compatible install script that runs as root inside the container build.
- **containerEnv** — map of environment variables the Feature injects into the container via `devcontainer-feature.json`.

## Required fields

Set `id` and `version`. `id` matches the directory name under `src/`. `version` follows semver.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "name": "My Tool"
}
```

Keep `id` lowercase, alphanumeric, hyphens only.

## Descriptive fields

Add `name`, `description`, `documentationURL`, `keywords`, and `licenseURL` for discovery.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "name": "My Tool",
  "description": "Installs mytool CLI",
  "documentationURL": "https://example.com/mytool",
  "keywords": ["cli", "mytool"]
}
```

## Options

Define each option with `type`, `default`, and optionally `enum` or `proposals`. The runner exports options as uppercase env vars.

Limit to 3 options per Feature; each option needs a default.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "options": {
    "version": {
      "type": "string",
      "default": "latest",
      "proposals": ["latest", "1.2.3"]
    },
    "installDependencies": {
      "type": "boolean",
      "default": true
    }
  }
}
```

For strict values use `enum`; for suggestions use `proposals`.

## Dependencies

Use `dependsOn` for hard dependencies and `installsAfter` for soft ordering.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "dependsOn": {
    "ghcr.io/devcontainers/features/common-utils:1": {
      "installZsh": false
    }
  },
  "installsAfter": ["ghcr.io/devcontainers/features/docker-in-docker:1"]
}
```

Declare at most 5 hard dependencies; soft ordering does not install the target.

## Container configuration

Set `containerEnv`, `customizations`, and `mounts` to configure the container.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "containerEnv": {
    "MYTOOL_HOME": "/usr/local/mytool",
    "PATH": "/usr/local/mytool/bin:${PATH}"
  },
  "customizations": {
    "vscode": {
      "extensions": ["ms-vscode.vscode-json"]
    }
  },
  "mounts": [
    {
      "source": "mytool-cache",
      "target": "/usr/local/mytool/cache",
      "type": "volume"
    }
  ]
}
```

Expose tool paths via `containerEnv.PATH`; do not mutate `PATH` in `install.sh` alone.

## Lifecycle hooks

Add `*Command` hooks only when the Feature must run after image build. Keep hooks minimal.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "onCreateCommand": "mytool init",
  "postCreateCommand": "mytool --version",
  "postStartCommand": "mytool status"
}
```

Prefer `install.sh` for install-time work; reserve hooks for runtime checks.

## Runtime options

Enable `privileged`, `init`, `capAdd`, `securityOpt`, or `entrypoint` only when the Feature requires elevated privileges.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "privileged": false,
  "init": true,
  "capAdd": ["SYS_PTRACE"],
  "securityOpt": ["seccomp=unconfined"]
}
```

Default `privileged` to `false`; request the minimal `capAdd` set.

## Canonical sources

- Schema: [devContainerFeature.schema.json](https://github.com/devcontainers/spec/blob/main/schemas/devContainerFeature.schema.json)
- Spec: [containers.dev/implementors/features](https://containers.dev/implementors/features/)
