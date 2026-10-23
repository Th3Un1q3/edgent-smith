---
id: cases/orchestration/delegated-report-completeness-contract
type: cases
L0: "A delegated report with no closing sentinel and count is truncated, not complete; a sliced verdict drops the tail where sentinels and totals live."
hotness: 0.6
ttl: 90d
version: 1
freshness: 2026-10-23
directory: cases/orchestration
confidence: 0.9
status: active
provenance: RUG orchestration session, four child auditors plus orchestrator observations, 2026-10-23
---
# delegated-report-completeness-contract

fact: A child report, ledger, or enumeration that ends without an explicit closing sentinel and total count cannot be distinguished from one cut off mid-sentence. In this session an editor received a ledger sliced at 2,900 of 4,023 characters by the orchestrator: it ended at "Never spend the reserve " with no sentinel and no total, so the Skill Slot rows were silently missing input and the editor applied a partial ledger.

scope: RUG orchestrators writing subagent prompts and accepting subagent results in this repository.

evidence: Audit children asked for "every statement" returned ledgers with incompatible units (sentences split across one line, table headers, code-fence delimiters, semicolon-joined clauses). The orchestrator sliced a verdict despite a stored never-slice rule, the third recurrence. Four times a child returned status ok with empty outputText and the full answer existed only in the transcript, recovered by subtask_tail.

rule: Require a closing sentinel line naming the deliverable and its total; treat a report without it as truncated and re-request the tail. Never pass a character slice of a verdict to a child. State the counting unit in any enumeration prompt. Recover empty outputText by subtask_tail before relaunch. Name precedence when a fixed count meets a budget-agnostic rule, and tell the child to flag incomplete input instead of applying it.

Source: .agents/skills/task-delegation/SKILL.md v1.5.14, section Report Completeness and Verdict Integrity.