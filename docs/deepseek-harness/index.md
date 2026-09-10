# DeepSeek Harness Guide — Index

> L0 · 30-sec hub — start here.

Host DSH session (RUG preset, Cordis) orchestrates; child-runtime (dsh-sdk) executes. Both Cordis, tools via harness plugins.

---

## Hub — pick your time budget

| Goal | File | Lines | Time |
|------|------|-------|------|
| 5-min run | [01-quickstart.md](01-quickstart.md) | ~82 | 5 min |
| Build architecture | [02-architecture.md](02-architecture.md) | ~92 | 10 min |
| Tool separation + models | [03-tool-separation.md](03-tool-separation.md) | ~130 | 10 min |
| Run workflows | [04-workflows.md](04-workflows.md) | ~104 | 10 min |
| Reference & gates | [05-reference.md](05-reference.md) | ~180 | 30 min |

Total ~588 + index 44 ≈ 632 + nav overhead.

---

## Map

- **01** — trimmed mermaid, Day-0 5 steps, exit criteria.
- **02** — full mermaid, roles table, `.dsh/*` inventory (69L/92L/351L/465L/117B).
- **03** — persona verbatim, plugin tables, model wiring, provider canonical.
- **04** — prompt contract, 6 patterns (decompose → follow-up).
- **05** — YAML skeletons, preset, observability (`~/.dsh/sessions/`), risks, gates.

---

## Conventions

| Convention | Rule |
|------------|------|
| Harness-only | Host + child Cordis; no Python factory |
| Handoff | `workspace/<task>.md` + `artefact_ref` |
| Models | `settings.yaml` hot-reload, `apiKeyEnv` per request |
| Links | Every leaf → `← [Index](index.md)` |
| Paths | Repo `.dsh/` template → runtime `~/.dsh/` via `DSH_HOME` |
| Profiles | `dsh --profile web` (default, has provider); headless needs manual `dsh-subagent-dsh-sdk` |

---

*Stub: [../orchestrator-deepseek-guide.md](../orchestrator-deepseek-guide.md) redirects here.*
