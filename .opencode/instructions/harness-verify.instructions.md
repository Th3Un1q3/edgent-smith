---
name: harness-verify
description: "Follow it when: editing DeepSeek harness files (.dsh/*, cordis*.yml) or DeepSeek harness docs (docs/deepseek-harness/**, docs/orchestrator-deepseek-guide.md). Points at the live verification ledger before documenting."
applyTo: "{.dsh/**/*,docs/deepseek-harness/**/*,docs/orchestrator-deepseek-guide.md,**/cordis*.yml,**/.dsh/**/*}"
excludePaths: "**/*.bak,**/node_modules/**"
---

# Harness Verification

Run the live verification ledger in `.agents/skills/harness-management/workflows/harness-verify.md` before editing any file this instruction matches. Run its binary, provider, topology, catalog, and session checks, its negative gates, and its install-idempotency commands.

- Describe the repo `.dsh/` template; the runtime lives in `~/.dsh/` and session state is never `.dsh/sessions/*.jsonl`.
- Do not introduce a string the workflow's negative gates forbid, and do not treat an unrun ledger as evidence.
- Follow the topology and `scripts/conductor/` scaffolding rules in `.opencode/instructions/justfiles.instructions.md`; run `just verify-agents`.
- CI re-runs the same checks through `scripts/verify-agents-gates.sh` and `scripts/verify-harness-docs.sh`.
