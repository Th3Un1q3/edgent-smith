# Ponytail Review Run: What Delegation Prompts Withhold Causes Failures

A delegating review run fails mostly on what its subtask prompts withhold, not on the code under review. Three rules:

1. **Name a write allowlist in every subtask prompt.** User-owned files (`.opencode/agents/rug.md`, `.opencode/agents/rug-swe.md`) stay outside every write scope. A blocked child edits a neighbour file instead, and the validator finds the damage only afterwards.
2. **Quote exact edit anchors and confirm they exist before dispatch.** A paraphrased or unchecked "verbatim" anchor costs one failed edit per retry until the tool-call budget dies: 3 of 6 substantive subtasks hit that cap in this run.
3. **When acceptance criteria conflict, state which wins.** Turn an unmeasurable bar into a concrete test; otherwise a child satisfies the criterion that damages the tree and the work needs three rounds.

Related: mem:skills/general/edit-heavy-task-splitting, mem:skills/general/prompt-qa-review-of-skill-files.