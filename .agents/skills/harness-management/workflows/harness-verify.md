# DSH Harness Verification Workflow

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

## Independent Review and Blocking Gate

**Failure this prevents:** a harness change its own author approved. The author grades the work, confirms its own bias, and a prose "looks fine" talks past a weak check.

Independent review runs before the change lands:

1. Hand the proposed diff to an independent reviewer. Realization: a fresh agent session with the live ledger outputs and negative-gate results. Fallback where the environment cannot spawn a fresh agent session (GitHub Copilot); for Conductor (scaffold) and System A (harness-free runtime), which are not harnesses and have no session/loader layer, withhold the author's rationale in the prompt and record the reviewer identity and the blindness conditions enforced. Where no independent reviewer exists, mark the capability gap and name who verifies — a human who runs `just verify-agents`, or a CI job on the repo.
2. The reviewer re-runs the ledger and the negative gates, then names every gate the author skipped, every claim the ledger does not support, and every file the change touches outside its stated scope.
3. Record the findings. A finding blocks the change until fixed or explicitly waived by the user in the session.

The gate is an exit code, not prose:

- `just verify-agents` exits nonzero on any topology failure, and each negative gate `! grep -Rq ...` exits nonzero on a forbidden string.
- Treat any nonzero exit as blocked. Do not proceed on a hand-written "verified" note. See `.opencode/instructions/no-permission-workarounds.instructions.md` for gated-command handling.
- This gate runs on a shell with `just`. Where the environment has no shell (GitHub Copilot; Conductor scaffold and System A, which are not harnesses), the exit-code gate is not available: mark the capability gap and name the verifier — a human who runs `just verify-agents`, or a CI job on the repo.

## Verify

- Run `just verify-agents` (wires the `AGENTS.md` `## VALIDATION` section grep gates) and confirm PASS. Confirm the exit code is 0; a nonzero exit blocks the change per Independent Review and Blocking Gate.
- Confirm `.dsh/AGENTS.md` exists as directory knowledge base for DSH/Cordis context (see `workflows/directory-agents-md.md`).
- Confirm `.opencode/instructions/cordis-credentials.instructions.md` is removed — its credential content now lives in `.dsh/AGENTS.md` WHERE TO LOOK + CONVENTIONS (not a scoped instruction).

## Notes

- Plugin changes load at opencode server start (see [passive-hooks.md](./passive-hooks.md)); unit tests cannot prove live hook wiring. After editing this workflow or `harness-verify.instructions.md`, request an opencode restart. DSH harness files (`.dsh/**`) need no opencode restart — DSH picks them up at the next DSH session (see the root `SKILL.md`).
