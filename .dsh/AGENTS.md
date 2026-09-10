# AGENTS KNOWLEDGE BASE (DeepSeek Harness — System B)

**OVERVIEW**: Harness-native execution plane for DeepSeek/Cordis RUG (System B). Template lives in repo `.dsh/`; runtime lives in `~/.dsh/` via `DSH_HOME`. Orchestrator delegates via `subagent-dsh-sdk` (`dsh-sdk` provider) to an out-of-process worker leaf (`child-runtime/cordis.yml`). Provider `opencode-go` / `deepseek-v4-flash` and sandbox `workspace-write` are pinned in `cordis.patch.yml`; mismatch causes `MISSING_CREDENTIAL` or `row did not activate` mount failure.

## STRUCTURE

```text
.dsh/
├── AGENTS.md                       # This file — directory knowledge base for DSH/Cordis domain
├── settings.yaml                   # provider block (opencode-go, openrouter, local), agent-default-model
├── cordis.patch.yml                # home-level patch layer: sandbox-policy, subagent-dsh-sdk (top-level, never in isolate group)
├── child-runtime/
│   ├── cordis.yml                  # minimal flat leaf: timer, hmr, llm, session, typert, agent, tool-bash/fs/search, skill, goal, jsonrpc-server, worker-mcp-gateway
│   ├── package.json / pnpm-lock.yaml
│   └── node_modules/@deepseek-ai/  # dsh-sdk-jsonrpc-demo, cordis plugins, dsh plugins
├── .agent-presets/
│   ├── orchestrator/agent.cordis.yml  # pure orchestrator (no bash/fs/web, delegates via worker/dsh-sdk)
│   ├── worker/agent.cordis.yml        # worker leaf (bash/fs/search, todo, skill)
│   └── orch-worker/agent.cordis.yml   # hybrid preset
├── child-home/                     # Mirrors HOME for child: settings.yaml + .credentials.yaml + sessions/
├── .credentials.yaml               # OPENCODE_GO_API_KEY via dsh-credentials-local (primary); env empty in container
└── profiles/ storages/ sessions/   # Runtime cache, not authoritative; live sessions at ~/.dsh/sessions/<id>/
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Provider + model pin | `.dsh/cordis.patch.yml:45-62` `subagent-dsh-sdk` block, `.dsh/child-runtime/cordis.yml:agent-default-model` | Must be `provider: opencode-go`, `model: deepseek-v4-flash` in both. Mismatch defaults to `deepseek-official` and fails credential. |
| Credentials | `.dsh/.credentials.yaml`, `.dsh/child-home/.credentials.yaml` | Read via `dsh-credentials-local`; verify credential via file exists not `env`. |
| Sandbox policy | `.dsh/cordis.patch.yml:sandbox-policy` `mode: workspace-write` | Deterministic; Landlock selected (bwrap EPERM in OrbStack). |
| Child runtime composition | `.dsh/child-runtime/cordis.yml` | Flat, no `isolate:` group. Top-level `tool-worker: dsh-sdk` only. Isolate group for dsh-sdk → mount failure. |
| Orchestrator preset | `.dsh/.agent-presets/orchestrator/agent.cordis.yml` | No bash/fs/web; delegates via `worker` (dsh-sdk). |
| Settings + model | `.dsh/settings.yaml` `agent-default-model: opencode-go / deepseek-v4-flash` | Align parent + child-home/settings.yaml; verify with `grep -A2 agent-default-model .dsh/settings.yaml` |
| Live verification | `dsh --profile web --dump-config \| grep subagent-dsh-sdk` | Web ≥1 hit; headless ERR unless `pnpm --dir ~/.dsh/profiles/headless add @deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2` |
| Harness docs | `docs/deepseek-harness/` + `docs/orchestrator-deepseek-guide.md` stub | Navigatable split; do not merge to monolith |
| MCP catalog | `mcp/catalog.yaml` `grep -c "  type:"` | Verify via `just verify-agents` before doc edits |

## CONVENTIONS

- **Pin provider/model in patch.** `subagent-dsh-sdk` config must declare `provider: opencode-go`, `model: deepseek-v4-flash`; never rely on defaults.
- **Credentials file primary, env fallback.** Forward `OPENCODE_GO_API_KEY` as `!!js process.env.OPENCODE_GO_API_KEY || undefined` so empty string does not shadow file store; `scrubbedParentEnv` strips `*KEY*` vars and `env` re-adds.
- **Keep parent/child aligned.** `agent-default-model` identical in parent `.dsh/settings.yaml` and child `.dsh/child-runtime/cordis.yml`; verify with `dsh --profile web --dump-config | grep -A6 subagent-dsh-sdk`.
- **Flat minimal child-runtime.** `child-runtime/cordis.yml` stays flat composition; no deepseek consumers; MCP gateway client `worker-mcp-gateway` only via `mcp_gateway:8080/mcp`.
- **Verify binary first, write second.** Every `.dsh/**/*` or `**/cordis*.yml` edit preceded by verification via `just verify-agents`: `dsh --help` → `dsh --profile web --dump-config` → topology checks → `ls ~/.dsh/sessions/`.
- **Use `pnpm --dir` flags.** Install child-runtime via `pnpm --dir .dsh/child-runtime install --frozen-lockfile`, not bare `pnpm install`.

## ANTI-PATTERNS (THIS DIRECTORY)

- Do not add an `isolate: {compaction:true}` group around `subagent-dsh-sdk` — top-level `insert` only; grouped isolate causes mount failure `row(s) did not activate` (`lib/index.js:680-850`).
- Do not assume `.dsh/sessions/*.jsonl` — live sessions are at `~/.dsh/sessions/<id>/` via `DSH_HOME` (`dshHomePath('sessions')`); repo `.dsh/child-home/sessions/` is mirror, not canonical.
- Do not use `ENV` as primary credential source — `env | grep OPENCODE_GO_API_KEY` is empty in container; verify credential via file exists instead.
- Do not use `dsh agent-presets`, `dsh run`, or `setup-dev.sh` — `dsh 0.1.1-rc.2` only exposes `web` and `plugin`, requires `--profile web` flag (see `harness-verify.instructions.md` ledger).
- Do not conflate System A (`agents/edge.py`, `config.py` root, `pydantic-ai` in `pyproject.toml`) with System B (`.dsh/*`); boundaries in `/workspace/AGENTS.md:158-169` forbid cross-edits.
