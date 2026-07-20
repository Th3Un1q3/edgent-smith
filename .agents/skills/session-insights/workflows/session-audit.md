# Audit Workflow

Answer the questions below to perform a session audit and identify weak points. Use session [schema](../references/schema.md) to learn how to perform lookups for session fields (messages, reasoning, tool calls, etc.) and extract the information you need.

## Questions

- What was the objective of the session?
- Has the objective been achieved(not achieved, partially, fully)?
- If not achieved, what were the blockers(perform root cause analysis with 5 Whys, make it at least 2 times independently, to make sure the root cause is correctly identified)?
- What skills were loaded during the session?
- What instructions(<steering/>) were send to the session?
- What tools were called during the session (what succeeded, what had errors)?
- What errors were encountered during the session?
- What agent was used during the session?
- How was token consumption distributed (system instructions, user messages, tool calls, etc.)?