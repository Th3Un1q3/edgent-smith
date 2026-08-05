# Context-Gathering Tool Stack

How the Docker MCP Gateway, code-mode sandboxes, Serena MCP server, and skill definitions interconnect to form the context-gathering system.

## Key Components

| Component | Role |
|-----------|------|
| Docker MCP Gateway | Hosts MCP servers (Serena, Tavily, DeepWiki, Context7) and makes their tools available via a unified interface |
| code-mode Sandbox | JavaScript sandbox that exposes selected server tools as synchronous JS functions for scripting |
| Serena MCP Server | Persistent memory store; 6 tools (write/read/list/edit/rename/delete), persists memories as Markdown files |
| Skill Definitions | Structured Markdown files (recipes + workflows + SKILL.md) documenting reusable patterns |
| Context-Gathering Skill | Meta-skill that combines all above into a tested methodology for research and memory management |

## Data Flow

1. A skill recipe declares which MCP servers it needs (e.g., serena, tavily)
2. The workflow activates a code-mode sandbox with those servers
3. The sandbox script calls MCP tools synchronously, combines results, and returns formatted output
4. For memory operations, the sandbox calls Serena tools (write_memory, read_memory, etc.)
5. Recipes store durable knowledge; multiple recipes can reference shared workflows

## Related

- Skill recipes should record verified live return formats (e.g. `write_memory` returns plain text, `list_memories` returns a wrapped JSON object), learned from real-server testing — see `mem:skills/general/live-testing-against-real-servers`.
- The 6 Serena memory tools in detail: `recipes/store-memories.md` and `recipes/manage-memories.md` in the context-gathering skill
- Naming and cross-reference conventions: `recipes/memory-convention.md` in the context-gathering skill