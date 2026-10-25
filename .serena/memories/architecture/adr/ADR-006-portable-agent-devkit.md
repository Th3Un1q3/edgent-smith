---
id: ADR-006
title: Portable agentic coding setup (agent-devkit) — configurable MCP/OpenCode/skills
status: proposed
date: 2026-10-24
scope: harness/tooling — portable Dev Container + OpenCode configuration
---

# ADR-006: Portable agentic coding setup (agent-devkit)

## Decision

Adopt agent-devkit: a public, MIT-licensed repository delivering a portable OpenCode setup through a Dev Container Feature on stock base images, consumed via a per-project devcontainer.json emitted by a scaffolder CLI (devkit init). MCP config, OpenCode config, and skills are all configurable per project through Feature options, scaffolder flags, and override files; versions are pinned and bumped by automation. Dev Container Feature is the primary delivery mechanism, with documented fallbacks (prebuilt OCI image, Dockerfile bake, postCreateCommand, host bootstrap, package-manager distribution, template repository) selected by project constraints.

## Considerations

### Context

- Personal-first setup, shareable later; public GitHub repo, MIT; GHCR hosts artifacts.
- Must work across machines and projects; OpenCode is the only target harness; Docker and Dev Container hosts only.
- Contents extracted from edgent-smith: skills, harness config (rug* agents), MCP wiring.
- Deferred with seams: project instructions/commands, toolchain provisioning, secrets tooling, templates, memory.
- Prior research favored a prebuilt harness image; this decision revises that toward stock-base composition (Option B).
- Refinement (2026-10-24): make MCP config, OpenCode config, and skills fully configurable rather than baked-in; evaluate alternatives to Dev Container Features.

### Configurability (all three components)

- MCP config: sanitized catalog shipped by agent-devkit; per-project enable/override via Feature option + compose; credentials machine-local, referenced by env-var name only; gateway sidecar via project compose.
- OpenCode config: project opencode.jsonc (instructions array, AGENTS.md) plus global ~/.config/opencode (service.json); Feature installs pinned OpenCode, rug* agents, and loader; session-scoped instruction entries via API.
- Skills: baked at build time from edgent-smith at a pinned commit; filtered per project via Feature option (default all); land at ~/.config/opencode/skills/<name>/SKILL.md; skills-loader repointed from project .agents/skills to global path; project .agents/skills remains for project-specific overrides.
- Mechanisms: Feature options (skills selection, MCP servers, versions); scaffolder emits devcontainer.json, compose, and config stubs with flags; per-project override files; env-var credentials.

### Prerequisites

- Sanitize edgent-smith skills upstream: remove ~103 absolute refs across 23 files (path-agnostic content, env vars for host endpoints).
- Add MIT LICENSE upstream (build-plan prerequisite).
- Base images must be Feature-capable (Debian/Ubuntu devcontainer bases).

### Options considered (delivery mechanism)

#### Option A: Prebuilt OCI harness image + spec + Features
Pros: pinned baseline; fast container start; known-good image.
Cons: image rebuild for any baseline change; extra CI pipeline; Features cannot install after baked Features.

#### Option B: Spec + Features on stock base images [chosen]
Pros: no image pipeline; stock-base updates free; maximum per-project composition; one artifact type.
Cons: build-time network pull of skills; slower start than a prebuilt image.

#### Option C: Prebuilt image only
Pros: single pinned artifact; simplest per-project file.
Cons: no per-project composition; every tweak means rebuild and republish.

#### Option D: Host bootstrap script (no container)
Pros: trivial to write; no Docker dependency.
Cons: machine drift; no cross-machine reproducibility.

#### Option E: Dockerfile bake (COPY skills/config into image)
Pros: full control; no registry pull at build.
Cons: per-project image build; loses Feature caching/locking; slower iteration.

#### Option F: postCreateCommand install (npm/curl)
Pros: uses actual node; simple.
Cons: runs only on create/rebuild; not cached or pinnable; network at rebuild.

#### Option G: Package-manager distribution (npm/pip/uv)
Pros: portable beyond containers; familiar tooling.
Cons: no isolation; version drift; not reproducible across hosts.

#### Option H: Template repository / git submodule
Pros: versioned via git; easy to fork.
Cons: no build-time guarantee; merge conflicts on update; manual sync.

### Scoring

Criteria (-2..+2; for cost, +2 = lowest cost): Maintainability; Flexibility; Implementation ease; Initial implementation cost.

| Criteria | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Maintainability | 1 | 2 | 1 | -2 | 1 | 0 | -1 | 0 |
| Flexibility | 1 | 2 | -1 | -2 | 0 | 0 | 1 | 1 |
| Implementation ease | -1 | 1 | 0 | 2 | -1 | 1 | 1 | 0 |
| Initial implementation cost | -1 | 1 | -1 | 2 | -1 | 1 | 1 | 1 |
| Total | 0 | 6 | -1 | 0 | -1 | 2 | 2 | 2 |

Highest total: Option B (6). No override. Alternatives E/F/G/H documented for constraint-driven selection (e.g., air-gapped hosts -> E; non-container hosts -> G; fastest start -> A/C).

### Consequences

- agent-devkit publishes one Dev Container Feature (with options) to GHCR; the harness layer installs at container build on a stock base.
- Skills bake to ~/.config/opencode/skills/<name>/SKILL.md; install-time filter via Feature option (default all).
- edgent-smith skills-loader repointed to the global path.
- MCP: gateway sidecar via project compose; sanitized catalog shipped by agent-devkit; per-project enable/override; credentials machine-local by env-var name.
- Scaffolder: devkit init emits devcontainer.json, compose, and config stubs with option flags.
- Deferred with seams and known gaps: project instructions/commands; toolchain provisioning; secrets tooling; templates; memory; no SKILL.md linter; OpenCode permission.ask gap; OTel naming instability; compose feature-publish caveat (cli #900) to validate at build; base images must be Feature-capable (Debian/Ubuntu).

### Alternatives selection guidance

- Air-gapped / no network at build -> Option E (Dockerfile bake) with vendored skills.
- Non-container hosts -> Option G (package-manager) or Option D (host bootstrap) with drift acceptance.
- Fastest container start / stable baseline -> Option A or C (prebuilt image).
- Maximum per-project composition (default) -> Option B.

END ADR-006 — 1 memory