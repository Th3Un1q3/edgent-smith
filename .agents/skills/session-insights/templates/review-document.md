---
session_id: ""
date_reviewed: ""
reviewer: ""
status: "in-progress"  # in-progress | completed
---

# Session Review Document

Structured review of an OpenCode session export, answering audit questions and generating improvement recommendations.

## 0. Reported Threshold Violations

<!-- FILL: problems.md -->

_This section lists threshold violations reported when the session went idle. If none were reported, it says so. Investigate each problem during the review._

## 1. Session Identity

<!-- SOURCE: filled by review-start from session_parts.py info/summary (see references/extending_scripts.md) -->
- **Session ID:** <!-- FILL: .info.id -->
- **Agent:** <!-- FILL: .info.agent -->
- **Model:** <!-- FILL: .info.model.id (provider: .info.model.providerID) -->
- **Created:** <!-- FILL: .info.time.created -->
- **Updated:** <!-- FILL: .info.time.updated -->
- **Duration:** <!-- FILL: computed -->

## 2. Objective Assessment

<!-- SOURCE: jq -r '.messages[0] | select(.info.role == "user") | .parts[] | select(.type == "text") | .text' session.json -->
**Q1: What was the objective?**
<!-- FILL: Primary goal in 1-2 sentences. -->

**Q2: Was the objective achieved?**
<!-- FILL: fully achieved | partially achieved | not achieved -->
**Details:** <!-- FILL: What was completed vs. what was not. -->

### Q3a: First Why Chain (if not achieved)
<!-- SOURCE: jq -r '.messages[].parts[] | select(.type == "reasoning" or (.type == "tool" and .state.status == "error"))' session.json -->
1. Why? — <!-- FILL -->
2. Why? — <!-- FILL -->
3. Why? — <!-- FILL -->
4. Why? — <!-- FILL -->
5. Why? (root cause) — <!-- FILL -->

### Q3b: Second Why Chain (if not achieved)
1. Why? — <!-- FILL -->
2. Why? — <!-- FILL -->
3. Why? — <!-- FILL -->
4. Why? — <!-- FILL -->
5. Why? (root cause) — <!-- FILL -->

## 3. Skills Loaded

<!-- SOURCE: filled by review-start from session_parts.py info/summary (see references/extending_scripts.md) -->
<!-- AUTO-FILL: SECTION-3-START -->
| Skill Name | Directory | Truncated? |
|------------|-----------|------------|
| <!-- FILL: name --> | <!-- FILL: dir --> | <!-- FILL: yes/no --> |
<!-- If none: *No skills loaded.* -->
<!-- AUTO-FILL: SECTION-3-END -->

## 4. Steering Instructions

<!-- SOURCE: filled by review-start from session_parts.py info/summary (see references/extending_scripts.md) -->
<!-- AUTO-FILL: SECTION-4-START -->
| # | Reason | Severity |
|---|--------|----------|
| 1 | <!-- FILL: reason --> | <!-- FILL: severity --> |
<!-- If none: *No steering instructions detected.* -->
<!-- AUTO-FILL: SECTION-4-END -->

## 5. Tool Calls

<!-- SOURCE: filled by review-start from session_parts.py info/summary (see references/extending_scripts.md) -->
<!-- AUTO-FILL: SECTION-5-START -->
| Tool Name | Call Count | Success | Errors |
|-----------|-----------|---------|--------|
| <!-- FILL: tool --> | <!-- FILL: total --> | <!-- FILL: ok --> | <!-- FILL: err --> |

**Detailed errors:**
- `<!-- FILL: callID -->` — **<!-- FILL: tool name -->**: <!-- FILL: error -->
<!-- If none: *No tool errors recorded.* -->
<!-- AUTO-FILL: SECTION-5-END -->

## 6. Consolidated Errors

<!-- SOURCE: Collect from tool errors (Section 5), step-finish failure reasons, and error mentions in reasoning parts. -->
<!-- AUTO-FILL: SECTION-6-START -->
<!-- FILL: Each distinct error with source and description. If none: *No errors recorded.* -->
<!-- AUTO-FILL: SECTION-6-END -->

## 7. Token Distribution

<!-- SOURCE: filled by review-start from session_parts.py info/summary (see references/extending_scripts.md) -->
<!-- AUTO-FILL: SECTION-7-START -->
| Category | Tokens |
|----------|--------|
| Input | <!-- FILL: .input --> |
| Output | <!-- FILL: .output --> |
| Reasoning | <!-- FILL: .reasoning --> |
| Cache Read | <!-- FILL: .cache.read --> |
| Cache Write | <!-- FILL: .cache.write --> |
| **Total** | <!-- FILL: sum --> |
| **Cost:** | <!-- FILL: .info.cost (USD) --> |
<!-- AUTO-FILL: SECTION-7-END -->

## 8. Improvement Recommendations

<!-- SOURCE: Map Sections 2-7 findings to the 4 patterns in ../../harness-management/references/improvement-patterns.md. -->

### P1: Skill Was Loaded But Objective Not Achieved
- **Evidence:** <!-- FILL: Which skill(s) loaded? What was missing? -->
- **Proposed Change:** <!-- FILL: Make skill more actionable; add specific instructions. -->
- **Affected File:** <!-- FILL: path -->

### P2: No Relevant Skill Loaded, Objective Not Achieved
- **Evidence:** <!-- FILL: What capability was missing? -->
- **Proposed Change:** <!-- FILL: New skill to create; purpose and key instructions. -->
- **Affected File:** <!-- FILL: path -->

### P3: Files Edited Ineffectively
- **Evidence:** <!-- FILL: Which files? What was wrong? -->
- **Proposed Change:** <!-- FILL: Update instructions with actionable guidance or file globs. -->
- **Affected File:** <!-- FILL: path -->

### P4: Request Too Large or Vague
- **Evidence:** <!-- FILL: What made the request difficult? -->
- **Proposed Change:** <!-- FILL: Instruction to help decompose large/vague requests. -->
- **Affected File:** <!-- FILL: path -->
<!-- Non-applicable patterns: *N/A — not applicable.* -->

## 9. Follow-up Actions

<!-- SOURCE: Convert each Section 8 recommendation into a concrete, verifiable step. -->
<!-- ADDRESSING: Implementing any of these steps means deciding where a harness change belongs — load the harness-management skill and follow its Change Type Reference + workflows (see ../../harness-management/references/improvement-patterns.md). -->
- [ ] <!-- FILL: Action 1 — specific and verifiable -->
- [ ] <!-- FILL: Action 2 -->
- [ ] <!-- FILL: Action 3 -->
<!-- Add or remove items as needed. -->
