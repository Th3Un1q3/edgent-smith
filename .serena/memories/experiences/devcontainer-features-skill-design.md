---
id: experiences-devcontainer-features-skill-design
type: experiences
L0: "Devcontainer Features skill design: devcontainer-features modular skill with 6 workflows, 7 refs, platform and monorepo tradeoffs"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: ".agents/skills/devcontainer-features/SKILL.md + containers.dev/implementors/features + feature-starter"
claim_ids: ["devcontainer-features-skill-design-claim", "platform-compatibility-claim", "repo-layout-claim"]
---

# Devcontainer Features Skill Design

**Use when:** designing a new skill for devcontainer Features, choosing skill name, modular layout, platform scope, or repo layout tradeoffs.

## Design Decisions
- **Name:** `devcontainer-features` (noun+domain) — distinct from `devcontainers-best-practices` which covers general devcontainer.json/images. New skill owns Feature lifecycle end-to-end. Source: .agents/skills/devcontainer-features/SKILL.md:1
- **Version:** 1.0.0 delta — Initial shaped skill.
- **Shaped budget:** SKILL.md 71 lines (budget ≤160), workflows ≤120, references ≤120 per frontmatter.md shaping budgets.

## Modular Layout (6+7+2+1)
- **6 workflows:** `design-feature`, `implement-feature`, `test-feature`, `publish-feature`, `version-and-update`, `configure-feature` — maps 1:1 to lifecycle stages. Source: .agents/skills/devcontainer-features/SKILL.md routing table.
- **7 references:** `feature-anatomy`, `platform-compatibility`, `repo-layout`, `testing-matrix`, `publishing-distribution`, `versioning`, `configuring`. Each ≤120 lines.
- **2 recipes:** `add-feature-to-collection`, `bump-and-republish` — executable republish patterns.
- **1 script:** `validate-feature.sh` — local helper for `devcontainer-feature.json` + `install.sh` checks.

## Failure Mode
Fix broken, unportable, or unpublished Features that fail platform checks, lifecycle hooks, OCI publishing, or semver: use when user mentions `devcontainer-feature.json`, `install.sh`, `src/<id>/`, GHCR, oras, collection.json, dependsOn/installsAfter, scenarios, or pinning. Source: SKILL.md description field.

## Platform Considerations
- **OS detection:** source `/etc/os-release` (ID, VERSION_ID), fail on unsupported. Arch: `uname -m` → amd64/arm64. Source: references/platform-compatibility.md.
- **Shell:** `#!/usr/bin/env sh` POSIX only; Alpine ash has no bash. Avoid [[, ((, source. Source: same.
- **Package managers:** apk vs apt-get via ID check; clean apt cache. Source: same.
- **Base matrix:** ubuntu/debian/alpine with pinned digests. Source: same.
- **Lifecycle scope:** install.sh as root vs postCreateCommand as _REMOTE_USER. Source: same.

## Monorepo vs Scoped Tradeoffs
| Dimension | Monorepo (many src/<id>/) | Scoped (one src/<id>/) |
| Owners | team owns all | one owner per Feature |
| GHCR | ghcr.io/<owner>/<collection>/<id> | ghcr.io/<owner>/<id> |
| CI | matrix across Features | single job |
| Versioning | shared tagging, per-Feature bump | independent semver |
Source: references/repo-layout.md — pick monorepo for related Features, scoped for isolated tool.

## Related
- mem:experiences/devcontainer-features-lifecycle — end-to-end flow using this design
- mem:experiences/devcontainer-features-authoring — authoring detail
- mem:devcontainer-workflows/about — general workflows boundary
