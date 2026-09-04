# CI Failures Synthesis — Th3Un1q3/edgent-smith — 2026-09-04

Synthesis of 186 failed runs / 415 total (44.8% failure rate) from `mem:cache/github/edgent-smith/actions/runs-failed-2026-09-04` and `mem:cache/github/edgent-smith/actions/workflow-jobs-33508523183`.

Failure pattern: devcontainers/ci@v0.3 postCreateCommand `bash .devcontainer/setup-dev.sh` exit 1. Log excerpt: hardlink warning + setup-dev.sh failure. Job `Format·Lint·Type-check·Tests·Workflow Security` fails; `Prebuild DevContainer` succeeds. Indicates environment setup, not code lint.

Counts: 186 failed sampled. 5-sample breakdown: CI 4/5, experiment.yml 1/5. Branch: main 4/5 (80%), dependabot/npm-and-yarn/opencode-0.12.0 1/5 (20%). Historic runs likely main-dominated.

Workflow distribution: CI is primary failing workflow; experiment.yml shows intermittent failure (1/5 sample).

Root cause hypothesis: setup-dev.sh hardlink handling under devcontainers/ci@v0.3. Suggested verification: re-run with fixed setup-dev.sh, check hardlink creation, test devcontainers/ci version pin.

Sources: `mem:cache/github/edgent-smith/actions/runs-failed-2026-09-04` + `mem:cache/github/edgent-smith/actions/workflow-jobs-33508523183` date:2026-09-04 tool:github/fetch
Budget: L1 4000c, excerpt 700c.
