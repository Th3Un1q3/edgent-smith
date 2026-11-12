# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

- Python `>=3.13`: `pyproject.toml:10`; ruff target `py313`: `pyproject.toml:34`.
- Runtime deps `pydantic>=2,<3`, `pydantic-ai[evals]>=0.0.14`, `httpx>=0.27`: `pyproject.toml:13-18`.
- CLI framework Click `>=8.1,<10`: `pyproject.toml:13-18`; corroborated by `mem:claims/edgent-smith-click-cli-dependency`.
- Dev deps `pytest>=8.2`, `pytest-asyncio>=0.23`, `anyio>=4.4`, `ruff>=0.4`, `mypy>=1.10`: `pyproject.toml:20-27`.
- Build: hatchling; wheels from `agents`, `evals`, `cli`: `pyproject.toml:1-3,29-30`.
- Task runner `just`, root imports 7 modules; Python calls via `uv run`: `justfile:10-16,18-21`.
- DevContainer: Python 3.13 and Ollama port 11434 (`.devcontainer/devcontainer.json:12-13,59-60`); CI builds the image (`.github/workflows/ci.yml:47`).

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

NEVER use a `src/` layout; `agents`, `cli` and `evals` stay at the repo root. (AGENTS.md:140) (affirmed 2026-11-10)

NEVER activate a virtualenv manually. (AGENTS.md:141) (affirmed 2026-11-10)

NEVER duplicate command logic; shared setup moves to `cli/services/`. (AGENTS.md:142) (affirmed 2026-11-10)

NEVER add generic documentation such as "how to install python" to project files. (AGENTS.md:143) (affirmed 2026-11-10)

NEVER read, `ls` or `grep` `.serena/memories/*` from the filesystem. (AGENTS.md:124) (affirmed 2026-11-10)

NEVER reproduce a gated action via a wrapper, subprocess, alternate tool or other path. (no-permission-workarounds.instructions.md:17) (affirmed 2026-11-10)

NEVER lower a threshold, replace a pinned number or downgrade an error to `warn`. (threshold-policy.instructions.md:11) (affirmed 2026-11-10)

NEVER add a scoped recipe to the root `justfile`. (justfiles.instructions.md:20) (affirmed 2026-11-10)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

ALWAYS treat `.opencode/instructions/*.instructions.md` as binding: read the matching file before editing that type. (AGENTS.md:147) (affirmed 2026-11-10)

ALWAYS reach memory through the Serena gateway, never through the filesystem. (AGENTS.md:124) (affirmed 2026-11-10)

ALWAYS pass a skill or agent-definition edit through the contradiction sweep before calling it done. (AGENTS.md:126) (affirmed 2026-11-10)

ALWAYS route every file added under a skill directory from that skill's SKILL.md Task Routing Table in the same edit. (shaping.instructions.md:11) (affirmed 2026-11-10)

ALWAYS justify a threshold change in writing with before/after measurement, then re-run its verification. (threshold-policy.instructions.md:14-15) (affirmed 2026-11-10)

ALWAYS name the exact `just` recipe attempted and quote its output when returning an unverifiable verdict. (test-run-commands.instructions.md:38) (affirmed 2026-11-10)

ALWAYS report a denial with the exact command, the denial, and the intended outcome. (no-permission-workarounds.instructions.md:23) (affirmed 2026-11-10)

ALWAYS run tests, lint and typecheck through `just`; raw `pytest`, `npm test`, `vitest`, `bun` and `tsc` are banned. (test-run-commands.instructions.md:27) (affirmed 2026-11-10)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
