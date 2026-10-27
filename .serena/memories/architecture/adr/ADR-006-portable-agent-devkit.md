---
id: ADR-006
title: Portable agentic coding setup (agent-devkit) — configurable MCP/OpenCode/skills
status: proposed
date: 2026-10-24
scope: harness/tooling — portable Dev Container + OpenCode configuration
---

# ADR-006: Portable agentic coding setup (agent-devkit)

## Decision

Adopt agent-devkit: a public, MIT-licensed repository delivering a portable OpenCode setup through a Dev Container Feature on stock base images, consumed via a per-project devcontainer.json emitted by a scaffolder CLI (devkit init). MCP config, OpenCode config, and skills are all configurable per project through Feature options, scaffolder flags, and override files; versions are pinned and bumped by automation. Dev Container Feature is the primary delivery mechanism, with documented fallbacks (prebuilt OCI image, Dockerfile bake, postCreateCommand, host bootstrap, package-manager distribution, template repository) selected by project constraints. Portability applies to config artifacts; secrets and memories remain machine-local (see Portability boundary).

## Considerations

### Context

- Personal-first setup, shareable later; public GitHub repo, MIT; GHCR hosts artifacts.
- Must work across machines and projects; OpenCode is the only target harness; Docker and Dev Container hosts only.
- Contents extracted from edgent-smith: skills, harness config (rug* agents), MCP wiring.
- Deferred with seams: project instructions/commands, toolchain provisioning, secrets tooling, templates, memory (see Deferred items table).
- Prior research favored a prebuilt harness image; this decision revises that toward stock-base composition (Option B).
- Refinement (2026-10-24): make MCP config, OpenCode config, and skills fully configurable rather than baked-in; evaluate alternatives to Dev Container Features.
- Scope note: "personal-first" means single-developer consumption today. Promotion to CI/team-ready requires the promotion checklist (see Consequences) to be satisfied; until then, claims of CI-readiness are out of scope.

### Portability boundary

- Portable: config artifacts (devcontainer.json, Feature options, compose, opencode.jsonc, sanitized MCP catalog, skill selection).
- Machine-local (NOT portable): secrets/credentials (provisioned per host out of band, referenced by env-var name only) and Serena memories (machine-local state; no export/import seam yet). No secrets tooling or memory export ships yet (deferred). Two machines with identical repo state can fail differently if local env or memory state differs; CI/multi-user consumption requires per-machine provisioning that this design does not provide. Cross-ref deferred "secrets tooling" and "memory."

### Configurability (all three components)

- MCP config: sanitized catalog shipped by agent-devkit; per-project enable/override via Feature option + compose; credentials machine-local, referenced by env-var name only; gateway sidecar via project compose.
- OpenCode config: project opencode.jsonc (instructions array, AGENTS.md) plus global ~/.config/opencode (service.json); Feature installs pinned OpenCode, rug* agents, and loader; session-scoped instruction entries via API.
- Skills: baked at build time from edgent-smith at a pinned commit; filtered per project via Feature option (default all); land at ~/.config/opencode/skills/<name>/SKILL.md; skills-loader repointed from project .agents/skills to global path; project .agents/skills remains for project-specific overrides.
- Mechanisms: Feature options (skills selection, MCP servers, versions); scaffolder emits devcontainer.json, compose, and config stubs with flags; per-project override files; env-var credentials.
- Secret-commit guard: templates reference env-vars only (never literal secrets); scaffolder adds .gitignore entries for local secret files and a secret-scan/pre-commit guard so secrets are not committed into config stubs.

### Prerequisites

- Sanitize edgent-smith skills upstream: remove ~103 absolute refs across 23 files (path-agnostic content, env vars for host endpoints). FALLBACK: if upstream delays, a build-time sanitization transform/patch layer in agent-devkit performs the rewrite so the build is not blocked; upstream sanitize becomes preferred, not required. The transform MUST pass a golden-diff + skill-validation test gate before release (no silent breakage of skill links/fences/examples).
- Add MIT LICENSE upstream (build-plan prerequisite).
- Base images must be Feature-capable (Debian/Ubuntu devcontainer bases). This is a NON-NEGOTIABLE constraint. Alpine (musl) is not confirmed Feature-capable — route Alpine consumers to Option E (Dockerfile bake) with a published compatibility statement and an optional, non-blocking best-effort smoke test; distroless is unsupported. Consumer compatibility statement must be published with the Feature.

### Deferred items (item | seam | owner | fallback)

| Item | Seam | Owner | Fallback |
|---|---|---|---|
| Project instructions/commands | opencode.jsonc instructions array + AGENTS.md + session-scoped entries | scaffolder | manual config |
| Toolchain provisioning | composition with public toolchain Feature | consumer | postCreateCommand |
| Secrets tooling | env-var indirection (machine-local) | deferred (no owner yet) | manual provisioning |
| Templates | none specified | deferred | none — accept risk |
| Memory | none specified (machine-local; no export/import seam) | deferred | none — accept risk; classify as machine-local in Portability boundary |
| SKILL.md linter | ADR-007 PR lane (frontmatter linter) | ADR-007 owner | manual review |
| OpenCode permission.ask gap | none specified | deferred | accept risk |
| OTel naming instability | none specified | deferred | accept risk |
| Compose feature-publish caveat (cli #900) | release-blocking gate (see Consequences) | release lane | Option A/E if it fails |

### Options considered (delivery mechanism)

#### Option A: Prebuilt OCI harness image + spec + Features
Pros: pinned baseline; fast container start; known-good image.
Cons: image rebuild for any baseline change; extra CI pipeline; Features cannot install after baked Features.

#### Option B: Spec + Features on stock base images [chosen]
Pros: no image pipeline; stock-base updates free; maximum per-project composition; one artifact type.
Cons: build-time network pull of skills; slower start than a prebuilt image; offline/air-gapped builds need Option E. Build-time network liability: portable config assumes network at build; for air-gapped hosts use Option E (Dockerfile bake) with vendored skills.

#### Option C: Prebuilt image only
Pros: single pinned artifact; simplest per-project file.
Cons: no per-project composition; every tweak means rebuild and republish.

#### Option D: Host bootstrap script (no container)
Pros: trivial to write; no Docker dependency.
Cons: machine drift; no cross-machine reproducibility.

#### Option E: Dockerfile bake (COPY skills/config into image)
Pros: full control; no registry pull at build; works air-gapped.
Cons: per-project image build; loses Feature caching/locking; slower iteration.

#### Option F: postCreateCommand install (npm/curl)
Pros: uses actual node; simple.
Cons: runs only on create/rebuild; not cached or pinnable; network at rebuild.

#### Option G: Package-manager distribution (npm/pip/uv)
Pros: portable beyond containers; familiar tooling.
Cons: no isolation; version drift; not reproducible across hosts; still requires network.

#### Option H: Template repository / git submodule
Pros: versioned via git; easy to fork.
Cons: no build-time guarantee; merge conflicts on update; manual sync.

### Scoring

Criteria (-2..+2; for cost, +2 = lowest cost): Maintainability; Flexibility; Implementation ease; Initial implementation cost. (Fixed set per ADR rules; build-time network/offline liability is documented in Option B's Cons and Alternatives guidance rather than as a fifth scored criterion, to preserve comparability across ADRs.)

| Criteria | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Maintainability | 1 | 2 | 1 | -2 | 1 | 0 | -1 | 0 |
| Flexibility | 1 | 2 | -1 | -2 | 0 | 0 | 1 | 1 |
| Implementation ease | -1 | 1 | 0 | 2 | -1 | 1 | 1 | 0 |
| Initial implementation cost | -1 | 1 | -1 | 2 | -1 | 1 | 1 | 1 |
| Total | 0 | 6 | -1 | 0 | -1 | 2 | 2 | 2 |

Highest total: Option B (6). No override. Note: the build-time network/offline liability (raised in grilling) is documented in Option B's Cons and the Alternatives selection guidance rather than as a scored criterion, to preserve comparability across ADRs per ADR rules. Alternatives E/F/G/H documented for constraint-driven selection (e.g., air-gapped hosts -> E; non-container hosts -> G; fastest start -> A/C).

### Consequences

- agent-devkit publishes one Dev Container Feature (with options) to GHCR; the harness layer installs at container build on a stock base.
- Skills bake to ~/.config/opencode/skills/<name>/SKILL.md; install-time filter via Feature option (default all).
- edgent-smith skills-loader repointed to the global path.
- MCP: gateway sidecar via project compose; sanitized catalog shipped by agent-devkit; per-project enable/override; credentials machine-local by env-var name.
- Scaffolder: devkit init emits devcontainer.json, compose, and config stubs with option flags. Templates reference env-vars only; .gitignore entries and a secret-scan/pre-commit guard prevent secret commits. Scaffolder output documents the interim local-Feature-ref path (see below).
- Build order / consumable-when: Feature (local ./src/<id> ref first) -> scaffolder -> GHCR publish -> consumer adoption. Interim path: consume via local Feature ref until GHCR artifact exists; exact command and prerequisites (devcontainers CLI, base image, Feature source path) are printed by devkit init --local and verified offline.
- Compose feature-publish (cli #900): classified as a RELEASE-BLOCKING gate in the release lane. If it fails, fall back to Option A (prebuilt image) or Option E (Dockerfile bake) for compose sidecar delivery; do not ship compose sidecar on an unvalidated path.
- Deferred with seams and known gaps: see Deferred items table. Templates and memory have no seam and are accepted risks (memory classified as machine-local in Portability boundary).
- Base images must be Feature-capable (Debian/Ubuntu); see Prerequisites (non-negotiable).
- Promotion checklist (personal-first -> CI/team-ready): secrets tooling (machine-local provisioning documented + guard), consumer CI workflow (smoke test from scratch consumer), governance (GHCR namespace ownership, license compliance, consumer version-pinning policy, secret rotation, support/SLA). All must be satisfied before any CI-readiness claim.

### Alternatives selection guidance

- Air-gapped / no network at build -> Option E (Dockerfile bake) with vendored skills.
- Non-container hosts -> Option G (package-manager) or Option D (host bootstrap) with drift acceptance.
- Fastest container start / stable baseline -> Option A or C (prebuilt image).
- Maximum per-project composition (default) -> Option B.

END ADR-006 — 1 memory