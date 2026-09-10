---
name: devcontainer-features
description: "Fix broken, unportable, or unpublished devcontainer Features that fail platform checks, lifecycle hooks, OCI publishing, or semver: use when the user wants to design, implement, test, publish, version, update, or configure a devcontainer Feature, mentions devcontainer-feature.json, install.sh, src/<id>/, monorepo vs scoped repo, GHCR, oras, collection.json, dependsOn, installsAfter, scenarios, feature-starter, devcontainer features test, or pinning floating tags."
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: "1.0.0 — Initial shaped skill: 6 workflows (design/implement/test/publish/version-and-update/configure), 7 references, 2 recipes, 1 validate helper; fixes unportable/unpublished Feature failure with platform checks, OCI publishing, semver."
---

# Devcontainer Features

Design, implement, test, publish, version, and configure portable devcontainer Features that pass platform checks and OCI publishing.

## When to Use This Skill

Invoke this skill when:
- Design a new Feature or choose options and dependencies
- Implement install.sh and devcontainer-feature.json in src/<id>/
- Test a Feature with scenarios or devcontainer features test
- Publish a Feature to GHCR via OCI with oras
- Version a Feature with semver or cut a release
- Update an existing Feature or fix a broken install
- Configure a published Feature in devcontainer.json with pinning

## When Not to Use This Skill

Do not use this skill for:
- General devcontainer.json editing or image selection — use `devcontainers-best-practices`
- Researching unrelated libraries or tools — use `context-gathering`
- Cross-session memory or preferences — use `serena-memory`

## Principles

- Validate platform compatibility before publishing — see [platform-compatibility](./references/platform-compatibility.md)
- Pin dependencies to immutable digests — see [publishing-distribution](./references/publishing-distribution.md)
- Keep install scripts idempotent and non-interactive — see [feature-anatomy](./references/feature-anatomy.md)
- Test every Feature in isolated scenarios — see [testing-matrix](./references/testing-matrix.md)
- Choose monorepo or scoped repo explicitly — see [repo-layout](./references/repo-layout.md)
- Version with semver and document breaking changes — see [versioning](./references/versioning.md)
- Configure consumers with explicit version pins — see [configuring](./references/configuring.md)
- Verify OCI artifacts before announcing — see [publishing-distribution](./references/publishing-distribution.md)

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Design a new Feature | [workflows/design-feature.md](./workflows/design-feature.md) |
| Implement install.sh and metadata | [workflows/implement-feature.md](./workflows/implement-feature.md) |
| Test a Feature in scenarios | [workflows/test-feature.md](./workflows/test-feature.md) |
| Publish a Feature to GHCR | [workflows/publish-feature.md](./workflows/publish-feature.md) |
| Version or update a Feature | [workflows/version-and-update.md](./workflows/version-and-update.md) |
| Configure a Feature in a devcontainer | [workflows/configure-feature.md](./workflows/configure-feature.md) |
| Learn Feature file anatomy | [references/feature-anatomy.md](./references/feature-anatomy.md) |
| Check platform compatibility | [references/platform-compatibility.md](./references/platform-compatibility.md) |
| Choose repo layout | [references/repo-layout.md](./references/repo-layout.md) |
| Look up testing matrix | [references/testing-matrix.md](./references/testing-matrix.md) |
| Look up publishing and distribution | [references/publishing-distribution.md](./references/publishing-distribution.md) |
| Look up versioning rules | [references/versioning.md](./references/versioning.md) |
| Look up configuring options | [references/configuring.md](./references/configuring.md) |
| Add a Feature to a collection | [recipes/add-feature-to-collection.md](./recipes/add-feature-to-collection.md) |
| Bump version and republish | [recipes/bump-and-republish.md](./recipes/bump-and-republish.md) |
| Validate a Feature locally | [scripts/validate-feature.sh](./scripts/validate-feature.sh) |

## Related Skills

- `devcontainers-best-practices` — general devcontainer.json and image guidance
- `context-gathering` — research for external tools and docs
- `serena-memory` — persistent memory across sessions
