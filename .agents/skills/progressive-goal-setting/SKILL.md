---
name: progressive-goal-setting
description: Load when a session has no goal yet and must set the goal the user is trying to achieve, because the gate blocks every tool except signal_send, execute, question and skill until a goal exists.
---

# Progressive Goal Setting

Understand the goal that the user is trying to achieve and provide a clear and concise response that addresses their request.

- **The gate blocks tools other than `signal_send`, `execute`, `question` and `skill` until a goal exists**, and a gate rejection is not an execute failure: set the goal, then retry.
