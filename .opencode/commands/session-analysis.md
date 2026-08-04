---
name: session-analysis
description: >
  Start or resume a session review. Calls just agent_utils/review-start for
  session discovery and review document initialization, then guides the agent
  through qualitative analysis of the session.
user-invocable: true
disable-model-invocation: false
---

# Session Analysis

Load relevant skills, by their names below:
- customize-opencode
- session-insights

## Step 1: Start or Resume Review

Here is session to be analyzed.

<analysis-metadata>

!`just agent_utils/review-start "$ARGUMENTS"`

</analysis-metadata>

The output contains KEY=VALUE lines:

- `STATUS` — `new`, `resumed`, `no_sessions`, or `error`
- `MESSAGE` — human-readable status description
- `SESSION_ID` — the target session identifier
- `SESSION_JSON` — path to session.json
- `REVIEW_MD` — path to review.md

### Handle Each Status

**STATUS=no_sessions**: Report "No sessions pending review" and stop.

**STATUS=error**: Report the `MESSAGE` value and stop.

**STATUS=resumed**: The review document already exists at `$REVIEW_MD`. Read the existing review.md to identify completed sections, then continue from where it left off (skip already-filled sections).

**STATUS=new**: A fresh review document was created at `$REVIEW_MD` with frontmatter, Section 1 pre-filled, and Section 0 seeded from `problems.md` (or `*None reported.*`). Proceed with Step 2.

## Step 2: Investigate Reported Threshold Violations

Read `$REVIEW_MD` Section 0 (Reported Threshold Violations). If it contains problem statements, the session went idle with reported breaches — do NOT skip this section. Delegate investigation of each problem to a subagent before answering the audit questions.

For EACH problem statement in Section 0:
- Identify the step in session.json where the count crossed the threshold (use jq against `$SESSION_JSON`; never read the whole file).
- Determine what the agent was doing at that point.
- For skill problems (`## skill: <name>`): verify the skill was actually loaded and used; check whether its instructions were followed.
- For agent problems (`## agent: <name>`): identify which tool calls exhausted the budget and why the agent kept working past the reminder.
- Record what could have prevented the breach (tighter budget, clearer instructions, better skill guidance).

Record findings under the corresponding problem in Section 0 (e.g., a "Findings" list) and reference them when filling Section 8 recommendations.

Prompt:
```text
Task: Investigate the reported threshold violation(s) in review.md Section 0 against the session at {path_to_session_json}.

Instructions:
Read schema.md to learn how to extract fields from session.json.
Read review.md Section 0 to get each problem statement (source, threshold, actual count, message).
For each problem, use jq to locate the crossing step, what the agent was doing, and whether the skill/agent guidance was followed. Do NOT read the whole session.json — use jq for targeted extraction.
Write your findings under the corresponding problem in review.md Section 0.

References:
- {path_to_session_json}
- {path_to_schema_md}
- {path_to_review_md}
```

## Step 3: Extract Session Data

Here is a list of analysis questions to answer. Loop through the list, delegating 1 question per subagent.

<analysis-questions>

!`cat /workspace/.agents/skills/session-insights/workflows/session-audit.md`

</analysis-questions>

Prompt:
```text
Task: Answer to the question about session and place the reply in the review.md file at the appropriate section.

Instructions:
Read schema.md to learn how to extract fields from session.json.
Read the review.md to learn current progress of session review.
Then answer the following question based on the session.json file at {path_to_session_json}.

Question: {one question from the list}

References:
- {path_to_session_json}
- {path_to_schema_md}
- {path_to_review_md}
```

## Step 4: Validate Review Document

Read the review.md to ensure all questions have been answered and Section 0 problems have findings. If any section is incomplete, return to Step 3 and delegate the missing questions to subagents.

## Step 5: Identify Improvement Patterns

Read the report and match it to the patterns in `references/agentic-system.md`. For each pattern that applies, propose a concrete change to the agentic system. Populate Section 8 of review.md with the findings.

## Step 6: Prioritize Improvements

Use question tool to prioritize the proposed improvements in Section 8 of review.md. For each improvement, specify the exact file path and concrete change to be made.

### Finalize

Update the review.md frontmatter status:

```bash
sed -i 's|status: "in-progress"|status: "completed"|' "$REVIEW_MD"
```

## Constraints

- Never ask to read entire session.json — use jq for targeted extraction.
- Use RUG pattern: Decompose → Delegate → Validate → Iterate.
- Every recommendation must specify exact file path and concrete change.
- Review one session per invocation.
- Don't rely on agents reporting you intermediate findings. Make subagents immediately write their findings to the review.md file(changing the relevant sections).
