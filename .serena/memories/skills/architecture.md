# Skills Architecture

How the Docker MCP Gateway, code-mode sandboxes, Serena MCP server, and skill definitions interconnect to form the context-gathering system.

## Key Components

| Component | Role |
|-----------|------|
| Docker MCP Gateway | Hosts MCP servers (Serena, Tavily, DeepWiki, Context7) and makes their tools available via a unified interface |
| code-mode Sandbox | JavaScript sandbox that exposes selected server tools as synchronous JS functions for scripting |
| Serena MCP Server | Persistent memory storage; 6 tools (write/read/list/edit/rename/delete), stores as Markdown files in `.serena/memories/` |
| Skill Definitions | Structured Markdown files (recipes + workflows + SKILL.md) documenting reusable patterns |
| Context-Gathering Skill | Meta-skill that combines all above into a tested methodology for research and memory management |

## Data Flow

1. A skill recipe declares which MCP servers it needs (e.g., serena, tavily)
2. The workflow activates a code-mode sandbox with those servers
3. The sandbox script calls MCP tools synchronously, combines results, and returns formatted output
4. For memory operations, the sandbox calls Serena tools (write_memory, read_memory, etc.)
5. Recipes store durable knowledge; multiple recipes can reference shared workflows

## Integration Points

- `mem:` cross-references in memory content create navigable links between stored knowledge
- Hierarchical naming (using `/`) organizes memories into topic trees
- Recipe SKILL.md routing tables map triggers to actions and recipe files

## Reference

- `mem:skills/memory-system/overview` - the 6 Serena memory tools in detail
- `mem:skills/recipe-structure` - how recipes are structured and organized
- `mem:skills/memory-system/conventions` - naming and cross-reference conventions