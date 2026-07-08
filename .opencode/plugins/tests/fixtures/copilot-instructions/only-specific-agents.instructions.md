---
applyTo: '**/*.{ts,js,md}'
appliesToAgents: "{agent1,agent2,team-*}"
excludeAgents: "{team-excluded-member}"
---

Match only specific agents with the `appliesToAgents` property. The value is a comma-separated list of agent names or glob patterns. Use `!` to exclude specific agents.