---
id: researches/audits/agents-md
type: researches
L0: "21 genre-narration sentences in AGENTS.md (L6,10,66,86,90,104,112,117,129,138,144,151,153,169,177,182,186,188,189,190,213) plus 5 overlap clusters."
hotness: 0.4
ttl: 180d
provenance: review of /workspace/AGENTS.md at commit a7ce51d, 2026-10-23
---
# Genre narration in AGENTS.md

Pattern: sentences whose subject is a document, instruction, skill, memory, or harness artifact, describing its genre, role, routing, or history. Pointer-only lines ("see X for Y") are excluded by the task.

## Findings (21)

1. L6 "**Last verified:** 2026-09-21" — document self-status; tells nothing about the repo.
2. L10 "Use this world model to effectively navigate any task." — instruction about reading the artifact.
3. L66 "Conductor scaffold — Python workers (YAML planned)" — planned artifact state, not behaviour.
4. L86 "Scaffold — Python workers (YAML planned)" — second copy of L66.
5. L90 "Harness internals; not runtime code" — genre label for the plugin directory.
6. L104 "Scaffold — Python workers (YAML planned)" — third copy.
7. L112 "`.opencode/instructions/live-verification.instructions.md` defines unit versus live tests and their reporting rules." — describes an instruction file instead of the rule.
8. L117 "`.opencode/instructions/serena-gateway.instructions.md` is a guard that only routes edits." — pure artifact-role meta.
9. L129 "Detailed development guidelines are codified in `.opencode/instructions/*.md` for strict compliance check by agents and contributors." — describes the doc system's genre.
10. L138 "10 distinct systems across harnesses, runtimes, and platform layers." — restates L47 count, adds no rule.
11. L144 "plugins + instructions; harness-native." — classifies parts of an artifact.
12. L151 "scaffold — Python workers (YAML planned); human-in-the-loop gates." — fourth copy.
13. L153 "TypeScript harness internals; quality-gate enforcers, loaders." — artifact-role inventory; overlaps L90.
14. L169 "owner: `harness-management`." — governance routing for a skill directory.
15. L177 "Reusable agent workflow — a harness-native orchestration pattern; always qualify which harness." — defines jargon instead of repo behaviour.
16. L182 "Modular capability in `.agents/skills/<name>/`; loaded via skill loader; not an agent." — artifact taxonomy and loading path.
17. L186 "Always qualify **RUG** — say `OpenCode RUG` vs `DSH RUG (Cordis)`; never bare "RUG"." — prose rule, not a repo rule.
18. L188 "Always qualify **Agent** — say ... never bare "agent" when ownership matters." — same prose rule.
19. L189 "This document shows only OpenCode and DSH loading skills - never claim skill support for GitHub Copilot, Conductor, or System A." — explicit self-reference; duplicates the L36-38 diagram.
20. L190 "'RUG' qualifies an orchestration pattern (OpenCode RUG, DSH RUG (Cordis)), not a harness. No composite or invented variants ..." — naming prose for writers.
21. L213 "Verify AGENTS.md topology stays in sync with the repo." — subject is this document; competes with the `just verify-agents` gate at L233.

## Overlap clusters (no authoritative copy)

- Conductor status: L66, L86, L104, L151 say "scaffold ... YAML planned"; L86 and L151 are near-identical.
- System count: L47 "10 distinct agent/workflow systems across 4 harness planes and 3 runtime planes" vs L138.
- Plugin SDK role: L90 "Harness internals; not runtime code" vs L153 "TypeScript harness internals; quality-gate enforcers, loaders".
- Serena direct-read ban: L58 "(gateway-mediated)", L167 "Never `read`/`ls` `.serena/memories/*` directly", L181 "access only via `serena` MCP gateway" — three statements, none marked authoritative.
- Verification routing: L213 grep sequence vs L233 `just verify-agents` vs L68/L115 "Pre-check Gate"; two verification procedures.
- System A/B definitions: L142/L143 (Taxonomy) duplicate L178/L179 (Terminology).

## Five worst

L117, L129, L182, L189, L213.

## Note

Prefix `reviews/` is not one of the nine registered typed scopes in .agents/skills/serena-memory/references/typing.md; the name was mandated by the requesting task, so `type: reviews` is recorded as given rather than forced into a false scope.
