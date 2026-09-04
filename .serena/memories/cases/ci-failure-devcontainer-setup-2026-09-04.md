---
id: cases/ci-failure-devcontainer-setup-2026-09-04
type: cases
L0: "CI devcontainer setup-dev.sh failure (186 failed runs)"
hotness: 1.0
ttl: 30d
freshness: 2026-09-04
claim_ids: []
provenance: mem:cache/github/edgent-smith/actions/workflow-jobs-33508523183
---
# CI devcontainer setup-dev.sh failure — 2026-09-04

Problem: CI fails at devcontainers/ci@v0.3 postCreateCommand `bash .devcontainer/setup-dev.sh` exit 1 with hardlink warning. Sample run 33508523183 workflow CI branch main title "feat: add environment variables for devcontainer" 2026-09-01T12:35:28Z. Jobs: Prebuild DevContainer success, Format·Lint·Type-check·Tests·Workflow Security failure. 186/415 runs failed.

Solution: Fix setup-dev.sh hardlink handling; pin or update devcontainers/ci version; verify postCreateCommand idempotency. Hypothesis: hardlink creation fails in CI container fs.

Verification: Re-run CI after fix; confirm job Format·Lint·Type-check·Tests·Workflow Security passes; check logs no hardlink warning; sample verification via `mem:cache/github/edgent-smith/actions/workflow-jobs-33508523183`.

Sources: `mem:cache/github/edgent-smith/actions/runs-failed-2026-09-04` + `mem:cache/github/edgent-smith/actions/workflow-jobs-33508523183` + `mem:researches/ci-failures-edgent-smith-2026-09-04`

Gate: 9 checks pass — Standalone, Verified (fetch API), Typed cases, Discoverable, Non-duplicate, Grounded mem: refs, Minimal, Fresh hotness 1.0 ttl 30d, Disclosed L0 quoted.
