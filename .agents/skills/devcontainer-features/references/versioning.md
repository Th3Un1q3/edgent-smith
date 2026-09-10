# Reference: Versioning

Use this reference when you set, bump, or pin a Feature version.

## When to load

Load when you edit `devcontainer-feature.json`, cut a release, or pin a consumer tag.

## Vocabulary

- **semver** — semantic version `MAJOR.MINOR.PATCH` with optional pre-release; the Feature schema requires semver.
- **floating tag** — a partial version tag that moves to the latest patch or minor: `1`, `1.0`, `1.0.0`.
- **pin** — the consumer tag in `devcontainer.json` that selects which floating or exact version to install.
- **duplicate-tag rejection** — the registry rejects a push when the exact version tag already exists.
- **retag** — updating a floating tag to point to a new patch without moving the immutable patch tag.

## Required version field

`devcontainer-feature.json` requires `version` as semver. The schema enforces the pattern `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$`.

```json
{
  "id": "mytool",
  "version": "1.0.1",
  "name": "My Tool"
}
```

Omit the `v` prefix, omit build metadata, and keep three numeric segments. `1.0` fails validation; `1.0.0` passes.

Follow semver for bumps: `MAJOR` for breaking changes, `MINOR` for new features, `PATCH` for fixes.

## Floating tags

Publishing generates floating tags from the exact version. The publisher pushes the exact tag and retags floating aliases to the same digest.

Given `version: "1.2.3"` the registry receives three tags that share one digest:

```bash
ghcr.io/myorg/my-collection/mytool:1
ghcr.io/myorg/my-collection/mytool:1.2
ghcr.io/myorg/my-collection/mytool:1.2.3
```

The consumer may omit the patch or minor to float:

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {},
    "ghcr.io/myorg/my-collection/mytool:1.2": {},
    "ghcr.io/myorg/my-collection/mytool:1.2.3": {}
  }
}
```

If the consumer omits the tag entirely the tool appends `:latest`. The `devcontainers/features` README states `:latest` is implicit when no tag is present.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool": {}
  }
}
```

Avoid `:latest` in production; it moves on every major bump without semver bounds.

## Duplicate-tag rejection

Publish fails when the exact version tag already exists. The Action and the CLI treat push as idempotent fail, not overwrite.

```bash
npx @devcontainers/cli features publish src/mytool
# error: ghcr.io/myorg/my-collection/mytool:1.0.0 already exists
```

The check prevents accidental overwrites of immutable releases.

Recover with a bump, not a forced push:

```json
{
  "id": "mytool",
  "version": "1.0.1"
}
```

Bump `PATCH` for a fix, republish, and let floating tags roll forward. Do not delete and repush the same version to move a floating tag.

## Pinning consumers

Pin consumers by stability need.

Pin to major for automatic patches and minors:

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {}
  }
}
```

Pin to exact patch for reproducible builds:

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1.0.0": {}
  }
}
```

Use `:1` for applications that track the Feature; use `:1.0.0` for CI that needs byte-identical rebuilds.

## Retag strategy

Update floating tags after a patch bump; keep the old patch tag immutable.

Publish `1.0.1`:

```bash
oras manifest fetch ghcr.io/myorg/my-collection/mytool:1.0.1
oras manifest fetch ghcr.io/myorg/my-collection/mytool:1
```

Both fetches return the same digest after a successful publish. Verify with digest comparison:

```bash
d1=$(oras manifest fetch ghcr.io/myorg/my-collection/mytool:1 | sha256sum)
d2=$(oras manifest fetch ghcr.io/myorg/my-collection/mytool:1.0.1 | sha256sum)
test "$d1" = "$d2" && echo "floating tag moved"
```

If digests diverge the floating tag did not advance; re-run publish.

For pre-releases use `1.0.0-rc.1` and publish without floating tags to avoid moving `1`.

## Canonical sources

- Schema: [devContainerFeature.schema.json — version pattern](https://github.com/devcontainers/spec/blob/main/schemas/devContainerFeature.schema.json)
- Distribution: [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- Features README: [devcontainers/features — :latest implicit](https://github.com/devcontainers/features)
- Action: [devcontainers/action](https://github.com/devcontainers/action)
