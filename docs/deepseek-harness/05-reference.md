> Part of [DeepSeek Harness Guide](index.md) — L3 · Reference

# Reference — Skeletons, Observability, Risks, Gates

> L3 · Copy-paste skeletons and CI gates.

---

## 5.1 Child harness excerpt

```yaml
# .dsh/child-runtime/cordis.yml — worker harness (excerpt)
- id: llm
  name: '@deepseek-ai/dsh-llm'
- id: session
  name: '@deepseek-ai/dsh-session'
- id: session-persistence-jsonl
  name: '@deepseek-ai/dsh-session-persistence-jsonl'
  config: { root: !!js dshHomePath('sessions') }
- id: attachment-local
  name: '@deepseek-ai/dsh-attachment-local'
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: !!js process.env.DSH_PERMISSION_MODE ?? 'workspace-write'
    workspaceRoot: !!js process.cwd()
- id: tool-bash
  name: '@deepseek-ai/dsh-tool-bash'
- id: tool-fs
  name: '@deepseek-ai/dsh-tool-fs'
- id: tool-fs-search
  name: '@deepseek-ai/dsh-tool-fs-search'
- id: tool-str-replace-editor
  name: '@deepseek-ai/dsh-tool-str-replace-editor'
- id: mcp-gateway
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: gateway
    transport: streamable-http
    url: http://mcp_gateway:8080/mcp
    failOnStartupError: true
    toolCallTimeoutMs: 30000
- id: sdk-server
  name: '@deepseek-ai/dsh-sdk-jsonrpc-server'
```

`!!js` requires Cordis loader — generic `yaml.safe_load` fails.

---

## 5.2 Preset identity

```yaml
# .dsh/.agent-presets/rug/preset.yml (DOT, USER_PRESET_DIR per DSH 0.1.1-rc.2 lib/index.js:851, trust:user)
name: RUG Mode
description: >-
  Repeat Until Good orchestration. Top level: orchestrator holds trajectory
  (goal + todo ledger) and decomposes, delegates, validates. Lower level:
  workers do every implementation; validation is always separate; iterate until good.
order: 5
```

---

## 5.3 Provider — see canonical in [03-tool-separation.md](03-tool-separation.md) §3.5

Provider `subagent-dsh-sdk` with `node --expose-internals .../dsh-sdk-jsonrpc-demo/lib/bin.js .../cordis.yml`, `DSH_HOME=~/.dsh/child-home`, `maxTokens: 49152` is defined once in `cordis.patch.yml`. Do not duplicate. Reference: [03-tool-separation.md](03-tool-separation.md) §3.5.

Web profile ships provider and installs automatically via container postStart; headless still requires `pnpm --dir ~/.dsh/profiles/headless add @deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2`.

---

## 5.4 Observability & persistence

Repo `.dsh/` is template; runtime is `~/.dsh/` via `DSH_HOME`.

| Signal | Source (Cordis ID) | Location |
|--------|---------------------|----------|
| Session trajectory | `dsh-session` + `dsh-session-persistence-jsonl` | `~/.dsh/sessions/<id>/` (per-session dirs under HOME, not repo `.dsh/sessions/""*"/sessions""\.jsonl`) |
| Attachments | `dsh-attachment-local` | `~/.dsh/storages/` (HOME, not repo `.dsh/storages/`) |
| Session query | `dsh-session-query-sqlite` (`openAt: never`) | `ctx.sessionQuery` exact reads |

```yaml
# telemetry (DISABLED by default)
- id: session-telemetry-otel
  name: '@deepseek-ai/dsh-session-telemetry-otel'
  config:
    mode: !!js process.env.DSH_TELEMETRY_MODE || 'DISABLED'
    exporter:
      url: !!js process.env.DSH_TELEMETRY_OTLP_URL ?? 'https://harness-telemetry.deepseeksvc.com/v1/logs'
      timeoutMillis: 1000
```

Use `DSH_TELEMETRY_MODE=FULL` for prod, keep `DISABLED` for dev. Never log `apiKey`.

---

## 5.5 Risks

| Risk | Impact | Mitigation (harness-native) |
|------|--------|------------------------------|
| Persona bypass — orchestrator uses `tool-bash` directly | Delegation collapse | Persona cardinal rule + sandbox denies outside `workspace/`; test `dsh --profile web "try bash"` → must delegate |
| Harness drift — bind + `pnpm install` out of sync | Workers fail to spawn | `CI=true pnpm --dir ~/.dsh/child-runtime install --frozen-lockfile` runs automatically via container postStart (no manual step); pin `.dsh/child-runtime/package.json`/`pnpm-lock.yaml` |
| Silent worker failure | Todo stalls | `send_message` resume → fresh `subagent` on fail; validator catches |
| Validation collusion | Bad code passes | Always fresh validation worker; never reuse context |
| Telemetry leak | Secrets in OTLP | Keep `DISABLED` in dev; opt in via `DSH_TELEMETRY_MODE` |
| Over-parallel workers | Cost | `todo_write` ledger bounds launches; `maxTokens: 49152` per child |

---

## 5.6 References

| Skill | Use in this track |
|-------|-------------------|
| `harness-management` | Change Type Reference, Domain Match, Prioritization `recurrence × cost`, cap 1–3. Persona + `cordis.patch.yml` pinning follow this discipline. |
| `context-gathering` | Synthesis of `.serena/memories`, codebase exploration via `serena` MCP, external docs via `fetch`/`tavily`. |

| Path | Role |
|------|------|
| `.dsh/settings.yaml` | Model routing (hot-reload) |
| `.dsh/cordis.patch.yml` | Host patch + `mcp-gateway` + `subagent-dsh-sdk` (`DSH_HOME=~/.dsh/child-home`, `maxTokens: 49152`) |
| `.dsh/child-runtime/cordis.yml` | Worker harness (`tool-bash`, `tool-fs`, `tool-fs-search`, `tool-str-replace-editor`, `mcp-gateway`, `sandbox-policy`) |
| `.dsh/.agent-presets/rug/agent.cordis.yml` | RUG doctrine + `subagent` continuable, `todo`, `goal`, `plan-mode` |
| `.dsh/.credentials.yaml` | Secrets (`apiKeyEnv` per request) |
| `workspace/` + `experiments/` | File-based handoff (`artefact_ref` + summary) |

External docs: DeepSeek API `https://api.deepseek.com` (OpenAI-compatible, 128 tool calls, 1M context via `deepseek-official`); Cordis `dsh-sdk-jsonrpc-demo` bin (`node --expose-internals .../lib/bin.js .../cordis.yml`) + `DSH_HOME=~/.dsh/child-home`; MCP Gateway `http://mcp_gateway:8080/mcp` via `dsh-mcp-client`.

---

## 5.7 Acceptance checklist — gates scan `docs/deepseek-harness/*.md`

### A.1 Harness-only file health

```bash
! grep -q "Function""Toolset" docs/deepseek-harness/*.md
! grep -q "MODEL_F""ACTORIES" docs/deepseek-harness/*.md
! grep -q "resolve_model_""config" docs/deepseek-harness/*.md
! grep -q "log""fire\.instrument_pydantic_""ai" docs/deepseek-harness/*.md
! grep -q "async""io\.g""ather" docs/deepseek-harness/*.md
! grep -q "pydantic-""ai" docs/deepseek-harness/*.md
! grep -q "## 6 — Track ""A" docs/deepseek-harness/*.md
! grep -q "System ""A" docs/deepseek-harness/*.md
! grep -q "tool-bash.*disabled:"" true" docs/deepseek-harness/*.md
! grep -q "tool-fs.*disabled:"" true" docs/deepseek-harness/*.md
grep -q "DeepSeek Harness" docs/deepseek-harness/*.md
! grep -q "Two-""Track" docs/deepseek-harness/*.md
grep -q "Host Harness" docs/deepseek-harness/*.md
grep -q "Child Runtime" docs/deepseek-harness/*.md
! grep -q "Python""Process" docs/deepseek-harness/*.md
test $(cat docs/deepseek-harness/*.md | wc -l) -gt 600
test $(cat docs/deepseek-harness/*.md | wc -l) -lt 750
! grep -q "TO""DO" docs/deepseek-harness/*.md
! grep -q "FIX""ME" docs/deepseek-harness/*.md
```

### A.2 Manual review

- [ ] Title single-track DeepSeek Harness only
- [ ] No Python factory, no model factory dict, no config resolver
- [ ] No harness-outsider toolset / gather / tracing shim
- [ ] Orchestrator = host DSH session (RUG preset, persona, `todo`/`goal`/`subagent`/`send_message`/`skill`/`ask_user`)
- [ ] Worker = child-runtime via `dsh-sdk` provider (`node --expose-internals .../dsh-sdk-jsonrpc-demo/lib/bin.js .../cordis.yml`, `DSH_HOME=~/.dsh/child-home`, `maxTokens: 49152`)
- [ ] Both harness-native, tools as Cordis plugin IDs (`tool-bash`/`tool-fs`/`tool-fs-search`/`tool-str-replace-editor`/`mcp-gateway`/`sandbox-policy`)
- [ ] Tool separation three layers (persona verbatim + plugin composition + Landlock `workspace-write`)
- [ ] Workflows cover all 6 with harness primitives: decompose, parallel fan-out (`subagent` continuable + `job_list`/`job_output`), chain (`send_message`), DAG (todo ledger), consolidate (validation workers), follow-up (`send_message`/fresh + `plan-mode`)
- [ ] Prompt contract: CONTEXT / SCOPE / REQUIREMENTS / ACCEPTANCE / CONSTRAINTS / WHEN DONE
- [ ] YAML skeletons: child harness, `preset.yml`, provider referenced from 03 §3.5, with `!!js` notes
- [ ] Day-0 present in [01-quickstart.md](01-quickstart.md) — 5 harness-native steps
- [ ] References list `harness-management` + `context-gathering` only
- [ ] Leaves sum 600–750 lines, mermaid valid, no `TO` `DO` / `FIX` `ME` literals

```bash
! grep -Eq "Function""Toolset|MODEL_F""ACTORIES|resolve_model_""config|log""fire\.instrument_pydantic_""ai|async""io\.g""ather|pydantic-""ai" docs/deepseek-harness/*.md
grep -q "dsh-sdk-jsonrpc-demo" docs/deepseek-harness/*.md
grep -q "dsh-persona" docs/deepseek-harness/*.md
grep -q "sandbox-policy" docs/deepseek-harness/*.md
```

YAML `!!js` blocks are not generic YAML — validate with Cordis loader, not `yaml.safe_load`.

---

← [Index](index.md)
