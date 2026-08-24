# dsh Runtime Behavior Notes

- Loads AGENTS.md/CLAUDE.md natively via the agent-instructions plugin.
- First-run bootstrap auto-creates `~/.dsh/profiles/<name>` scaffolds (symlink farm into npm prefix — harmless if the prefix is wiped; reinstall recreates them).
- Entry modes: `dsh web` (port 3080), `dsh --profile headless "task"` (exit 0 on completion), `dsh --profile <name>`.
- Plugin management: `dsh plugin --profile <name> add|remove|update|why <pkg|git-spec>`.

Install/pinning context: mem:tooling/deepseek-harness/install-pinning.