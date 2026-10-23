# Fresh-reader audit — task-delegation + building-modular-skills

Scope: .agents/skills/task-delegation/ and .agents/skills/building-modular-skills/ (all files). Read-only pass. 25 worst findings recorded (30 observed; 5 minor held back).

## Provenance / self-referential history
1. task-delegation/SKILL.md:10-75 — frontmatter `delta` runs 65 lines from 1.5.11 down to 1.1. e.g. "prompted by a three-child documentation sweep where a per-file line cap silently overrode a replace-every-occurrence rule, the prompt's file count was wrong, no child reserved lint or validator calls, and a forged argument name passed review." Reader wants the rule, not run history.
2. task-delegation/SKILL.md:128 — "One run reported three finished inventories as failures this way, spending ~3 calls and nearly relaunching them." Unverifiable session anecdote.
3. task-delegation/SKILL.md:117 — "gives the real file count ("7 files", never "six" over a seven-file list)" — quoted past error with no referent.
4. task-delegation/workflows/task-delegation-workflow.md:19 — "1.7 — migrated the timeout unit to `timeout_minutes` (per ADR-004)"; ADR not identifiable from the tree.
5. building-modular-skills/SKILL.md:19 — "4.0.0 — split the shaping rules by topic: ... become ... renamed ... all citations retargeted." 11-line delta inventory in the root.
6. building-modular-skills/references/anti-patterns.md:3 — "These patterns come from analyzing the most-adopted public skill libraries" — no corpus named, no reader action.

## Internal contradictions
7. task-delegation/SKILL.md:145 "The ~24-call budget is per turn." vs task-delegation-workflow.md:60 "target agent's tool-call threshold `floor(steps * 0.8)` ... about 20 calls against `rug-swe`'s 24-call threshold". Two budgets, no reconciliation.
8. task-delegation-workflow.md:99 "Resume (`task_id`) is ONLY for finishing a near-complete task ... never the primary strategy" vs SKILL.md:145 "resume is therefore the cheapest path after idle, not a last resort".
9. task-delegation/agent-cards/rug-puppet.agent-card.md:11 "It can't load skills." vs task-delegation-workflow.md:145 "deriving its method from the skills passed via `skills`".
10. building-modular-skills/references/guidance-content.md:33 ""Implements:" labels are optional; when used, they sit in prose outside the fence" vs same file Rule 14:41 listing ""Implements:"" among prohibited meta-commentary.
11. building-modular-skills/references/guidance-process.md:89 "maps the 9 failure patterns this skill guards against to the preventing rules 17-24" vs anti-patterns.md:3 "The eleven failure patterns" and SKILL.md:78 "the 11 failure patterns".
12. building-modular-skills/references/guidance-structure.md:15 "the 24 shaping rules map one-to-one to the 24 checks, and Rule 25 is a cross-cutting constraint verified alongside check 22" — the sentence says 24 then adds a 25th rule with no check.
13. building-modular-skills/workflows/authoring-workflow.md:18 "past the ~90-line target (hard gate 160 lines)"; a reader cannot tell which number fails the gate.

## Dangling references / unroutable actions
14. task-delegation/workflows/sample-workflow.md:13 "**[description]**" (also :17, :19, :23) — routed from SKILL.md:175 as "Example of using the RUG orchestrator pattern", but the file is an unfilled template; a reader following the route cannot act.
15. building-modular-skills/references/divergence-and-gates.md:36 "Give the critic the tree path and Rules 1-24 only." (also :33, :40) — stale range; Rule 25 exists and is withheld from the critic.
16. building-modular-skills/references/divergence-and-gates.md:40 "the critic's report at `reports/blind-critique-<name>.md`" — directory never defined or routed; no reader can place the file.
17. task-delegation/SKILL.md:119 "reserve explicit calls and name the command — `just lint` or `just ci-fast` for docs, `validate_memory_frontmatter`, `validate_md_links`, and `audit_fences` for memories" — three bare script names with no path; a fresh reader cannot run them.
18. task-delegation/SKILL.md:136 "max-lines 650 per test file, complexity 8, `unicorn/prefer-includes`, no-await-expression-member, no-top-level-assignment-in-function" — repo lint caps copied into a general skill; unverifiable from the doc and drifts from the config.
19. task-delegation-workflows/task-delegation-workflow.md:60 "(....:59,79)" — "(`.opencode/plugins/tool-limit-reminder.ts:59,79`)" line-number citation that rots and that the reader cannot verify.

## Broken text / structure
20. task-delegation/agent-cards/rug-swe.agent-card.md:11 "use rug-puppet instead.rug-swe handles complex implementation work" — missing separator; two sentences fused.
21. task-delegation/agent-cards/rug-swe.agent-card.md:53 "**Why this works:**" — heading with no content; the promised explanation never appears.
22. task-delegation/agent-cards/rug-swe.agent-card.md:60 "to read what was already created((the read tool is blocked, use terminal commands)." — garbled parentheses plus an unverifiable environment claim.
23. task-delegation/agent-cards/rug-swe.agent-card.md:93 Example 3 opens a ```markdown fence that is never closed; everything after it renders as code.
24. task-delegation/agent-cards/rug-puppet.agent-card.md:70 "CONTEXT: ESLint violations have been fixed. Now I to check if the files contain the fixes I expect." — broken sentence; assumes session state no reader has.
25. task-delegation/agent-cards/rug-mcp.agent-card.md:48 "What is the current best practice for implementing a neural network transformer model for natural language processing in 2025?" — dated example in a 2026 tree.

## Also seen, not ranked
- divergence-and-gates.md:12 circular definition: "The tier is the weakest model tier the harness offers".
- guidance-process.md:65 "never invent new behaviour: resolve, never `--abort`" — no object; CLI verb with no referent.
- guidance-process.md:33 "One adapter means a hypothetical seam; two adapters means a real one." — unexplained aphorism.
- authoring-workflow.md:47 "Add a Related Skills section ..." — an imperative inside "Acceptance Criteria", not a verifiable state.
- guidance-process.md:49 vs :51 "no Phase 2" vs example "no Phase 3".
- templates-root.md:18-19 duplicate the compatibility rule inside the frontmatter skeleton.
