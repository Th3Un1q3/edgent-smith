# Agent Sidecar & Governance Stack R1-R6 (researched 2026-08-24)

8 websearch ops OK; grounded in mem:docker-mcp-gateway/security-controls + mem:refactoring/permission-hooks.

## R1 Baseline toolchain sync
- devcontainer Features: containers.dev spec, MIT; OCI-distributed feature images; org is DevContainer-first.
- mise: jdx/mise, MIT, 32.9k stars, v2026.7.5 Jul 2026; pins runtimes+CLIs via npm:/pipx:/cargo:/ubi backends; reads .tool-versions; tasks+env built in.
- uv (astral-sh, MIT/Apache-2.0): PEP 723 inline-dep scripts.
- asdf (Go rewrite): mature plugin base, slower shims.

## R2 Config governance for coding agents (ORG SCOPE, rescored 2026-08-25)
Org-level config floor: Copilot org settings + Claude Code managed-settings.json layered ABOVE the git-carried AGENTS.md baseline (+ CLAUDE.md shim `@AGENTS.md` for Claude Code). Enforcement: per-agent hooks (Claude Code PreToolUse deny is non-bypassable - survives bypassPermissions) + lefthook.
- OpenCode permission schema: allow/ask/deny; per-tool glob rules (bash git * = allow); per-agent overrides in JSON or MD agents; keys: read/edit/bash/webfetch/task/skill/doom_loop etc.
- [PER-STACK OPTION - edgent-smith uses OpenCode] OpenCode layered config precedence: remote .well-known/opencode (ORG DEFAULTS) > global > OPENCODE_CONFIG > project opencode.json > inline env > managed files / macOS MDM mobileconfig (non-overridable). experimental.policies exists.
- Claude Code managed policy settings + settings.json hooks model: enterprise channels verified 2026-08-25 (/Library/Application Support/ClaudeCode/, /etc/claude-code/, Program Files + managed-settings.d, MDM plist, claude.ai console). Copilot org governance GA: org-wide custom instructions; custom agents from /agents/*.md in the org .github/.github-private repo; model/feature access policies (changelog 2026-07-29).

## R3 Hooks inject checks+context
- [PER-STACK OPTION] OpenCode plugins (.opencode/plugins TS): tool.execute.before/after, event permission.asked, session.compacting context injection, custom Zod tools. KNOWN ISSUE: permission.ask hook typed but NOT dispatched in v1.18.4; use event permission.asked + SDK reject.
- Claude Code hooks: UserPromptSubmit/SessionStart additionalContext injection; PreToolUse deny holds even in bypassPermissions. Pattern reference.
- pre-commit (MIT) / lefthook (MIT) for deterministic file checks.

## R4 Regulate agent actions
- Docker MCP Gateway interceptors VERIFIED: flag --interceptor=before|after:exec|docker|http:<target>, applies to tools/call; before can block or substitute response. Runs on EXISTING gateway - zero new infra. UNIVERSAL org pick (MCP is agent-agnostic).
- OPA/Rego (Apache-2.0, CNCF) expressive but error-prone per independent research; Cedar (cedar-policy, Apache-2.0, formally verified, AWS Verified Permissions; Jul 2026 AWS blog shows 3-layer MCP policy pattern) - UNIVERSAL org policy pick alongside Gateway interceptors.
- Microsoft Agent Governance Toolkit + agentmesh-mcp-proxy: OSS public preview Apr 2026, YAML/OPA/Cedar policies on MCP calls; young but notable.
- GAP: deck goal learns acceptable risk per project has NO healthy OSS equivalent; nearest is OpenCode session always-approve plus policy iteration in git. Greenfield.
- Greenfield additions (checked 2026-08-25, no healthy OSS found): risk-learning loop; cross-agent permission/hook compiler - no unified permissions/hooks format exists across agents, build a thin internal generator/sync.

## R5 Skills distribution
- Anthropic Agent Skills spec (Dec 2025), stewarded at agentskills GitHub org, cross-agent adoption (Claude Code, Cursor, Copilot, Codex).
- OCI artifacts: skills-oci (salaboy, ORAS-based; skills.json + skills.lock.json digest pinning; cosign/SBOM reuse); spec by ThomasVitale; stacklok toolhive-core oci/skills + oci/plugins packages.
- Git partial clone + sparse-checkout: production-ready monorepo pattern; Claude plugin marketplaces support sha/ref pinning + archive sha256.
- skills.sh (Vercel) exists; format fragmentation risk flagged by community.

## R6 Optional PII filter
- Presidio: MIT, ~10.5k stars, moved microsoft to data-privacy-stack community org, active; analyzer/anonymizer/structured modules; lib or docker API - natural fit as gateway after-interceptor container. KEPT UNIVERSAL after-interceptor pick (reviewed 2026-08-25).
- NeMo Guardrails (NVIDIA, Apache-2.0): built-in Presidio input/output rails; GLiNER-PII NIM option.
- Guardrails AI (Apache-2.0): validator hub.
- AVOID llm-guard: repo ARCHIVED Jul 2026 after ProtectAI/Palo Alto deal - dormant-library trap confirmed.