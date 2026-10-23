---
id: claims/opencode/browser_child_setup_cost
type: claims
L0: "Browser research child spends 4-6 calls on setup before research, so scope each child to one question and its own page"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# browser_child_setup_cost
fact: A browser-research child pays 4-6 calls of setup (skill load, gateway discovery, code-mode creation, devtools page resolution, SPA settle) before the first research action.
scope: Delegation shape for browser research subtasks.
evidence: Setup cost measured in the orchestration run; children given five lines of enquiry and six criteria ran out before reporting.
rule: Give each child a single question and its own page, not a multi-line enquiry list.
Source: observed orchestration run, 2026-10-22; child call accounting.