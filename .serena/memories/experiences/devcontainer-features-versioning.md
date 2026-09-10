---
id: experiences-devcontainer-features-versioning
type: experiences
L0: "Dev container Feature versioning & consumer pinning: semver, OCI tags"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: "containers.dev/implementors/features + features-distribution"
claim_ids: ["semver-required-claim", "pinning-semantics-claim"]
---

# Dev Container Feature Versioning & Consumer Pinning

**Use when:** bumping Feature version, choosing consumer tag, or diagnosing duplicate-version rejection.

## Semver required
`version` in devcontainer-feature.json must be semver (MAJOR.MINOR.PATCH). Spec rejects non-semver. On publish, exact `x.y.z` tag is immutable — duplicate push fails. Source: containers.dev/implementors/features (semver required).

## OCI tag semantics
OCI registry after publish contains:
- `x.y.z` — exact, immutable
- `x.y` — floating minor (updated on patch/minor bump)
- `x` — floating major
- `latest` — most recent
Source: containers.dev/implementors/features-distribution (OCI tags).

## Consumer pinning
In devcontainer.json `features` map:
- `ghcr.io/owner/repo/id:1` → major (auto minor/patch)
- `.../id:1.0` → minor (auto patch)
- `.../id:1.0.0` → exact patch
- `.../id:latest` implicit if no tag; not recommended for reproducible builds
Pin `1` for agility, `1.0.0` for reproducibility per mem:tooling/deepseek-harness/install-pinning.

## Republish behavior
Re-publishing `1.2.4` moves `1`, `1.2`, `latest` to new digest but leaves `1.2.3` untouched. Major bump signals breaking change. Source: containers.dev/implementors/features-distribution.

## Related
- mem:experiences/devcontainer-features-publishing — publish flow
- mem:experiences/devcontainer-features-authoring — version field origin
- mem:researches/opencode/observability/devcontainer-version-pinning — pinning precedent