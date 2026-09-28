---
id: subagent-workflows/adversarial-validation-practice
type: experiences
L0: "Fresh adversarial validators surface real defects across consecutive rounds; scope validator commands to skip heavy gates; finish staging before tests that assert git-tracked state; resume a truncated child report before trusting it."
hotness: 0.8
ttl: 180d
freshness: 2026-09-27
directory: subagent-workflows
provenance: session audit of adversarial validation
---

# Adversarial Validation Practice

- A fresh validator that attacks the work, rather than confirms it, finds real defects; consecutive rounds keep finding them, so budget follow-up rounds.
- A validator command that pulls in heavy gates can time out. Scope it to the target (scoped mutation, single module, focused test path) so the check finishes.
- Tests that assert git-tracked state need staging complete first; unstaged or re-staged changes make those tests read stale content.
- A child report that arrives empty or truncated is often cut off, not a failed run; resume the report before relaunching.

Related: mem:subagent-workflows/verification-retries, mem:skills/general/subagent-empty-result-verify-before-relaunch, mem:testing/python/adversarial-tests-after-implementation.
