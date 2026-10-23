---
id: cases/orchestration/prompt-rule-contradicted-by-own-examples
type: cases
L0: "A new binding rule in an agent prompt must be grepped against that prompt's own examples before acceptance: three examples still sliced a verdict the new rule forbade, costing two fix rounds"
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-10-23
directory: cases/orchestration
provenance: "Observed 2026-10-23 editing .opencode/agents/rug.md Verdict integrity; contradiction confirmed by grep of the same file"
---
# Audit a prompt's examples before accepting a new rule

RULE. When a binding rule is added to an agent prompt, audit that prompt's own examples for violations of the rule in the same change. An example beside prose governs behaviour: a violating example teaches the model the rule is optional.

EVIDENCE. `.opencode/agents/rug.md` gained Verdict integrity ("forward a child's verdict whole or not at all. Never a slice") while three shipped examples still forwarded `judge.outputText.slice(0, 600)` into the fix prompt. The file contradicted itself, and accepting the change cost two fix rounds: the first repaired the primary judge path, the second found the remaining examples and the spans derived from them.

FIX. Pass verdicts whole to the consuming child. When a sub-span is genuinely needed, extract it by structure — split on a heading or line marker — never by character count. A numeric cap is one instance of a rule, not a rival to it (Constant precedence).

CHECK. Before accepting the edit: `grep -nE "slice\(0, ?[0-9]+\)" <prompt file>` and read every hit that touches the value the new rule guards.

RELATED. `cases/orchestration/child-evidence-before-verdict` (the forwarding defect itself); `experiences/orchestration/envelope-example-must-parse-result` (example wins over prose).