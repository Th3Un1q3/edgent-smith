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

**STATUS=new**: A fresh review document was created at `$REVIEW_MD` with frontmatter and Section 1 pre-filled. Proceed with Step 2.

## Step 2: Extract Session Data

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

## Step 3: Validate Review Document

Read the review.md to ensure all questions have been answered. If any section is incomplete, return to Step 2 and delegate the missing questions to subagents.

## Step 4: Identify Improvement Patterns

Read the report and match it to the patterns in `references/agentic-system.md`. For each pattern that applies, propose a concrete change to the agentic system. Populate Section 8 of review.md with the findings.

## Step 5: Prioritize Improvements

Use question tool to prioritize the proposed improvements in Section 8 of review.md. For each improvement, specify the exact file path and concrete change to be made.

### Finalize

Update the review.md frontmatter status:

```bash
sed -i 's|status: "in-progress"|status: "completed"|' "$REVIEW_MD"
```

## Constraints

- Never read entire session.json — use jq for targeted extraction.
- Use RUG pattern: Decompose → Delegate → Validate → Iterate.
- Every recommendation must specify exact file path and concrete change.
- Review one session per invocation.
