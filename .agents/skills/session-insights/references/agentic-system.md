# Agentic System Improvement Patterns

## Usage

After completing a session review, map each audit finding to the pattern below that best describes it. For each match, propose a concrete change to the agentic system.

## Issue-Improvement Mapping

### P1 — Relevant skill loaded but objective not achieved

**Trigger:** Q2 = "not achieved" AND Q4 (skills loaded) is non-empty

*Action:* Update skill to make it more actionable and include more specific instructions for the agent to follow.

### P2 — No relevant skill loaded and objective not achieved

**Trigger:** Q2 = "not achieved" AND Q4 (skills loaded) is empty

*Action:* Add a new skill to the agent's skillset that is relevant to the session's objective.

### P3 — Files were edited but ineffectively (overcomplicated, missed test cases)

**Trigger:** Q2 = "partially achieved" AND Q6 shows file-editing tools present

*Action:*
- If relevant instructions shown — Update instructions to be more actionable and include more specific guidance for the agent to follow.
- If relevant instructions exist but were not shown — Update instructions include file globs to ensure they are shown in relevant edits.
- If no relevant instructions exist — Add new instructions to the agent's instruction set that are relevant to the session's objective.

### P4 — Initial request was too large, vague, or complex

**Trigger:** Q3 root cause mentions scope/complexity OR Q6 shows high ratio of text to tool parts

*Action:* Identify what change to the agent(.opencode/agents/rug.md) instruction would help breaking down such requests better.
