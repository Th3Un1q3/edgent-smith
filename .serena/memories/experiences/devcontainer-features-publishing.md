---
id: experiences-devcontainer-features-publishing
type: experiences
L0: "Dev container Feature publishing & distribution: OCI, GHCR, collection, refs"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: "containers.dev/implementors/features-distribution + devcontainers/action"
claim_ids: ["oci-artifact-media-type-claim", "ghcr-namespace-claim"]
---

# Dev Container Feature Publishing & Distribution

**Use when:** publishing a Feature to GHCR/OCI, wiring GH Action, or referencing a Feature via ociReference/HTTPS/local.

## OCI publish
Features are OCI artifacts via `oras` with media type `application/vnd.devcontainers.layer.v1+tar`. Registry path: `ghcr.io/<owner>/<repo>/<id>:<semver>` plus auto-pushed tags `major`, `major.minor`, `latest`. Duplicate exact version is rejected; re-publish moves floating tags. Source: containers.dev/implementors/features-distribution.

## Collection
`collection.json` pushed to `ghcr.io/<namespace>:latest` via `dev.containers.metadata` annotation. Namespace = `owner/repo`. Consumer resolves via `ociReference` in collection-index.yml.

## GH Action
`devcontainers/action@v1` with `publish-features: "true"`, `base-path-to-features: "./src"`, needs `packages: write`. Alternative CLI: `devcontainer features publish -r ghcr.io -n <owner>/<repo> ./src/<id>`. GHCR is private by default — set visibility public after first push.

## Distribution refs
Three valid consumer refs: OCI `ghcr.io/...`, direct HTTPS tarball `https://.../*.tgz`, local `./src/<id>` (no publish). All resolve via Features spec.

## Related
- mem:experiences/devcontainer-features-authoring — create before publish
- mem:experiences/devcontainer-features-versioning — tag semantics
- mem:devcontainer-workflows/secrets-dependencies — GHCR token hygiene