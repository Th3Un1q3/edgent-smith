# dsh Plugin Enablement for a Coding Harness

The `dsh web` profile disables 25 plugins by default (literal `disabled: true` rows in the dsh-web-app patch layer), including: tool-bash, tool-fs, tool-fs-search, tool-skill, tool-subagent (+ control/list-agents/fork), plan-mode, tool-todo, tool-goal, agent-instructions (AGENTS.md loader), tool-str-replace-editor, tool-web.

For a coding harness (opencode parity) these MUST be re-enabled via home-level `cordis.patch.yml` — done in this session. tool-web's search backend `web-search-deepseek` needs `DEEPSEEK_API_KEY`: fetch works, search fails loud without it.