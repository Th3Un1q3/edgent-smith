# Agentic System

## Issue-Improvement Mapping

1. Relevant skill was loaded, but session did not achieve its objective: Update skill to make it more actionable and include more specific instructions for the agent to follow.
2. No relevant skill was loaded, and session did not achieve its objective: Add a new skill to the agent's skillset that is relevant to the session's objective.
3. Files were edited but ineffectively (overcomplicated, missed test cases):
    - If relevant instructions shown - Update instructions to be more actionable and include more specific guidance for the agent to follow.
    - If relevant instructions exist but were not shown - Update instructions include file globs to ensure they are shown in relevant edits.
    - If no relevant instructions exist - Add new instructions to the agent's instruction set that are relevant to the session's objective.
4. Initial request was too large, vague, or complex for the agent to handle: Identify what change to the agent instruction would help breaking down such requests better.