# Tech Stack Synthesis Overview (verified live 2026-08-24)

> **SCOPE CORRECTION (2026-08-25):** Targets the ENTIRE ORGANIZATION ([Company]) - heterogeneous teams; GitHub + Copilot custom agents confirmed in use; other agents/languages vary per team. Picks split into **UNIVERSAL** (agent/language-neutral) vs **PER-STACK** options.

Five parallel research tracks synthesized into tech-stack picks for the AI-adoption platform; every repo license/stars/maintenance status was live-checked via GitHub API on 2026-08-24. Deck slide: docs/new-deck.html section #/6 (reframed org-wide on 2026-08-25).

## Constraints honored
Picks preserve existing commitments: DevContainer-first development, OpenCode as coding-agent framework, Docker MCP Gateway with digest-pinned catalog, pydantic-ai for runtime agents, Serena memory store per ADR-002 write gate.

## Track picks (details in per-track memories)
- Environments: Dev Container baseline; Coder for pods; gVisor/E2B isolation - see `mem:researches/agent-environments-stack-2026-08`
- Sidecar & governance: Features+mise, Gateway interceptors+Cedar (UNIVERSAL), OpenCode layered config/plugins (PER-STACK option), OCI skills distribution, Presidio PII - see `mem:researches/agent-sidecar-governance-stack-2026-08`
- Institutional knowledge: Graphiti over Neo4j CE, MADR ADRs as-is, lightweight aggregator into org-level graph-backed store behind MCP (pydantic-ai = PER-STACK option), github-mcp-server collector - see `mem:researches/institutional-knowledge-stack-2026-08`
- Skills subsystem: ORG-level git-synced skills monorepo + generated index, evals PER-STACK (inspect_ai Python-heavy teams / promptfoo JS-heavy CI), Langfuse telemetry - see `mem:researches/skills-subsystem-stack-2026-08`
- Review & metrics: PR-Agent, claude-code-action autofix, DevLake DORA metrics - see `mem:researches/review-metrics-stack-2026-08`

## Method lesson
Requiring at least 3 candidates per requirement plus a separate dead-end list worked well - the list below prevents re-litigating rejected options.

## Cross-agent governance & portability research (verified 2026-08-25)
- AGENTS.md is the vendor-neutral standard (agentsmd/agents.md; Linux Foundation Agentic AI Foundation; ~24k stars, 60k+ repos). Read natively by Copilot coding agent, Codex, Cursor, Gemini CLI, opencode, Windsurf, Devin, Zed, Aider. Claude Code does NOT read it natively - CLAUDE.md shim `@AGENTS.md` (migrator exists in v2.1.213). No .well-known/remote discovery mechanism found - repo-root closest-wins only.
- Copilot org governance GA: org-wide custom instructions; org custom agents distributed from /agents/*.md in the org .github/.github-private repo; model/feature access policies (changelog 2026-07-29 default-model enablement).
- Claude Code enterprise controls: managed-settings.json channels (/Library/Application Support/ClaudeCode/, /etc/claude-code/, Program Files + managed-settings.d, MDM plist, claude.ai console); PreToolUse hook deny survives bypassPermissions; plugin marketplaces bundle skills/hooks/MCP.
- Cross-agent portability: SKILL.md adopted by Codex CLI + Copilot (~490k skills per secondary source). NO unified permissions/hooks compiler exists - build a thin internal generator/sync.
- Distribution verdict: HYBRID - platform-level controls govern, git carries content (AGENTS.md/skills); dotfiles-scale rejected.

## Dead ends (rejected; do not re-evaluate without new evidence)
Daytona closed-source 2026-06 | DevPod stalled since 2025-11 | KuzuDB archived 2025-10 | Zep CE discontinued 2025-04 | llm-guard archived 2026-07 | openai/evals shutdown Nov 2026 | sweep stale Sep 2025 | log4brains dormant | four-keys archived Jan 2024 | Phoenix Elastic-v2 license caveat | vscode-dev-containers archived (moved to devcontainers org).