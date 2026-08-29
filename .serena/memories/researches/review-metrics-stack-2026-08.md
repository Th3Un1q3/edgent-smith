# Review & Metrics Stack (verified live 2026-08-24)

Reviewed 2026-08-25: confirmed org-universal (GitHub-level, language-agnostic).

PR review: PR-Agent (MIT-core, ~12k stars) plus CODEOWNERS/rulesets. Alternative: claude-code-action (MIT, ~8k stars).

CI autofix: claude-code-action triggered on failed workflow_run; end-state target is a webhook that spawns a fix agent in a dev pod.

Quality gates: pre-commit locally, per-agent file-write hook gates (Claude Code PreToolUse/PostToolUse hooks, Copilot review config, OpenCode plugins), Sonar in CI.

Hardening: mutation testing with mutmut (Python) and StrykerJS (TypeScript); complexity rules ruff PL/C90 + eslint-complexity; coverage floors via coverage.py / vitest.

Delivery metrics: Apache DevLake (Apache-2.0, graduated) for DORA signals - rework, lead time - visualized in Grafana; Copilot metrics API for suggestion acceptance rates; DX Core 4 as overlay.