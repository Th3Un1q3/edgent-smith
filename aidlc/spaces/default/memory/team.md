# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- CI runs on `push` and `pull_request` targeting `main`, plus `workflow_dispatch`. (.github/workflows/ci.yml:8-12)
- A same-repo PR fires both `push` and `pull_request` for one branch update. (.github/workflows/ci.yml:13)
- Remote PR CI runs `just ci` verbatim, so the script, recipe and workflow change together. (scripts/ci.sh:8-10)
- Committing is gated on `just verify-agents` printing `── verify-agents: PASS ──`. (justfiles.instructions.md:28)
- No gated write without explicit per-session authorization; an inferred goal is not authorization. (no-permission-workarounds.instructions.md:18)
- Branch naming and commit-message rules are convention, none stated; PR template exists, not a rule. (.github/PULL_REQUEST_TEMPLATE/experiment_promotion.md)

## Walking Skeleton

- Walking skeleton is per-scope: shipped scopes (feature, mvp, poc, workshop, enterprise, infra) set `skeleton: on`. (`.aidlc/scopes/aidlc-feature.md:6`)
- The framework enables it only when the active scope declares `skeleton: on`. (aidlc/active-memory/org.md:34)
- No project scope declares `skeleton: on`; `.aidlc/scopes/` holds only the 11 shipped `aidlc-*.md` files. (.aidlc/scopes/)

## Testing Posture

- **Methodology**: tdd
- **Methodology evidence**: — chosen because an implementation change is barred until a failing test exists. (tdd-enforcement.instructions.md:15)
- **Ordering**: failing test first per behaviour, then implementation; cross-module changes get a boundary test. (tdd-enforcement.instructions.md:15-16)
- No implementation change lands until a failing test exists. (tdd-enforcement.instructions.md:15)
- Tests, lint and typecheck run only via `just`; raw `pytest`, `npm test`, `vitest`, `bun` and `tsc` are banned. (test-run-commands.instructions.md:27)
- Per-file verification is mandatory before the next file; a file is not done until its check passes. (test-run-commands.instructions.md:35-37)
- A unit test is deterministic and hermetic: no service, network, model call, env-var gate or skip. (live-verification.instructions.md:12)
- GAP: no Python coverage floor exists; no `--cov` or `fail_under` in pyproject.toml or justfile, and coverage is gated only for TypeScript. (scripts/ci.sh:74)

## Guard Policy

<!-- Affirmed by the team. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless project.md or the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- 13 CI gates run in a fixed order in `scripts/ci.sh`, from verify-thresholds through opencode-mutation. (scripts/ci.sh:65-76,83)
- The mutation gate is conditional: skipped on `SKIP_MUTATION=1` or `CI_FAST=1`, else wrapped in a `timeout`. (scripts/ci.sh:77-94)
- `just ci-fast` is the ~20s path for docs/yml/justfile-only changes. (justfile:43-46)
- Threshold pinning is gate 0 and fail-closed through `scripts/verify_thresholds.sh`. (scripts/ci.sh:65)
- Gate count reads two ways: header and justfile say 13; a skipped mutation gate records `pass`, so 12 execute. (scripts/ci.sh:2-6,84-86; justfile:37)
- Deployment target reads two ways: framework text claims deploy-on-merge to staging with manual production approval. (aidlc/active-memory/org.md § Deployment)
- No deploy job exists: CI defines only `prebuild-devcontainer` and `ci`. (.github/workflows/ci.yml:20,51)

## Code Style

- The formatter is `ruff format`; `just format` adds `ruff check --fix`, with check-only at `justfile:54-55`. (justfile:49-51)
- ruff: `line-length = 100`, `target-version = "py313"`, lint set includes `C901`, `S`, `SIM`, `UP`. (pyproject.toml:32-38)
- Cyclomatic limit `max-complexity = 10`. (pyproject.toml:44-45)
- mypy `strict = true`, `python_version = "3.13"`, `tests/` excluded. (pyproject.toml:47-52)
- Test asserts are exempt from ruff `S101` under `**/tests/**`. (pyproject.toml:41-42)
- Keep and rewrite a comment a tool displays; delete a docstring that restates its name. (comments.instructions.md:18,250)
- Naming is language-idiomatic (snake_case Python) — convention. (aidlc/active-memory/org.md:108)
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
