---
name: harness-verify
description: "Follow it when: editing DeepSeek harness files (.dsh/*, cordis*.yml) or DeepSeek harness docs (docs/deepseek-harness/**, docs/orchestrator-deepseek-guide.md). Enforces live harness verification before documenting."
applyTo: "{.dsh/**/*,docs/deepseek-harness/**/*,docs/orchestrator-deepseek-guide.md,**/cordis*.yml,**/.dsh/**/*}"
excludePaths: "**/*.bak,**/node_modules/**"
---

# Harness Verification — Live Checks Before Docs

Run the 5-step live verification ledger **before** editing any file matched by `applyTo`. Do not document from recall.

## Guidelines

- **Verify the binary first, write second.** Every `.dsh/*` or `docs/deepseek-harness/**` edit must be preceded by live `dsh` and file-system checks.
- **Fail fast on hallucinations.** The following strings must never appear in harness docs: `dsh agent-presets`, `dsh run`, `setup-dev.sh`, `.dsh/sessions/*.jsonl`, `pydantic-ai`, `FunctionToolset`. Add a negative grep gate for each.
- **Pin line counts and server counts.** Use `wc -l` and `grep -c "  type:"` to assert topology; never swap 69↔92 or 351↔465.
- **Distinguish template from runtime.** Repo `.dsh/` is template; runtime is `~/.dsh/` via `DSH_HOME`. Session dirs live at `~/.dsh/sessions/<id>/`, not `.dsh/sessions/`.

## Step-by-Step Workflow

### 1 — Pre-edit ledger (mandatory, <30s)

Run from `/workspace` and record outputs before any doc write. Abort the edit if any check fails.

```bash
# 1. Binary surface — 0.1.1-rc.2 only exposes web/plugin, requires --profile
dsh --help 2>&1 | head -n 20
# expect: web, plugin — no agent-presets, no run
dsh --version 2>&1 | head -n 5
# expect: 0.1.1-rc.2

# 2. Provider wiring — web must contain subagent, headless must ERR without pnpm add
dsh --profile web --dump-config 2>&1 | grep -c subagent-dsh-sdk
# expect: >=1 in web
dsh --profile headless --dump-config 2>&1 | grep -q "ERR_MODULE_NOT_FOUND.*dsh-subagent-dsh-sdk" && echo "headless missing provider (expected unless pnpm added)"

# 3. File sizes — fail on swapped counts
wc -l .dsh/settings.yaml .dsh/cordis.patch.yml .dsh/child-runtime/cordis.yml
# expect: 69 settings.yaml, 92 cordis.patch.yml, 465 cordis.yml (not 92/69, not 351/465 swapped)
wc -c .dsh/.credentials.yaml
# expect: ~117B

# 4. MCP catalog
grep -c "  type:" mcp/catalog.yaml
# expect: 9 (not 15)

# 5. Session persistence — HOME, not repo
ls ~/.dsh/sessions/ 2>&1 | head
# expect: per-session dirs under ~/.dsh/sessions/<id>/ — never .dsh/sessions/*.jsonl
```

### 2 — Negative gates (before commit)

```bash
! grep -Rq "dsh agent-presets" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "dsh run" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "setup-dev.sh" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "\.dsh/sessions/.*\.jsonl" docs/deepseek-harness/
! grep -Rq "pydantic-ai" docs/deepseek-harness/
! grep -Rq "FunctionToolset" docs/deepseek-harness/
```

### 3 — Install idempotency (when headless ERR fires)

```bash
pnpm --dir .dsh/child-runtime install --frozen-lockfile
pnpm --dir ~/.dsh/profiles/headless add @deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2
# re-run: dsh --profile web --dump-config | grep subagent-dsh-sdk
```

## Output Format

- No doc is considered complete until the 5-step ledger outputs are captured and negative gates pass.
- CI mirrors this ledger via `scripts/verify-agents-gates.sh` and `scripts/verify-harness-docs.sh` wired through `just lint` / `scripts/ci.sh`.

## Notes

- Instruction loads at opencode server start (see `troubleshooting/opencode-plugin-live-diagnosis`). After editing this file, request an opencode restart.
