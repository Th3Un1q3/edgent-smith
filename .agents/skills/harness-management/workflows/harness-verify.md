# Harness Verification Workflow — Live Ledger Process

Use this workflow when any change touches DSH harness files (`.dsh/**/*`, `**/cordis*.yml`, `docs/deepseek-harness/**`).

## When to Use

- Editing `.dsh/settings.yaml`, `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, or `.dsh/.agent-presets/**` (orchestrator preset).
- Documenting harness topology in `docs/deepseek-harness/**`.
- Migrating process guidance that does not belong in a file-type instruction per `harness-management` Change Type Reference row 1 vs row 2.

## Process vs File-Type Split

- **File-type instruction** (`.opencode/instructions/harness-verify.instructions.md`) stays for editor scoping: `name: harness-verify`, `applyTo: "{.dsh/**/*,docs/deepseek-harness/**/*,docs/orchestrator-deepseek-guide.md,**/cordis*.yml,**/.dsh/**/*}"` — correct glob (not literal list). It enforces topology and hallucination gates when those files are edited.
- **This skill workflow** holds the *process*: the live verification ledger that an agent runs before any harness edit. Domain Match: DSH verification workflow failure belongs in the skill governing harness process, not a generic scoped instruction fallback.

## Live Verification Ledger (mandatory, <30s)

Run from `/workspace` and record outputs before any doc or patch write. Abort if any check fails. Prefer `just verify-agents` for topology.

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

# 3. Topology — verify via just verify-agents (no hardcoded line counts)
just verify-agents
# fallback: ls -l .dsh/settings.yaml .dsh/cordis.patch.yml .dsh/child-runtime/cordis.yml && test -f .dsh/.credentials.yaml

# 4. MCP catalog — verify via just verify-agents
grep -c "  type:" mcp/catalog.yaml
# no hardcoded count

# 5. Session persistence — HOME, not repo
ls ~/.dsh/sessions/ 2>&1 | head
# expect: per-session dirs under ~/.dsh/sessions/<id>/ — never .dsh/sessions/*.jsonl
ls .dsh/child-home/sessions/--workspace--/ 2>&1 | head
# expect: mirror only; live source is ~/.dsh/sessions/
```

## Negative Gates (before commit)

```bash
! grep -Rq "dsh agent-presets" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "dsh run" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "setup-dev.sh" docs/deepseek-harness/ docs/orchestrator-deepseek-guide.md
! grep -Rq "\.dsh/sessions/.*\.jsonl" docs/deepseek-harness/
! grep -Rq "pydantic-ai" docs/deepseek-harness/
! grep -Rq "FunctionToolset" docs/deepseek-harness/
```

## Install Idempotency (when headless ERR fires)

```bash
pnpm --dir .dsh/child-runtime install --frozen-lockfile
pnpm --dir ~/.dsh/profiles/headless add @deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2
# re-run: dsh --profile web --dump-config | grep -c subagent-dsh-sdk  # expect >=1
```

## Verify

- Run `just verify-agents` (wires `AGENTS.md:190-209` 7 grep gates) and confirm PASS.
- Confirm `.dsh/AGENTS.md` exists as directory knowledge base for DSH/Cordis context (see `workflows/directory-agents-md.md`).
- Confirm `.opencode/instructions/cordis-credentials.instructions.md` is removed — its credential content now lives in `.dsh/AGENTS.md` WHERE TO LOOK + CONVENTIONS (not a scoped instruction).

## Notes

- Plugin and instruction changes load at opencode server start (see `troubleshooting/opencode-plugin-live-diagnosis`). After editing `.dsh/AGENTS.md` or this workflow or `harness-verify.instructions.md`, request an opencode restart — unit tests cannot prove live hook wiring.
