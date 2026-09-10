---
id: experiences-devcontainer-features-skill-coverage
type: experiences
L0: "Dev container Features skill coverage: gap closed 2026-09-08 by devcontainer-features skill (6 workflows, 7 refs)"
hotness: 0.85
ttl: 180d
version: 2
freshness: 2026-09-08
directory: experiences/devcontainer-features
provenance: "41 skills inventory + .agents/skills/devcontainer-features/SKILL.md verification 2026-09-08"
claim_ids: ["skill-coverage-41-claim", "publish-workflow-gap-closed-claim", "devcontainer-features-skill-design-claim"]
---

# Dev Container Features Skill Coverage Assessment

**Use when:** deciding which skill to load for Feature work.

## Inventory (2026-09-08 update)
Project has 42 skills (41 → 42). Two Features-relevant skills now exist. Source: .agents/skills directory listing 2026-09-08.
- `devcontainers-best-practices` — general devcontainer.json/images, reference-level Features guidance.
- `devcontainer-features` (new) — end-to-end Feature lifecycle. Source: .agents/skills/devcontainer-features/SKILL.md:1-8.

## What devcontainers-best-practices covers
- Feature vs Template vs Definition distinction
- Feature repo structure and devcontainer-feature.json fields
- OCI distribution basics and GHCR path
- Reference to containers.dev specs (Source: containers.dev/implementors/features/, /features-distribution/)

## Gap Closed 2026-09-08
Previous gap: No executable publish workflow — only reference. Missing oras script, GH Action, collection handling, CI matrix. Consequence: manual copy-paste.

**Resolution:** New skill `devcontainer-features` 1.0.0 delivers:
- 6 workflows: design-feature, implement-feature, test-feature, publish-feature, version-and-update, configure-feature
- 7 references: feature-anatomy, platform-compatibility, repo-layout, testing-matrix, publishing-distribution, versioning, configuring
- 2 recipes: add-feature-to-collection, bump-and-republish
- 1 script: validate-feature.sh
Source: .agents/skills/devcontainer-features/SKILL.md routing table + workflows/ directory.

Publish workflow now executable: oras OCI publish, devcontainers/action@v1 with packages:write, GHCR public visibility step, local devcontainer features publish CLI, scenarios matrix. Source: workflows/publish-feature.md + references/publishing-distribution.md.

## Superseded Recommendation
Original recommendation (add workflow to devcontainers-best-practices) superseded — shaped modular skill created instead. Rationale: lifecycle exceeds 120-line budget, needed 6 workflows; avoids overloading general skill. Source: skill decision per Task: design modular layout 6+7+2+1.

## Related
- mem:experiences/devcontainer-features-skill-design — design decisions for new skill
- mem:experiences/devcontainer-features-lifecycle — 6-stage end-to-end flow
- mem:experiences/devcontainer-features-authoring — authoring is covered
- mem:experiences/devcontainer-features-publishing — publish detail
- mem:experiences/devcontainer-features-versioning — version detail
