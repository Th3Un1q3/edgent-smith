# Recipe: Bump and republish

Bump a Feature patch, test, and republish so floating tags move forward.

## When to load

Load when you ship a fix to an existing published Feature without breaking consumers pinned to `:1`.

## Prerequisites

- Feature at `src/<id>/devcontainer-feature.json` already published to `ghcr.io/<owner>/<collection>/<id>`.
- Tools: `git`, `bash`, `npx @devcontainers/cli`, `oras`, `ajv-cli`, `shellcheck`.
- `GITHUB_TOKEN` with `packages: write` exported for `oras` and publish.

## Steps

1. Edit `version` in `src/<id>/devcontainer-feature.json` — bump `PATCH`.

```json
{
  "id": "mytool",
  "version": "1.0.1",
  "name": "My Tool"
}
```

Use `1.0.1` from `1.0.0` for fixes; use `1.1.0` for features, `2.0.0` for breaks.

2. Validate metadata and install script.

```bash
./scripts/validate-feature.sh mytool
```

Fix schema or `shellcheck` errors before publishing.

3. Run the test matrix for the Feature.

```bash
devcontainer features test --collection-root ./src/mytool
```

Require green on every scenario in `test/mytool/scenarios.json`.

4. Commit and tag the bump.

```bash
git add src/mytool/devcontainer-feature.json
git commit -m "fix: bump mytool to 1.0.1"
git tag mytool-1.0.1
git push origin main --tags
```

Monorepos tag per Feature; scoped repos tag the repo.

5. Publish the new version.

Choose one path:

CLI path for manual publish:

```bash
npx @devcontainers/cli features publish \
  --registry ghcr.io \
  --namespace myorg/my-collection \
  src/mytool
```

Action path for CI publish: push the tag and let `.github/workflows/release.yaml` run `devcontainers/action` with `publish-features: true`.

6. Verify floating tags now share the new digest.

```bash
d_exact=$(oras manifest fetch ghcr.io/myorg/my-collection/mytool:1.0.1 | sha256sum)
d_major=$(oras manifest fetch ghcr.io/myorg/my-collection/mytool:1 | sha256sum)
d_minor=$(oras manifest fetch ghcr.io/myorg/my-collection/mytool:1.0 | sha256sum)
test "$d_exact" = "$d_major" && test "$d_exact" = "$d_minor" && echo "floating tags moved"
```

All three digests must match. The publish already retagged `1` and `1.0` to the `1.0.1` manifest.

7. Update consumers pinned to the exact patch when needed.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1.0.1": {}
  }
}
```

Consumers on `:1` need no change; they float to `1.0.1` on next build. Consumers on `:1.0.0` stay until you edit the pin.

## Done when

- `src/<id>/devcontainer-feature.json` `version` equals `1.0.1`.
- `./scripts/validate-feature.sh <id>` passes.
- `devcontainer features test` passes.
- `ghcr.io/<owner>/<collection>/<id>:1.0.1` exists and `oras manifest fetch` succeeds.
- Digest equality holds: `ghcr.io/...:1` digest equals `ghcr.io/...:1.0.1` digest.
- `ghcr.io/...:1.0` also equals the new digest when the publisher emits minor floating tags.

## Failure recovery

Publish fails with duplicate-tag when the exact version already exists:

```bash
# error: tag 1.0.1 already exists
```

Bump to `1.0.2` and republish; do not delete the existing tag.

## Canonical sources

- Distribution: [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- CLI publish: [devcontainers/cli — publish](https://github.com/devcontainers/cli/blob/main/docs/features/publish.md)
- Action: [devcontainers/action](https://github.com/devcontainers/action)
