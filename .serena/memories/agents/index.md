# Agents Domain Memory Index

The agents domain documents the agent runtime architecture and the RUG orchestrator pattern used across this project.

## Memories

| Memory | Description |
|--------|-------------|
| `agents/edge-agent` | Primary agent executor with built-in tool access — structure, tools, and execution flow |
| `agents/rug-orchestrator` | RUG orchestrator protocol — pure delegation, subagent task pattern, validation workflow |
| `agents/multi-agent` | Multi-agent patterns — agent cards, routing, specialization |
| `agents/agent-cards` | Agent card format and usage for subagent delegation |

## Cross-References

- `mem:cli/architecture` — CLI command routing to agents
- `mem:skills/architecture` — agent runtime within the context-gathering system
