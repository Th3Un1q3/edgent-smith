---
description: Instructs on how to run quality checks.
applyTo: ".opencode/**/*.{ts,js,json}"
appliesToAgents: rug-* # applies to entire agentic team
---

# Manual run of quality gates

> By default the quality gates trigger automatically on relevant files changes, and report the results in the chat. However, you can also run the quality gates manually to check the status of your plugin.

Always ensure the following when developing Opencode plugins:

From the '.opencode' directory, run the following commands to ensure that the plugin is working correctly:

```
just test
just test --coverage
just lint
just typecheck
just mutation
```

NEVER call underlying implementation commands directly (eg. `pytest`, `npm test`, `vitest`, `bun`, `tsc`) — always use the above commands to ensure that the plugin is tested, linted, and typechecked in the same way as it will be in production.
