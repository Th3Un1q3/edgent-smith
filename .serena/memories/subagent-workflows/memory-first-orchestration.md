# Memory-First Orchestration

**Use when:** decomposing a RUG-style orchestrator task, drafting subagent prompts, validating subagent output, or auditing compliance with rug.md.

## What

/workspace/.opencode/agents/rug.md enforces memory-first search across its protocol, decomposition, prompt, validation, failure-mode, and skill-enforcement sections. The orchestrator collects relevant Serena memories BEFORE decomposing or exploring code.

## Why

The orchestrator previously skipped the memory store entirely, so lessons in Serena went unused. The rule makes memory collection the mandatory first step.

## How

1. The orchestrator's own permissions deny direct memory access — it ALWAYS delegates the search to a discovery subagent.
2. The discovery subagent follows the `context-gathering` skill's collect-relevant-memories recipe: list domains → read domain `about` → fetch matching memories.
3. Serena is reached ONLY via the `serena` MCP server through the gateway tools (gateway_mcp-find → gateway_code-mode → gateway_mcp-exec) — never by reading `.serena/memories/**` with file tools.

Related: mem:subagent-workflows/prompt-discipline (prompt template embeds the memory-first step), mem:subagent-workflows/verification-retries (validation checks memory usage).
