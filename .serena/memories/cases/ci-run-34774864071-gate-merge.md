---
id: cases/ci-run-34774864071-gate-merge
type: cases
L0: "CI 34774864071: commit 4099034 gate merge 7 to 5 left stale 7-gate pins; fix pushed as 2eb3560, CI 35134836150 green, run superseded"
hotness: 0.85
ttl: 180d
version: 2
freshness: 2026-09-16
directory: cases
provenance: https://github.com/Th3Un1q3/edgent-smith/actions/runs/34774864071
---
# CI run 34774864071 - stale gate pins after intentional 7 to 5 merge

Problem: commit 4099034 (pushed to main) intentionally merged three opencode quality gates into one, moving the contract from 7 gates to 5 in `.opencode/plugins/config/harness.config.ts` and `.opencode/plugins/helpers/gate-config.ts`, and migrated the TS test `gate-config.test.ts` to expect >=5. It documented the merge in-source as intentional and not a quality threshold, but left stale 7-gate pins in the Python integrity guard `tests/test_verify_agents_integrity.py`, so remote `just test` failed on `test_harness_branches_85` and `test_gate_config_fail_closed`. Source: GitHub Actions run 34774864071 observed output.

Solution: aligned the stale pins to the 5-gate contract; corrected a stale comment in `scripts/ci.sh`. No quality threshold changed. Source: operator report and worktree diff.

Outcome: the fix, together with the retrospective instruction edits and memory-store changes, was committed as `2eb3560` and pushed as the `origin/main` tip. Remote CI run 35134836150 for `2eb3560` completed success at 2026-09-16T18:37:03Z (workflow `CI`, both jobs green); run 34774864071 is superseded. Source: operator report and GitHub Actions run 35134836150.

Verification: focused integrity test 10/10 pass; `scripts/verify_thresholds.sh` 46 passed / 0 failed; `just verify-agents` pass; local `just ci` all gates pass except markdownlint against the UNTRACKED scratch file `.opencode/agents/rug-debug.md` (MD047; absent from remote checkout); mutation 79.99 against break 72. Source: observed local run output.

Open loose end: the round-3 docs-consistency one-liner (workflow Summary changed from five to six elements) was not part of `2eb3560` and remained an uncommitted working-tree change at closeout. The local markdownlint failure is an artifact of the untracked scratch file, not a CI signal.

Unrelated red: `experiment.yml` (Auto-Research) run 35134834755 at `2eb3560` fails at startup with zero jobs because the workflow file is invalid (`Unrecognized function` for `cancelled` at `.github/workflows/experiment.yml` line ~198/204); the same failure repeats on 8+ consecutive commits across days, so it is classified pre-existing/unrelated, not caused by `2eb3560`. Source: operator classification and observed run output.

Related: mem:cases/ci-run-34761145832-dependabot-majors, mem:quality-gates/configuration