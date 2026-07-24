# Session Review Document

Structured review of an OpenCode session export, answering audit questions and generating improvement recommendations.

---
session_id: ""
date_reviewed: ""
reviewer: ""
status: "in-progress"  # in-progress | completed
---

## 1. Session Identity

<!-- SOURCE: jq '{id, agent, model: .model.id, provider: .model.providerID, created: .time.created, updated: .time.updated}' <<< "$(jq .info session.json)" -->
<!-- Duration = (updated - created) epoch ms → human-readable. -->
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

**Q3a: First Why Chain (if not achieved)**
<!-- SOURCE: jq -r '.messages[].parts[] | select(.type == "reasoning" or (.type == "tool" and .state.status == "error"))' session.json -->
1. Why? — <!-- FILL -->
2. Why? — <!-- FILL -->
3. Why? — <!-- FILL -->
4. Why? — <!-- FILL -->
5. Why? (root cause) — <!-- FILL -->

**Q3b: Second Why Chain (if not achieved)**
1. Why? — <!-- FILL -->
2. Why? — <!-- FILL -->
3. Why? — <!-- FILL -->
4. Why? — <!-- FILL -->
5. Why? (root cause) — <!-- FILL -->

## 3. Skills Loaded

<!-- SOURCE: jq '[.messages[].parts[] | select(.type == "tool" and .tool == "skill") | {name: .state.input.name, dir: .state.metadata.dir, truncated: .state.metadata.truncated}]' session.json -->
| Skill Name | Directory | Truncated? |
|------------|-----------|------------|
| <!-- FILL: name --> | <!-- FILL: dir --> | <!-- FILL: yes/no --> |
<!-- If none: *No skills loaded.* -->

## 4. Steering Instructions

<!-- SOURCE: jq -r '.messages[].parts[] | select(.type == "text" and (.text | startswith("<steering>"))) | .text' session.json — extract reason and severity from each <steering> block. -->
| # | Reason | Severity |
|---|--------|----------|
| 1 | <!-- FILL: reason --> | <!-- FILL: severity --> |
<!-- If none: *No steering instructions detected.* -->

## 5. Tool Calls

<!-- SOURCE: jq '[.messages[].parts[] | select(.type == "tool") | {tool: .tool, status: .state.status}]' session.json -->
| Tool Name | Call Count | Success | Errors |
|-----------|-----------|---------|--------|
| <!-- FILL: tool --> | <!-- FILL: total --> | <!-- FILL: ok --> | <!-- FILL: err --> |

**Detailed errors:**
<!-- SOURCE: jq -r '.messages[].parts[] | select(.type == "tool" and .state.status == "error") | "\(.callID): \(.tool) — \(.state.output // .state.error // \"unknown\")"' session.json -->
- `<!-- FILL: callID -->` — **<!-- FILL: tool name -->**: <!-- FILL: error -->
<!-- If none: *No tool errors recorded.* -->

## 6. Consolidated Errors

<!-- SOURCE: Collect from tool errors (Section 5), step-finish failure reasons, and error mentions in reasoning parts. -->
<!-- FILL: Each distinct error with source and description. If none: *No errors recorded.* -->

## 7. Token Distribution

<!-- SOURCE: jq '.info.tokens' session.json -->
| Category | Tokens |
|----------|--------|
| Input | <!-- FILL: .input --> |
| Output | <!-- FILL: .output --> |
| Reasoning | <!-- FILL: .reasoning --> |
| Cache Read | <!-- FILL: .cache.read --> |
| Cache Write | <!-- FILL: .cache.write --> |
| **Total** | <!-- FILL: sum --> |
**Cost:** <!-- FILL: .info.cost (USD) -->

## 8. Improvement Recommendations

<!-- SOURCE: Map Sections 2-7 findings to the 4 patterns in references/agentic-system.md. -->

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
- [ ] <!-- FILL: Action 1 — specific and verifiable -->
- [ ] <!-- FILL: Action 2 -->
- [ ] <!-- FILL: Action 3 -->
<!-- Add or remove items as needed. -->
