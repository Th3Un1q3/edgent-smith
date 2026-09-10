> Part of [DeepSeek Harness Guide](index.md) — L2 · Tool Separation + Models

# Tool Separation — Persona + Plugins + Sandbox

> L2 · Three layers. No code-level toolset.

| Layer | Mechanism | How it enforces |
|-------|-----------|-----------------|
| **Persona** | `dsh-persona` cardinal rule in `.agent-presets/rug/agent.cordis.yml` | Orchestrator forbids implementation; workers re-roled via delegation prompt |
| **Plugin composition** | `cordis.patch.yml` + `child-runtime/cordis.yml` + `agent.cordis.yml` | Host registers `subagent-dsh-sdk` once; restriction is persona not denial — preset has no `disabled: true`; child composes `tool-bash`/`tool-fs`/`mcp-gateway`; `sandbox-policy` + `bash-sandbox` provide OS boundary |
| **Sandbox** | `sandbox-policy: {mode: workspace-write, workspaceRoot: !!js process.cwd()}` + `bash-sandbox` Landlock | Child `bash` fails outside `workspace/` |

---

## 3.1 Orchestrator (host) — planning and delegation only

| Tool (Cordis ID) | Purpose |
|------------------|---------|
| `tool-todo` (`@deepseek-ai/dsh-tool-todo`, `allowParallelInProgress: true`) | Todo ledger — `#{type}: {description}` before any worker |
| `tool-goal` (`@deepseek-ai/dsh-tool-goal`) | `create_goal` / `get_goal` / `update_goal` durable objective |
| `tool-subagent` (`@deepseek-ai/dsh-tool-subagent`, `provider: spawn`, `continuable`) | Delegate every task to child-runtime |
| `tool-subagent-control` / `list-agents` | `send_message` resume, `list_agents`, `interrupt_agent` |
| `job_list` / `job_output` / `job_kill` | Poll `continuable` background workers |
| `ask_user_question` (`@deepseek-ai/dsh-tool-ask-user`) | Human-in-the-loop gate |
| `skill` (`@deepseek-ai/dsh-skill-filesystem`) | Load `.agents/skills` workflow |

Never directly: `tool-bash`, `tool-fs`, `tool-fs-search`, `tool-str-replace-editor`, `web_search` (delegate).

---

## 3.2 Worker (child-runtime) — execution only

| Tool (Cordis ID) | Purpose |
|------------------|---------|
| `tool-bash` (`@deepseek-ai/dsh-tool-bash`) | Shell inside Landlock workspace-write |
| `tool-fs` (`@deepseek-ai/dsh-tool-fs`) | Read/write artefacts (`workspace/<task>.md`, atomic) |
| `tool-fs-search` (`@deepseek-ai/dsh-tool-fs-search`) | `glob` / `grep` over repo |
| `tool-str-replace-editor` (`@deepseek-ai/dsh-tool-str-replace-editor`) | Precise file edits |
| `tool-todo` (`@deepseek-ai/dsh-tool-todo`) | Worker-local todo tracking |
| `skill` (`@deepseek-ai/dsh-skill-filesystem`) | Load domain skills |
| `web` / `mcp-gateway` (`@deepseek-ai/dsh-mcp-client`, `url: http://mcp_gateway:8080/mcp`, `failOnStartupError: true`) | Retrieval via gateway catalog (tavily, serena, 9 servers) |
| `sandbox-policy` + `bash-sandbox` | Landlock `workspace-write` boundary |

Never on worker: `subagent` delegation.

---

## 3.3 Persona — cardinal rule (verbatim)

```yaml
# .agent-presets/rug/agent.cordis.yml (DOT, USER_PRESET_DIR) — persona (harness-provided)
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: |-
      You are RUG — the Repeat Until Good orchestrator — powered by {{model}}, working in {{cwd}}.
      You are a pure orchestrator: a manager, not an engineer. You NEVER write code, edit files,
      run commands, or implement anything yourself. Every piece of actual work MUST be delegated
      to a worker subagent (subagent tool).
      You may use directly ONLY: todo_write, create_goal/get_goal/update_goal,
      subagent/send_message/list_agents/interrupt_agent, job_list/job_output/job_kill,
      ask_user_question, skill.
      If you catch yourself reaching for bash, read, write, edit, str_replace_editor, glob, grep,
      or web_search directly, STOP. Reframe as a worker task and delegate it.
```

Workers inherit same preset but delegation prompts re-role them as engineer

---

## 3.4 Model wiring — `settings.yaml` hot-reload

Both planes resolve models via `settings.yaml`. No code factory.

```yaml
# .dsh/settings.yaml — model routing (hot-reload, no restart)
llm-pi-ai:
  providers:
    opencode-go: { apiKeyEnv: OPENCODE_GO_API_KEY }
    openrouter: { apiKeyEnv: OPENROUTER_API_KEY, displayName: OpenRouter }
    local:
      displayName: Local Gateway (host.docker.internal:1289)
      api: openai-completions
      baseURL: http://host.docker.internal:1289/v1
      apiKeyEnv: LOCAL_GATEWAY_API_KEY
      models: [{ id: qwen3.6-28b-reap20-a3b, name: l-qwen3.6-28b, contextWindow: 128000 }]
agent-default-model: { provider: opencode-go, model: deepseek-v4-flash }
```

```yaml
# .dsh/child-runtime/cordis.yml — default model for child
- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config: { provider: deepseek-official, model: deepseek-v4-flash }
```

| Rule | Detail |
|------|--------|
| Hot-reload | Edit `settings.yaml` or web Models page — no restart |
| Per-request key | `dsh-credentials-local` resolves `apiKeyEnv` per LLM call |
| Default | `deepseek-v4-flash` both planes |

---

## 3.5 Provider — canonical (keep once here)

```yaml
# .dsh/cordis.patch.yml — out-of-process provider (do not duplicate in preset)
- insert:
    - id: subagent-dsh-sdk
      name: '@deepseek-ai/dsh-subagent-dsh-sdk'
      config:
        providerName: dsh-sdk
        command: node
        args:
          - --expose-internals
          - !!js process.env.HOME + '/.dsh/child-runtime/node_modules/@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/bin.js'
          - !!js process.env.HOME + '/.dsh/child-runtime/cordis.yml'
        maxTokens: 49152
        env:
          DSH_HOME: !!js process.env.HOME + '/.dsh/child-home'
          DEEPSEEK_API_KEY: !!js process.env.DEEPSEEK_API_KEY
```

> `!!js` is Cordis YAML tag — `yaml.safe_load` rejects it. Use harness loader.
> Referenced from [05-reference.md](05-reference.md) — do not duplicate.

**Sandbox excerpt:** `sandbox-policy` `mode: !!js process.env.DSH_PERMISSION_MODE ?? 'workspace-write'`, `workspaceRoot: !!js process.cwd()` — Landlock. Do not add `disabled: true` for `tool-bash`/`tool-fs` in preset (fiction).

---

← [Index](index.md) · [Next: Workflows →](04-workflows.md)
