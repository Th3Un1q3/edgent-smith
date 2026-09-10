---
id: experiences-devcontainer-features-lifecycle
type: experiences
L0: "Devcontainer Features lifecycle: design → implement → test → publish → version/update → configure end-to-end (6 stages)"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: ".agents/skills/devcontainer-features workflows 6 stages + containers.dev specs"
claim_ids: ["devcontainer-features-lifecycle-claim", "oci-publish-claim", "semver-lifecycle-claim"]
---

# Devcontainer Features Lifecycle — End-to-End

**Use when:** running the full Feature lifecycle or any stage in order: design, implement, test, publish, version/update, configure.

## 1 Design → workflows/design-feature.md
- Choose options/dependsOn/installsAfter, scope containerEnv/customizations/mounts. Reference: feature-anatomy.md + repo-layout.md. Source: SKILL.md + platform-compatibility.md.
- Decision: monorepo vs scoped per repo-layout.md matrix. Source: references/repo-layout.md.

## 2 Implement → workflows/implement-feature.md
- Create `src/<id>/devcontainer-feature.json` (id kebab, semver, name) + `install.sh` (POSIX, idempotent, chown to _REMOTE_USER, exit non-zero). Source: mem:experiences/devcontainer-features-authoring.
- Handle OS/arch detection via /etc/os-release and uname -m normalization. Source: references/platform-compatibility.md.

## 3 Test → workflows/test-feature.md + references/testing-matrix.md
- Local: `devcontainer features test -f <id> -i <baseImage>` with scenarios.json matrix across ubuntu/debian/alpine. Source: feature-starter + containers.dev.
- Keep monorepo matrix ≤8 Features per run. Source: repo-layout.md CI trade-offs.

## 4 Publish → workflows/publish-feature.md + references/publishing-distribution.md
- OCI via oras media type `application/vnd.devcontainers.layer.v1+tar` to `ghcr.io/<owner>/<repo>/<id>:<semver>` with floating tags major/minor/latest. Source: mem:experiences/devcontainer-features-publishing.
- Alternative: `devcontainers/action@v1` publish-features:true or `devcontainer features publish -r ghcr.io`. Set GHCR visibility public after first push. Source: same.
- Collection: `collection.json` at src/collection.json pushed to ghcr.io/<namespace>:latest. Source: same.

## 5 Version/Update → workflows/version-and-update.md + references/versioning.md + recipes/bump-and-republish.md
- Semver required; exact x.y.z immutable, re-publish moves floating tags. Source: mem:experiences/devcontainer-features-versioning.
- Consumer pinning: :1 (major), :1.0 (minor), :1.0.0 (exact). Source: same.
- Recipe bump-and-republish handles tag moves.

## 6 Configure → workflows/configure-feature.md + references/configuring.md
- Consumer devcontainer.json features map with explicit pin; verify OCI digest before announce. Source: references/configuring.md + publishing-distribution.md.
- Lifecycle scope: install.sh root vs postCreateCommand user. Source: references/platform-compatibility.md.

## Related
- mem:experiences/devcontainer-features-skill-design — skill structure enabling this lifecycle
- mem:experiences/devcontainer-features-authoring — implement detail
- mem:experiences/devcontainer-features-publishing — publish detail
- mem:experiences/devcontainer-features-versioning — version detail
- mem:experiences/devcontainer-features-skill-coverage — gap now closed by this skill
