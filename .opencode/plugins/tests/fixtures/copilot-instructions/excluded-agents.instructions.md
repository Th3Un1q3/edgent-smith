---
excludeAgents: "team-excluded-member"
applyTo: '**/*.{ts,js,md}'
---

This instruction applies to all agents acessing any file, except when agent matches the glob pattern in `excludeAgents`. The value is a comma-separated list of agent names or glob patterns. Use `!` to exclude specific agents.