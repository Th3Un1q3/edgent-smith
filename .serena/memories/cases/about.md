---
id: cases-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "cases: reusable extraction cases distilled"
L0_table:
  - id: cases/ci-failure-devcontainer-setup-2026-09-04
    L0: "CI failure: devcontainer setup break, 2026-09-04"
  - id: cases/ci-markdownlint-skills-eof-heading
    L0: "CI markdownlint: skill files missing an EOF heading"
  - id: cases/ci-run-34761145832-dependabot-majors
    L0: "CI run 34761145832: dependabot major bumps broke the gate"
  - id: cases/ci-run-34774864071-gate-merge
    L0: "CI run 34774864071: gate merge failure"
  - id: cases/ci-stryker-incremental-cache-v2
    L0: "Stryker CI cache v2: split dep/source hashes; test -f save gate; chmod a+rwX; tracked lockfile"
  - id: cases/concurrent-worktree-change-attribution
    L0: "Concurrent worktrees: attribute changed files to the right worktree"
  - id: cases/delegation-goal-gate-and-prompt-width
    L0: "Delegation run lost two dispatches to the goal gate, one scouting pass to a blocked re-dispatch, and a child to a 7-question prompt overrun at 26/24 calls; fixes: goal set in the dispatch body, at most 3 questions, name the closing observable."
  - id: cases/mutation-campaign-scoping
    L0: "Mutation campaigns: scope the run before judging survivors"
  - id: cases/opencode-plugin-v2-effect-migration
    L0: "OpenCode plugin v2: Effect-based migration of tool hooks"
  - id: cases/opencode-plugin-v2-tool-and-session-adaptation
    L0: "OpenCode plugin v2: adapt custom tools and the session API"
  - id: cases/stryker10-vitests-separator
    L0: "Stryker 10 with vitest: separator and command misconfiguration"
  - id: cases/unicorn74-lint-fixes
    L0: "unicorn 74: lint fixes that changed behavior"
  - id: cases/browser-automation/linkedin-growth-chart
    L0: "LinkedIn growth chart: aria-label regex extraction"
  - id: cases/delegation/never-infer-operator-identity
    L0: "Never infer an operator's identity or credentials: a guessed email became a duplicate dotenv key that won last, and the tunnel rejected it as an unauthorized broker assertion."
  - id: cases/docs/prose_capability_claims_rot
    L0: "Docs prose: capability claims rot without a check"
  - id: cases/markdown/table-html-comment-splits-table
    L0: "Markdown: an HTML comment between rows splits a table"
  - id: cases/opencode/child_missing_plugin_tools
    L0: "Subtask children do not receive plugin custom tools (subtask_run, subtask_ls, subtask_tail); validators cannot probe, so the orchestrator runs the probe and hands over raw ids and output"
  - id: cases/opencode/fork_parentid_lineage
    L0: "Forked sessions are not parentID children of the calling session; subtask_ls lists parentID children only, so track the returned task_id (the fork id) as the only handle"
  - id: cases/opencode/lint_fix_rewrites_tests
    L0: "Lint --fix rewrites test files; re-run tests after lint"
  - id: cases/opencode/plugin_ctx_session_fork
    L0: "Plugin ctx: fork a session through ctx, not the SDK reader"
  - id: cases/opencode/plugin_hot_reload_safe_development
    L0: "Plugin hot reload: develop without breaking the live harness"
  - id: cases/opencode/quality_gate_hang_blocks_edits
    L0: "A hanging quality gate blocks edits; guard gate timeouts"
  - id: cases/opencode/remote-access-lessons
    L0: "Remote access to the OpenCode server: lessons"
  - id: cases/opencode/sdk_detached_method_this
    L0: "SDK detached methods lose this; bind before calling"
  - id: cases/opencode/sdk_skills_injection
    L0: "SDK: inject skills into the session"
  - id: cases/opencode/skill_catalog_name_mismatch
    L0: "Verify skill catalog names against .agents/skills/"
  - id: cases/opencode/stryker_static_mutant_amplification
    L0: "Stryker static mutants amplify across files"
  - id: cases/opencode/subtask_tail_process_local
    L0: "subtask_tail reads process-local transcript state"
  - id: cases/opencode/todowrite_removed_agent_tool_config
    L0: "todowrite removed: agent tool config drifts from the harness"
  - id: cases/opencode/tool_context_metadata_inert
    L0: "Tool context metadata is inert where writers expect it to act"
  - id: cases/opencode/workflow-instruction-injection-exposure
    L0: "Workflow: instruction injection exposure through file content"
  - id: cases/opencode/workflow_budget_exceeded_stats_mismatch
    L0: "budget_exceeded stats.subtasks can exceed steps.length"
  - id: cases/opencode/workflow_fork_from_envelope_truncation
    L0: "Workflow reducer can exceed the ~8 KB envelope cap"
  - id: cases/opencode/workflow_producer_unverified_tree
    L0: "Producer can leave the tree unverified after budget exhaustion"
  - id: cases/orchestration/child-evidence-before-verdict
    L0: "Judge a child by its transcript not outputText; paste full verdicts; scope validators to the target path"
  - id: cases/orchestration/delegated-report-completeness-contract
    L0: "A delegated report with no closing sentinel and count is truncated, not complete; a sliced verdict drops the tail where sentinels and totals live."
  - id: cases/orchestration/delegation-prompt-assumptions
    L0: "A delegation prompt inherits orchestrator assumptions: an ADR lives in mem: rules plus the about index, not a repo file:line; a child may lack the gateway, so load it first; a citation disagreeing with the tree is corrected, never fit to a count."
  - id: cases/orchestration/execute-body-hygiene-and-timeout-scoping
    L0: "Execute bodies: hygiene and timeout scoping"
  - id: cases/orchestration/incident-rules-in-orchestrator-instead-of-memory
    L0: "Incident rules landed in the orchestrator: the retrospective had no memory-first step, so rug.md Failure Modes grew per incident; fix: lessons are cases or method rules, with mem:cases/about as the pointer."
  - id: cases/orchestration/prompt-rule-contradicted-by-own-examples
    L0: "A prompt rule contradicted by its own examples is ignored"
  - id: cases/orchestration/research-not-memorized-retrospective
    L0: "Research not memorized: retrospective of a lost finding"
  - id: cases/orchestration/root-cause-isolation-and-branded-type-validation
    L0: "A plugin hook that throws on a matching path fails the tool only for matched files: the failing set reveals the matcher, not the tool."
  - id: cases/orchestration/skill-scouting-cadence-counter
    L0: "Skill scouting: a cadence counter gates re-scouting"
  - id: cases/orchestration/stray-root-node-modules-from-cwd-dependence
    L0: "Stray root node_modules: ad-hoc vitest from cwd; aliases and cache resolved against the repo root"
  - id: cases/orchestration/timeout-habit-and-proxy-judging
    L0: "Timeout habit: judge children by proxy evidence, not liveness"
  - id: cases/orchestration/validator-external-diff-attribution
    L0: "Validators: attribute external diffs to the right producer"
  - id: cases/orchestration/must-have-criterion-category-mismatch
    L0: "Must-have criteria without a category-anchored acceptance test let a writer score a diagram tool as failing and record three false FAILs."
  - id: cases/rug/empty-child-result-and-self-graded-ledger
    L0: "rug: an ok child with empty outputText is recovered from its transcript by run(); an author's own ledger does not prove compliance."
  - id: cases/serena-memory/round2-recall-friction
    L0: "Serena recall round 2: recall friction"
  - id: cases/serena-memory/round3-recall-friction
    L0: "Serena recall round 3: recall friction"
  - id: cases/serena-memory/round4-recall-friction
    L0: "Serena recall round 4: recall friction"
---

# Cases

Reusable distilled cases extracted from events/browser-automation: one problem, solution, and verification per case. Cases compose into trajectories (3 cases → 1 trajectory) per agent-evolution.md.

## Scope
- Cases at cases/<subdomain>/<case-slug>: selector, quirk, failure mode, verified fix, and provenance mem: refs.
- Distilled from mem:events/about and mem:browser-automation/about recipes.
- Atomic enough to reuse across sites; trajectories aggregate 3+ cases.

## Boundaries (out of scope)
- Raw event logs — mem:events/about.
- Cross-case patterns — mem:experiences/about.
- Atomic claims — mem:claims/about.

## Related Domains
- mem:browser-automation/about — source recipes for case extraction.
- mem:experiences/about — patterns distilled from cases.
- mem:events/extraction/batch-linkedin-2026-08 — event that yielded cases.
