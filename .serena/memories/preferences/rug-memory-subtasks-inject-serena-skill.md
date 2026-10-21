---
id: preferences/rug-memory-subtasks-inject-serena-skill
type: preferences
L0: "RUG memory subtasks get skills:['serena-memory'] — a child left to discover gateway activation burns 4-6 calls and loses its deliverable"
freshness: 2026-10-21
directory: preferences
---

A RUG subtask that recalls or writes memory must receive `skills: ['serena-memory']`.

Evidence: in the 2026-10-21 retrospective run, 7 of 13 children (recon, auditA, auditB, auditC, auditD, auditE, reduce) spent 3-6 calls each discovering the gateway activation (`mcp-find` -> `code-mode` -> `mcp-exec`) or the sandbox contract; auditB lost its memory write to budget exhaustion and auditC left its presence columns UNVERIFIED.

The injected skill states the chain and the synchronous contract, so passing it as `skills` removes the discovery cost without duplicating gateway facts in child prompts. The routing rule lives in `.opencode/agents/rug.md` under Writing a subtask prompt.