---
name: progressive-goal-setting
description: Load when a session has no goal yet and must set the goal the user is trying to achieve, because the gate blocks every tool except signal_send, execute, question and skill until a goal exists.
---

# Progressive Goal Setting

Understand the goal that the user is trying to achieve and provide a clear and concise response that addresses their request.

- **The gate blocks tools other than `signal_send`, `execute`, `question` and `skill` until a goal exists.** Setting the goal ends this stage and opens the plan stage, where every dispatch is blocked until `PLAN_READY`: send `SET_GOAL` alone in its own `execute` body, never in the same body as a dispatch, then write the plan and signal `PLAN_READY` before dispatching.
