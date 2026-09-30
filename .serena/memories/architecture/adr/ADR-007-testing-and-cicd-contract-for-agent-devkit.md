---
id: ADR-007
title: Testing and CI/CD contract for agent-devkit
status: proposed
date: 2026-09-30
scope: harness/tooling — testing and delivery pipeline for agent-devkit
---
# ADR-007: Testing and CI/CD contract for agent-devkit

## Decision
Adopt a tiered, deterministic testing contract for agent-devkit: static checks and the Dev Container Feature test matrix run on every PR; container integration (devcontainer up, named-subset skill discovery, agent and config assertions) runs on main and nightly; releases publish the Feature to GHCR and verify the published artifact from a scratch consumer; model-backed canary runs and gateway connectivity checks are deliberately deferred, with a local devkit doctor as the stopgap. Consuming projects receive Feature pin updates via a scaffolded Dependabot devcontainers entry.

## Considerations

### Context
- agent-devkit (ADR-006): Feature on stock bases, baked skills, gateway sidecar, scaffolder CLI, public GHCR artifacts.
- Feedback speed and reliability are primary; fork PRs never receive secrets; model calls cost money; the MCP gateway needs privileged DinD plus secrets.
- edgent-smith's CI patterns (build once, GHCR cacheFrom, fork guard, aggregated gates, concurrency cancel) are proven and portable.
- Verified mechanics: feature tests use test/<id>/test.sh plus scenarios.json via devcontainer features test; publishing via devcontainer features publish or devcontainers/action; OpenCode introspection via debug skill, agent list, mcp list; no gateway /health endpoint; Dependabot devcontainers ecosystem updates Feature refs only.

### Options considered
#### Option A: Tiered deterministic gates; deep checks deferred  [chosen]
Pros: fast, fork-safe, deterministic; no secrets/DinD/model plumbing; deep checks plug in behind the same tiers later.
Cons: CI does not directly prove a skill is model-usable or the gateway connects; those remain local/manual until added.
#### Option B: Full e2e (canary + gateway) on every PR
Pros: strongest per-PR signal.
Cons: structurally impossible on fork PRs (no secrets); slow and flaky; model cost per PR.
#### Option C: Canary + gateway on main and nightly
Pros: regularly proves the two deep behaviors.
Cons: requires secrets, privileged DinD, model budget, and a runner story now; deferred by choice.
#### Option D: Lint only, manual releases
Pros: cheapest.
Cons: no protection against known drift classes (paths, options, pins); releases unverified.

### Scoring
Criteria (-2..+2; for cost, +2 = lowest cost): Maintainability; Flexibility; Implementation ease; Initial implementation cost.
| Criteria | A | B | C | D |
|---|---|---|---|---|
| Maintainability | 2 | -2 | 1 | 0 |
| Flexibility | 1 | 2 | 2 | -2 |
| Implementation ease | 2 | -1 | 0 | 2 |
| Initial implementation cost | 2 | -1 | 0 | 2 |
| Total | 7 | -2 | 3 | 2 |

Highest total: Option A. No override.

### Consequences
- PR lane (pr.yml): shellcheck; devcontainer-feature.json schema (ajv); scaffolded devcontainer.json schema; SKILL.md frontmatter linter; path-agnostic guard (fails on /workspace, localhost, host.docker.internal, absolute home refs outside env vars); pin audit (base digests, actions by SHA, edgent-smith commit, OpenCode version); scaffolder golden files. Then the feature test matrix: ubuntu 24.04, debian bookworm, a non-root scenario, and a composition scenario with a public toolchain feature; alpine deferred (musl unconfirmed). Target under 5 minutes warm; cancel-in-progress.
- Integration lane (e2e.yml; main, nightly, dispatch): devcontainer up from a scaffolded scratch project; opencode debug skill named-subset assertion (never counts); agent list and config assertions; no model calls, no gateway traffic.
- Release lane (release.yml; tag v*): validate metadata and version; publish via devcontainers/action pinned by SHA with GITHUB_TOKEN packages: write; flip GHCR visibility public (user namespace); consume the published ref from a scratch project and re-run the deterministic subset; release notes.
- Pin flow (bump.yml; scheduled): tested PRs for edgent-smith commit, OpenCode releases, and base image digests.
- Consumer side: scaffolder emits .github/dependabot.yml with package-ecosystem: devcontainers (Features only, latest major pins, lockfile-aware; base images need the docker ecosystem or Renovate, documented).
- Deferred with seams: model-backed canary run; gateway connectivity smoke (privileged DinD + secrets); alpine and arm64 matrix; consumer reusable CI workflow; agents-in-CI jobs. Local stopgap: devkit doctor runs the canary and mcp list outside CI. Flake policy: deterministic tiers must not retry; anything needing retries belongs in nightly.