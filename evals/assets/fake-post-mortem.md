# INCIDENT POST-MORTEM: PR Merge Queue Squash Regression

**Document Classification:** Confidential / Internal & Customer Facing Summaries Extracted

- **Date of Incident:** April 23, 2026
- **Date of Report:** April 29, 2026
- **Incident Commander:** Sarah Jenkins (Director of Engineering, Core Services)
- **Status:** Resolved — Post-mortem completed, action items tracked
- **Incident Identifier:** INC-20260423-MQ-SQUASH
- **Severity:** SEV-1 (Data Integrity / High Customer Impact)

---

## Executive Summary

On April 23, 2026 (16:05–20:43 UTC), Acme experienced a SEV-1 data-integrity incident affecting the Pull Requests service's Merge Queue when using the *squash merge* strategy for multi-PR batches. A deployed optimization (mq_optimized_base_computation_v2) that was intended to be gated by a feature flag executed in the worker context and produced incorrect squash commits: later PRs in a batch could silently revert files introduced by earlier PRs.

Because Git accepted the generated trees as cryptographically valid, standard infrastructure monitoring and canaries (which exercise single-PR flows) did not detect the logical corruption. The regression affected 2,092 PRs across 1,438 repositories. The offending change was reverted and force-deployed by 20:43 UTC; remediation guidance and targeted support were provided to affected repository admins.

This document describes the timeline, technical root cause, impact, corrective actions, and follow-ups.

---

## Participants and Roles

### Incident Command & Coordination
- **Sarah Jenkins** — Incident Commander (Director of Engineering, Core Services)
- **Marcus Torres** — Communications Lead
- **Elena Rostova** — Operations Lead

### Engineering & SMEs
- **Dr. Aris Thorne** — Git internals SME (Git Core)
- **David Chen** — Author of the optimized base computation change
- **Priya Patel** — Merge Queue Engineering Manager
- **Samir Al-Fayed** — Database Reliability Engineer

### Customer Support & Remediation
- **Jessica Blain** — Director, Enterprise Support
- **Tom O'Connor** — Technical Support Account Manager

### Post-Incident Review Board
- **Liam Davies** — VP of Engineering, Core Services (Executive sponsor)
- **Choi Min-Ji** — Principal Security Engineer

---

## Background and System Architecture Context

### Merge Queue Overview

The Merge Queue serializes PR merges to ensure main remains green. It creates an ephemeral branch, merges queued PRs into that ephemeral branch to run CI on the combined state, and on success finalizes each PR using the repository's configured merge method (merge commit, squash, or rebase).

For squash merges the finalization loop looks like:

1. Squash PR A onto main → create Commit SA → update main → SA
2. Squash PR B onto main (now at SA) → create Commit SB → update main → SB

Accurate computation of the three-way merge base is essential for each squash.

### Base Computation & Optimization

Computing `git merge-base` can be expensive for large histories. `mq_optimized_base_computation_v2` was an optimization intended to deduce the base for ephemeral branches without expensive graph traversal by using the queue's known start commit.

### Feature Flag (Flipper) Context

Acme uses a Flipper-style feature flag system. The flag gating is typically evaluated in the web request context (e.g., `Flipper.enabled?(:mq_optimized_base_computation_v2, repository)`). Merge Queue finalization runs in background workers (Sidekiq), so correct context propagation is required.

---

## Impact Assessment

### Quantitative Metrics
- **Impact window:** 16:05–20:43 UTC
- **Repositories affected:** 1,438
- **Pull requests affected:** 2,092
- **Support tickets:** 412 escalations for "missing code" / "reverted commits"

Estimated customer developer-hours lost: ~17,250 (conservative estimate used for impact reporting).

### Qualitative Impact

Because later squash commits could be generated with an incorrect base, resulting commits sometimes omitted earlier PR changes from the batch. This produced cases where main advanced but lost files or migrations introduced earlier in the same batch, causing customer deployments and runtime errors.

### Why Monitoring Missed This

- Git accepted the produced trees (cryptographic integrity checks passed).
- Canary tests exercised single-PR flows; the bug requires multi-PR batches.
- No post-merge data-plane heuristics validated that the final tree matched the expected delta of the constituent PRs.

---

## Timeline of Events (UTC)

- **14:00** — Release v2026.04.23.1 begins (includes PR #88392).
- **14:30–15:15** — Ring 0 and Ring 1 deployments complete with no obvious anomalies.
- **16:05** — Global deployment completes; first faulty squash merges occur shortly after.
- **16:35** — First customer/support reports received.
- **17:30** — Support escalates to Developer Support Engineering (DSE).
- **18:10** — DSE tests single-PR merges (no reproduction).
- **19:38** — Engineer David Chen inspects a broken commit tree and recognizes data corruption.
- **19:42** — Sev-1 declared; incident bridge established.
- **20:05–20:25** — Root cause narrowed to PR #88392 (mq_optimized_base_computation_v2) and feature-flag evaluation differences.
- **20:20–20:43** — Emergency revert and force-deploy of the revert; mitigation completed globally by 20:43.
- **21:43** — Final list of 2,092 affected PRs generated; targeted remediation communications begin.

---

## Root Cause Analysis

Two compounding failures caused the incident:

### 1) Feature flag context propagation failure

The Flipper feature flag evaluation diverged between web and worker contexts. A recent Flipper client change serialized flags at enqueue-time and placed them in the job payload. However, `v2_compute_base` instantiated a Git context and lazily loaded `pull_request.repository` inside the worker loop, which caused the memoized flag context to be bypassed. In worker instances where an environment fallback (`FLIPPER_DEFAULT_ENABLE_EXPERIMENTAL`) had drifted to `true`, Flipper effectively *failed open* and executed the v2 code-path despite the flag being disabled globally.

### 2) Algorithmic bug in `v2_compute_base`

`v2_compute_base` incorrectly assumed the base for *every* PR in the batch was the batch-start commit, rather than computing the true three-way merge-base between the current target (which evolves as earlier PRs are applied) and the PR tip. This assumption can cause the three-way merge to interpret changes introduced by earlier PRs as intentional deletions in later PRs, producing trees that omit earlier PR changes.

Example (simplified):

```ruby
class MergeQueue::SquashProcessor
  def compute_merge_base(pull_request, target_branch)
    if Flipper.enabled?(:mq_optimized_base_computation_v2, pull_request.repository)
      v2_compute_base(pull_request, target_branch)
    else
      v1_compute_base(pull_request, target_branch)
    end
  end
end
```

Flawed V2 logic (conceptual):

```ruby
def v2_compute_base(pull_request, target_branch)
  # BUG: assumes the base is always the batch start commit
  pull_request.merge_group.base_sha
end
```

This led to correct-looking commits with logically incorrect trees.

---

## Contributing Factors

- Lack of data-plane validation (no post-merge heuristics comparing expected vs. actual tree deltas).
- Test-suite bias toward single-PR happy paths; multi-PR squash flows were under-tested.
- Feature flag complexity and environment drift (`FLIPPER_DEFAULT_ENABLE_EXPERIMENTAL`).
- Staging lacked high-velocity multi-PR batch simulation.
- Initial support signals were miscategorized and delayed escalation.

---

## Corrective Actions (taken)

### Immediate Mitigation (April 23)

- Reverted PR #88392 and force-deployed the revert across fleet rings (hotfix v2026.04.23.2).
- Scrubbed legacy environment variable `FLIPPER_DEFAULT_ENABLE_EXPERIMENTAL` from worker instance provisioning.
- Queried data to identify affected PRs and notified repository admins with remediation instructions.

### Customer Remediation

- Provided targeted emails listing affected PR SHAs and recovery instructions.
- Published a recovery script and staffed a dedicated Zendesk queue to assist customers.

---

## Follow-ups Required (P0/P1 epics)

- **JIRA-CORE-9011:** Implement a Git-fuzz-tester for Merge Queue (owner: Dr. Aris Thorne).
- **JIRA-CORE-9012:** Add lightweight post-merge heuristic checks (owner: Priya Patel).
- **JIRA-ARCH-4420:** Unify and harden feature-flag context propagation (owner: David Chen / ARB).
- **JIRA-INFRA-8831:** Enforce Terraform drift detection to avoid env var leakage (owner: SRE).
- **JIRA-QA-3310:** Add multi-PR batch simulation load generators in staging (owner: Release Engineering).
- **JIRA-CS-5502:** Improve support alerting heuristics for high-priority "missing code" signals (owner: Jessica Blain).

---

## Lessons Learned

- Data integrity must be validated as rigorously as availability and performance.
- Feature-flag behavior must be consistent across synchronous and background contexts; fallbacks must fail closed.
- Tests and canaries must exercise end-to-end multi-PR batch flows (not just single-PR paths).

---

## Appendix A — Visualizing the Git Tree Corruption

```
Expected (correct):

Base (M)
  ├─ Squash PR1 -> SA (contains PR1 changes)
  └─ Squash PR2 -> SB (contains PR1 + PR2 changes)

Corrupted (incident):

Base (M)
  ├─ Squash PR1 -> SA (contains PR1 changes)
  └─ Squash PR2 (computed with wrong base) -> SB_BAD (contains PR2 only; PR1 lost)
```

---

## Appendix B — Customer Remediation Script (excerpt)

```bash
#!/bin/bash
# Acme Merge Queue Recovery Script (excerpt)

TARGET_BRANCH="main"
LAST_GOOD_COMMIT="<INSERT_SHA_FROM_GITHUB_EMAIL>"
AFFECTED_PRS=( "<PR1>" "<PR2>" )

git checkout $TARGET_BRANCH
git pull origin $TARGET_BRANCH
git branch backup-main-$(date +%s)
git reset --hard $LAST_GOOD_COMMIT

for PR in "${AFFECTED_PRS[@]}"; do
  git fetch origin pull/$PR/head:pr_$PR_temp
  git merge --squash pr_$PR_temp
  # supply an appropriate commit message
  git commit -m "Recovered PR #$PR"
  git branch -D pr_$PR_temp
done

echo "Review locally, then: git push --force origin $TARGET_BRANCH"
```

---

## Contact

For internal questions about this post-mortem, see Slack channel `#inc-20260423-mq` or contact the Core Services engineering management team.

*End of document.*
