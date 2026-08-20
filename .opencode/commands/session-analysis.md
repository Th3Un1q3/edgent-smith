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
- harness-management
- session-insights
- customize-opencode

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
- `SESSION_TRANSCRIPT` — path to the pre-rendered compact transcript

### Handle Each Status

**STATUS=no_sessions**: Report "No sessions pending review" and stop.

**STATUS=error**: Report the `MESSAGE` value and stop.

**STATUS=resumed**: The review document already exists at `$REVIEW_MD`. Read the existing review.md to identify completed sections, then continue from where it left off (skip already-filled sections).

**STATUS=new**: A fresh review document was created at `$REVIEW_MD` with all mechanical extraction done: frontmatter, Section 1 (identity) pre-filled from `session_parts.py info`, Sections 3–7 pre-filled from `session_parts.py summary`, and Section 0 seeded verbatim from `problems.md` (or `*None reported.*`). The audit questions validate these filled sections — they never recompute them. Proceed with Step 2.

## Step 2: Investigate Reported Threshold Violations

Read `$REVIEW_MD` Section 0 (Reported Threshold Violations). If it contains problem statements, the session went idle with reported breaches — do NOT skip this section. Each problem carries a `<!-- problem-id: <source>:<thresholdName> -->` comment; use it to reference the problem when recording findings.

For EACH problem statement in Section 0:
- Identify the step in session.json where the count crossed the threshold. This is the ONLY jq in this command — a targeted query against `$SESSION_JSON` for the crossing step (never read the whole file).
- Get the precise tool block for that call: `just agent_utils/session-parts --session-file-json "$SESSION_JSON" parts --tool-id <callID>` (input/output/error truncated to 200 chars) — the "what was the agent doing at that point" evidence.
- Determine what the agent was doing at that point.
- For skill problems (`## skill: <name>`): verify the skill was actually loaded against the pre-filled Section 3 (Skills Loaded) — read it, do not recompute — and check whether its instructions were followed.
- For agent problems (`## agent: <name>`): identify which tool calls exhausted the budget and why the agent kept working past the reminder.
- Record what could have prevented the breach (tighter budget, clearer instructions, better skill guidance).

Record findings under the corresponding problem in Section 0 (e.g., a "Findings" list) and reference them when filling Section 8 recommendations.

Prompt:
```text
Task: Investigate the reported threshold violation(s) in review.md Section 0 against the session at {path_to_session_json}.

Instructions:
Read review.md Section 0 to get each problem statement (source, threshold, actual count, message).
For each problem, use jq ONLY to locate the crossing step (the only jq in this command; everything else comes from the CLI or the pre-filled review.md). Get the tool block for that call via `just agent_utils/session-parts --session-file-json "$SESSION_JSON" parts --tool-id <callID>`. For skill problems, verify the load against the pre-filled review.md Section 3. Do NOT read the whole session.json.
Write your findings under the corresponding problem in review.md Section 0.

References:
- {path_to_session_json}
- {path_to_schema_md}
- {path_to_review_md}
```

## Step 3: Audit the Session

Here is a list of analysis questions to answer. Loop through the list, delegating 1 question per subagent.

<analysis-questions>

!`cat /workspace/.agents/skills/session-insights/workflows/session-audit.md`

</analysis-questions>

The questions and their retrieval methods come from the loaded session-insights skill's audit workflow (catted above). Evidence sources, in order:

- **First pass**: the compact transcript at `$SESSION_TRANSCRIPT` (rendered by review-start — it always exists after Step 1). If it contains the literal note "Error: transcript render failed", re-render it first via `just agent_utils/session-parts --session-file-json "$SESSION_JSON" conversation --format short-human-readable` — the error-note content is a render failure, NOT evidence.
- **Detailed tool evidence** (Section 0 problem investigation, or any question needing full tool state):
  `just agent_utils/session-parts --session-file-json "$SESSION_JSON" parts --tool-id <callID> --message-id <msg_id>`
  `--part-id` also exists — it pulls a specific part (e.g. reasoning) by its `prt_...` id.
- **Machine-extractable evidence**: read the pre-filled review.md sections — Section 3 (skills loaded), Section 4 (steering instructions), Section 5 (tool calls), Section 6 (errors), Section 7 (token distribution). review-start filled them from `session_parts.py info`/`summary`; validate them — do NOT recompute, and no jq.

Prompt:
```text
Task: Answer to the question about session and place the reply in the review.md file at the appropriate section.

Instructions:
Read the review.md to learn current progress of session review.
Then answer the following question based on the session at {path_to_session_json}, following the retrieval method the question's workflow entry assigns: transcript first pass (re-render only if it holds the literal "Error: transcript render failed" note), session_parts.py CLI for part/tool detail, or the pre-filled review.md sections 3–7. Never recompute what review-start already filled; never use jq in this step. Consult schema.md for field paths if a targeted lookup is needed.

Question: {one question from the list}

References:
- {path_to_session_json}
- {path_to_schema_md}
- {path_to_review_md}
```

## Step 4: Filter the Review Document

Read the review.md and filter out gaps: every question in the list must be answered, and every Section 0 problem must have findings. If any section is incomplete, return to Step 3 and delegate the missing questions to subagents. Only fully answered, evidence-backed sections move on to Step 5.

## Step 5: Identify Improvement Patterns

Load the harness-management skill by name using your `skill` tool, then map the audit findings to the improvement patterns (P1–P4) in its `references/improvement-patterns.md`. Ground each pattern in the evidence already recorded in review.md — in particular Section 5 (tool calls) and Section 6 (errors) — rather than re-deriving it. For each pattern that applies, propose a concrete change to the agentic system. Populate Section 8 of review.md with the findings.

## Step 6: Prioritize Improvements

Apply the Prioritization policy in harness-management — do not restate or copy its content here. Read review.md Section 7 (token distribution and cost) for the cost evidence the policy scores. Then use the question tool over the capped list of proposed improvements from Section 8 of review.md. For each selected improvement, specify the exact file path and concrete change to be made. Keep the list within the policy's cap of 1–3 actions, and write the selected items to Section 9 of review.md as action items in the shared 5-field schema (Domain match / Change / Where / Trigger / Next step).

## Step 7: Implement and Restart

Implement the top 1–3 items from Step 6's prioritization:

Load the harness-management skill by name using your `skill` tool, then follow its Change Type Reference table and the matching workflow (scoped instructions / skill / directory AGENTS.md / agent definition). If an action touches opencode config mechanics — opencode.json/opencode.jsonc, config under .opencode/ (agents, skills, plugins, MCP servers, permission rules), or ~/.config/opencode/ — load customize-opencode by name and follow it. Implement only actions within the implementation scope of this review; record anything out of scope in Section 9 for a future session instead of expanding scope.

Finalize the review only after implementing:

```bash
sed -i 's|status: "in-progress"|status: "completed"|' "$REVIEW_MD"
```

Then ask for an opencode restart to apply the changes: instructions, plugins, and skills load at server start, so the restart is what makes the new guidance and plugin behavior take effect. This is a documented limitation, not an error — unit tests cannot prove live wiring (recall the project lesson `troubleshooting/opencode-plugin-live-diagnosis`).

## Constraints

- Never ask to read entire session.json — use the session_parts.py CLI (conversation/parts/info/summary) for part/tool detail and stats; use jq only for ad-hoc queries the CLI does not cover (e.g., locating the crossing step for a threshold).
- Use RUG pattern: Decompose → Delegate → Validate → Iterate.
- Every recommendation must specify exact file path and concrete change.
- Review one session per invocation.
- Don't rely on agents reporting you intermediate findings. Make subagents immediately write their findings to the review.md file (changing the relevant sections).
- Prioritization follows the Prioritization policy in harness-management — never a local copy — capped at 1–3 actions.
- Implement only actions within the implementation scope of this review; defer anything out of scope to a future session.
- Keep the retrospect and session-analysis commands separate — they share doctrine, tooling, and schema, but must not be merged into one command.
- Do not invent evidence — every finding must trace to the transcript, the session_parts.py CLI output, or the pre-filled review.md sections; an empty section (`*None reported.*`) stays empty.
