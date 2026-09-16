---
id: cases/ci-run-34774864071-gate-merge
type: cases
L0: "CI 34774864071: commit 4099034 gate merge 7 to 5 left stale 7-gate pins in test_verify_agents_integrity.py; aligned to 5-gate contract"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-16
directory: cases
provenance: https://github.com/Th3Un1q3/edgent-smith/actions/runs/34774864071
---
# CI run 34774864071 - stale gate pins after intentional 7 to 5 merge

Problem: commit 4099034 (pushed to main) intentionally merged three opencode quality gates into one, moving the contract from 7 gates to 5 in `.opencode/plugins/config/harness.config.ts` and `.opencode/plugins/helpers/gate-config.ts`, and migrated the TS test `gate-config.test.ts` to expect >=5. It documented the merge in-source as intentional and not a quality threshold, but left stale 7-gate pins in the Python integrity guard `tests/test_verify_agents_integrity.py`, so remote `just test` failed on `test_harness_branches_85` and `test_gate_config_fail_closed`. Source: GitHub Actions run 34774864071 observed output.

Solution: aligned the stale pins to the 5-gate contract; corrected a stale comment in `scripts/ci.sh`. No quality threshold changed. Source: operator report and worktree diff.

Verification: focused integrity test 10/10 pass; `scripts/verify_thresholds.sh` 46 passed / 0 failed; `just verify-agents` pass; local `just ci` all gates pass except markdownlint against the UNTRACKED scratch file `.opencode/agents/rug-debug.md` (MD047; absent from remote checkout); mutation 79.99 against break 72. Source: observed local run output.

Open loose end: the fix lives in the worktree, not committed or pushed as of 2026-09-16 - commit/push pending operator decision. The local markdownlint failure is an artifact of the untracked scratch file, not a CI signal.

Related: mem:cases/ci-run-34761145832-dependabot-majors, mem:quality-gates/configuration