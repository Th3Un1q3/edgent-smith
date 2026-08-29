# Skills Subsystem Stack Research (2026-08-24)
Input for docs/new-deck.html tech stack. Verified via GitHub API + web same day.

## R1 Registry/Index
- anthropics/skills Apache-2.0, huge stars, active — reference SKILL.md corpus
- obra/superpowers MIT, very large adoption (~2.8M installs claim) — community corpus + writing-skills best-practices (negation lesson source)
- Vercel skills.sh (launched Feb 2026): npm-like installer; OSS under vercel-labs (skills-handler / agent-skills); supports claude-code, codex, cursor, copilot, goose, opencode…
- Dedup: NVIDIA/SkillEvaluator (Apache-2.0, Python, created 2026-06-24, 288*) has Tier-2 semantic-overlap dedup; kura CLI = 12 rule-based SKILL.md checks
- Pick (ORG SCOPE 2026-08-25): git-synced ORG-level skills monorepo (per-repo consumer dirs like .agents/skills + .opencode/skills mount from it) + generated cross-agent index via swarmclawai/agent-skills-lint (validator+installer+index gen, TS, small). SKILL.md read natively by Copilot + Codex among others (verified 2026-08-25).

## R2/R3 Evals
- inspect_ai (UK AISI, Apache-2.0): agentic evals, docker sandboxes, model-graded scorers — best fit for inject-skill+repo+task [PER-STACK option: Python-heavy teams]
- promptfoo (24.5K*, TS): rubric/assertions, CI-friendly, battle-tested [PER-STACK option: JS-heavy CI]
- deepeval (17.8K*): G-Eval/DAG, agent metrics
- pydantic-evals (in pydantic/pydantic-ai, MIT): LLMJudge builtin, code-first; ZERO internal experience — pilot only
- openai/evals: DEPRECATED, shutdown Nov 30 2026 — avoid
- Harness pattern: SWE-agent/mini-swe-agent (6.7K*, MIT?) minimal loop, 65% SWE-bench Verified
- Linters: agent-ecosystem/skill-validator (Go, 231*), himself65/skill-lint (14*), skillscore, NVIDIA quality gates. No high-adoption linter exists → gap; negation-word rule must be custom

## R4 Telemetry/Harvesting
- langfuse/langfuse 33.6K*: core MIT, full product self-host, HAS native Trace-OpenCode integration (OpenCode experimental OTel). UNIVERSAL telemetry backend (org-wide).
- Arize Phoenix 11.2K*: Elastic License v2 (managed-service restriction)
- Helicone 6.1K*: gateway-proxy centric
- OTel GenAI semconv: Development status as of May–Aug 2026, NOT stable
- Span emitters are thin PER-AGENT plugins/hooks on any agent platform (e.g. OpenCode plugin events event/chat.message/tool.execute.after, Claude Code hooks, Copilot extensions) or session-storage export → Langfuse; harvesting/mining missing skills = custom, no OSS

Gaps: no adopted SKILL.md linter w/ negation detection; no OSS session→skill harvester; semconv instability; dedup tooling young.
Confidence: high on existence/license/maintenance (live-checked); star counts order-of-magnitude; unverified: canonical vercel-labs repo split, scope of openai evals shutdown.

## Spec completion (recovery pass, 2026-08-24)
- promptfoo is the designated task-evals RUNNER-UP to inspect_ai.
- Usage telemetry must capture skill-load spans (load-to-unload per skill) via each agent's emitter plugin/hook, not only generic traces.
- OTel GenAI semconv: pin attribute names internally; upstream sits at Development status mid-2026.