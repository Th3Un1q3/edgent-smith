# Sub-Agent Workflows

Process learnings for dispatching and verifying sub-agents in orchestrator-driven (RUG-style) sessions.

**Use when:** delegating work to subagents, launching validation, handling silent/early returns, managing the todo list.

## Scope

- Prompt discipline - drafting subagent prompts that carry the needed context and constraints.
- Verification and retries - launching validation, handling silent/early returns, retry policies.
- Memory-first orchestration - collecting relevant Serena memories before decomposing a task or drafting prompts.
- Retrospective lessons from completed RUG sessions - design-churn avoidance, up-front constraint clarification, live verification requirements for plugin hooks.

## Boundaries (out of scope)

- Research/context-gathering process knowledge - see mem:research-process/about.
- Devcontainer/compose workflow knowledge - see mem:devcontainer-workflows/about.

## Related Domains

- mem:research-process/about - research tasks that orchestrators delegate to subagents.
- mem:devcontainer-workflows/about - devcontainer changes that orchestrators delegate to subagents.
