---
id: experiences-devcontainer-features-authoring
type: experiences
L0: "Dev container feature authoring: structure, devcontainer-feature.json, install.sh, tests"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: "containers.dev/implementors/features + feature-starter + guide/feature-authoring-best-practices"
claim_ids: ["devcontainer-feature-schema-claim", "install-sh-idempotency-claim"]
---

# Dev Container Feature Authoring

**Use when:** creating a new dev container Feature, editing devcontainer-feature.json, writing install.sh, or adding Feature tests.

## Structure
Repo layout per spec: `src/<id>/devcontainer-feature.json` + `install.sh` + optional `test/<id>/test.sh` and `scenarios.json`. Template: https://github.com/devcontainers/feature-starter (Source: containers.dev/implementors/features/).

## devcontainer-feature.json schema
Required: `id` (kebab, matches folder), `version` (semver), `name` (human). Optional: `options` (typed inputs), `dependsOn` / `installsAfter`, `containerEnv`, `customizations` (vscode), `mounts`, lifecycle hooks. Schema: devContainerFeature.schema.json (Source: containers.dev/implementors/features/).

## install.sh contract
Runs as root inside target container. Env: `_REMOTE_USER`, `_CONTAINER_USER`, `_REMOTE_USER_HOME`. Must handle idempotency (re-run safe), OS detection via `/etc/os-release`, chown installed artifacts to `$_REMOTE_USER`, exit non-zero on failure. No assumption of bash on Alpine — use POSIX or declare bash.

## Testing
Local: `devcontainer features test -f <id> -i <baseImage>` (requires devcontainers CLI). Scenarios matrix via `test/<id>/scenarios.json`, CI matrix across base images. Source: containers.dev/implementors/features-distribution + feature-starter README.

## Boundaries
Not for generic Dockerfile authoring or devcontainer.json editing — see mem:devcontainer-workflows/about. Feature-specific persistence: mem:tooling/deepseek-harness/devcontainer-persistence for install guard patterns; mem:devcontainer-workflows/change-management for env edits.

## Related
- mem:experiences/devcontainer-features-publishing — OCI publish after authoring
- mem:experiences/devcontainer-features-versioning — semver & pinning
- mem:experiences/devcontainer-features-skill-coverage — skill gap assessment