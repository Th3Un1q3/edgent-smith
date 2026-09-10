# Workflow: Publish a Feature to GHCR

When to load: you publish src/<id>/ to ghcr.io after tests pass, create the first OCI release, push updates, or automate publishing with GitHub Actions. Load this workflow only after test-feature.md reports 4 greens.

## Prerequisites

- Read [publishing-distribution](../references/publishing-distribution.md) for OCI namespace rules.
- Read [versioning](../references/versioning.md) for semver and floating tags.
- Verify src/<id>/devcontainer-feature.json parses and version is semver X.Y.Z.
- Verify 4 scenarios passed via test-feature.md. Gather ghcr.io owner, repo visibility plan, and PAT with `write:packages`.
- Install tools and confirm 1 check each:
  - `devcontainer --version` returns 0.56 or later
  - `oras version` returns 1.0 or later
  - `gh --version` returns 2.0 or later for GHCR checks

## Order of Operations

1. Validate namespace uniqueness. 2. Check duplicate tag. 3. Generate collection.json. 4. Publish via CLI or GH Action. 5. Verify digest with oras. 6. Set package visibility. Follow the order. Abort when duplicate tag exists.

## Steps

### 1. Validate namespace uniqueness

Use 1 owner scope per collection. Match OCI ref `ghcr.io/<owner>/features/<id>:<semver>` where owner is lowercase and id matches `^[a-z0-9][a-z0-9-]*$`. Keep namespace unique per features-distribution spec. Reject collisions before you push.

Create 1 namespace per GitHub org or user. Map 1 repo to 1 collection. Document the namespace in src/<id>/devcontainer-feature.json and collection.json.

```json
{
  "namespace": "ghcr.io/myorg/features",
  "featureId": "mytool",
  "ociRef": "ghcr.io/myorg/features/mytool:1.2.3"
}
```

A second example shows collision rejection when owner mismatches:

```json
{
  "attemptedRef": "ghcr.io/otherorg/features/mytool:1.2.3",
  "existingRef": "ghcr.io/myorg/features/mytool:1.2.3",
  "result": "reject: namespace already claimed by myorg"
}
```

Done when: namespace uses ghcr.io/<owner>/features/<id> shape, owner is lowercase, id matches regex, no collision. Gate: collision detected, stop and choose a new id.

### 2. Check duplicate tag before push

Query GHCR for the exact semver tag. Abort when the tag exists. GHCR returns 409 on duplicate publish, so check first to avoid a failed workflow.

Require 0 existing tags for the target version. Check 1 tag per publish attempt.

```sh
# check tag via gh CLI (requires read:packages)
gh api /users/myorg/packages/container/mytool%2Fversions --jq '.[].metadata.container.tags[]' | grep -qx "1.2.3" && echo "duplicate tag" || echo "tag free"

# check tag via oras manifest fetch (exits 0 when tag exists)
oras manifest fetch ghcr.io/myorg/features/mytool:1.2.3 2>/dev/null && echo "tag exists, abort" || echo "tag free, continue"

# check tag via docker registry API
curl -sf -H "Authorization: Bearer $(gh auth token)" https://ghcr.io/v2/myorg/features/mytool/tags/list | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if '1.2.3' in d.get('tags',[]) else 1)" && echo "duplicate" || echo "free"
```

Done when: oras manifest fetch for target tag exits non-zero, no duplicate found. Gate: duplicate tag check exits 0, abort publish and bump version via version-and-update.md.

### 3. Generate collection.json

Generate collection.json at the repo root for monorepos. List 1 entry per Feature with id, version, and OCI ref. Regenerate on every version bump. Keep the file under 200 lines.

Use 1 command to generate, or author the file directly when you publish 1 Feature.

```json
{
  "sourceInformation": {
    "source": "https://github.com/myorg/my-features"
  },
  "features": [
    {
      "id": "mytool",
      "version": "1.2.3",
      "description": "Installs mytool CLI with pinned version",
      "documentationURL": "https://github.com/myorg/my-features/tree/main/src/mytool",
      "licenseURL": "https://github.com/myorg/my-features/blob/main/LICENSE",
      "keywords": ["mytool", "cli"],
      "options": {
        "version": {
          "type": "string",
          "default": "latest",
          "description": "Version to install"
        }
      }
    }
  ]
}
```

Generate via CLI when you have 1 or more Features:

```sh
# generate or regenerate collection.json
devcontainer features publish --namespace ghcr.io/myorg/features --collection-only
cat collection.json | python3 -m json.tool | head -n 30
```

Done when: collection.json exists, parses, contains 1 entry per src/<id>/ with matching version, no stale versions. Gate: file missing or entry version mismatches src/<id>/devcontainer-feature.json, regenerate.

### 4. Publish via CLI or GH Action

Publish 1 tag per version. Push the semver tag plus floating tags :1 :1.0 :1.0.0 in the same operation. Use either local CLI or the GH Action devcontainers/action@v1. Require `GITHUB_TOKEN` with `packages: write` and `contents: read`.

Publish 1 Feature at a time with CLI. Publish the full collection with `--namespace` for monorepos.

```sh
# publish single Feature with CLI (prompts for namespace)
devcontainer features publish --namespace ghcr.io/myorg/features src/mytool

# publish full collection (monorepo with src/*)
devcontainer features publish --namespace ghcr.io/myorg/features

# publish with explicit registry login first
echo "$GH_TOKEN" | oras login ghcr.io -u myorg --password-stdin
echo "$GH_TOKEN" | docker login ghcr.io -u myorg --password-stdin
devcontainer features publish --namespace ghcr.io/myorg/features src/mytool
```

Automate with GitHub Actions using devcontainers/action@v1. Trigger on push to main when src/** changes. Publish only after tests pass.

```yaml
name: Publish Features
on:
  push:
    branches: [main]
    paths: ["src/**", "collection.json"]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devcontainers/action@v1
        with:
          publish-features: "true"
          base-path-to-features: "./src"
          generate-docs: "true"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

A second variation pins the action and publishes on release tags only:

```yaml
name: Publish on Release
on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devcontainers/action@v1
        with:
          publish-features: "true"
          base-path-to-features: "./src"
          generate-docs: "true"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Done when: CLI exits 0 and logs show `Published ghcr.io/myorg/features/mytool:1.2.3` plus floating tags, or GH Action job exits 0. Gate: CLI exits non-zero or GHCR returns 409 duplicate, abort and bump version.

### 5. Verify digest with oras

Fetch the manifest for the new tag. Confirm the digest resolves. Require 1 digest per published tag. Compare the digest printed at publish with the fetched digest.

Fetch 1 tag per verification. Verify 3 tags minimum: semver, major, and major.minor.

```sh
# fetch manifest and print digest
oras manifest fetch ghcr.io/myorg/features/mytool:1.2.3
oras manifest fetch ghcr.io/myorg/features/mytool:1.2
oras manifest fetch ghcr.io/myorg/features/mytool:1
oras manifest fetch ghcr.io/myorg/features/mytool:1.0

# descriptor output with digest
oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1.2.3 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['digest'])"

# pull and inspect (alternative)
oras pull ghcr.io/myorg/features/mytool:1.2.3 --format json | python3 -m json.tool
```

Done when: `oras manifest fetch` for semver tag exits 0, descriptor returns a sha256 digest, digest matches publish log. Gate: fetch fails or digest mismatches, treat publish as failed.

### 6. Set package visibility to public or internal

Set visibility after first publish. GHCR defaults to private. Expose Features only when you set public. Use `internal` for org-only access.

Set 1 visibility per package. Require `admin:packages` or org admin for visibility changes.

```sh
# set via gh CLI (package name is URL-encoded)
gh api --method PATCH /orgs/myorg/packages/container/features%2Fmytool/visibility -f visibility=public

# verify visibility
gh api /orgs/myorg/packages/container/features%2Fmytool | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['visibility'])"

# set to internal for org-only
gh api --method PATCH /orgs/myorg/packages/container/features%2Fmytool/visibility -f visibility=internal
```

A second example shows the failure when visibility stays private and consumers cannot pull:

```json
{
  "ref": "ghcr.io/myorg/features/mytool:1",
  "visibility": "private",
  "consumerError": "denied: installation not allowed to read from private registry without auth"
}
```

Done when: visibility reads `public` for open Features or `internal` for org Features, unauthenticated `oras manifest fetch` succeeds for public. Gate: private visibility when public expected, fix visibility before you announce.

## Acceptance Criteria

- Namespace matches ghcr.io/<owner>/features/<id>:<semver>, owner lowercase, id matches regex, no collision.
- Duplicate tag check runs before push, aborts when tag exists, avoids GHCR 409.
- collection.json exists, parses, lists every src/<id>/ with correct version and OCI ref.
- Publish uses devcontainer features publish CLI or devcontainers/action@v1 with packages: write, logs show semver plus floating tags.
- 3 oras manifest fetch commands succeed and digests match publish output for semver and floating tags.
- Package visibility set to public or internal, verified via gh api, unauthenticated pull succeeds for public.

## References

- [publishing-distribution](../references/publishing-distribution.md)
- [versioning](../references/versioning.md)
- [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- [github.com/devcontainers/action](https://github.com/devcontainers/action)
- [oras.land/docs](https://oras.land/docs/how_to_guides/manifest_fetch/)
