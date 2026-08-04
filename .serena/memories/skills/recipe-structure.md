# Recipe Structure for Context-Gathering Skill

Recipes live in the context-gathering skill's `recipes/` directory (one file per recipe); shared workflows live in `workflows/`. The per-recipe layout and the skill's routing table are canonical — see `recipes/_template.md` and `SKILL.md` in that skill.

## What This Project Adds Beyond the Template

- Recipes are verified against live MCP servers, so they record actual return formats and error behavior (e.g., `write_memory` returns plain text, `list_memories` returns a wrapped JSON object) — see `mem:skills/testing`.
- Structural layout otherwise follows the template unchanged.
