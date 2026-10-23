---
title: Test suites must resolve the checkout root by marker, not by fixed hops
---
# Test suites must resolve the checkout root by marker, not by fixed hops

Plugin tests under .opencode/plugins/tests/ run inside Stryker's sandbox (.opencode/.stryker-tmp) whenever the mutation gate runs. A root derived from the test file's own path with fixed hops, a literal absolute path, or process.cwd() silently resolves inside the sandbox, where fixtures are absent, so the gate's initial test run fails with ENOENT or "expected undefined to be defined".

Import REPO_ROOT from tests/helpers/repo-root, which walks upward to the first ancestor containing AGENTS.md and .agents/skills and throws when none exists; only a temp-directory fixture may build its own tree.

Proven: converting four test files took the mutation gate from a failing dry run to a 77.29 score against a 72 break threshold.