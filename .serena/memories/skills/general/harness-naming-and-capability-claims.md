---
id: skills/general/harness-naming-and-capability-claims
L0: "Harness naming + capability claims — verify-or-generic-fallback; compatibility scoping."
hotness: 0.8
ttl: 180d
freshness: 2026-09-24
directory: skills/general
provenance: AGENTS.md; .opencode/instructions/shaping.instructions.md
---

# Harness Naming and Capability Claims

- Doctrine (canonical harness names, skill-loading bounds, verify-or-generic-fallback): `AGENTS.md` §Terminology and §AGENT & WORKFLOW TAXONOMY; `.opencode/instructions/shaping.instructions.md`.
- Lesson: every environment-capability claim in skill content must be verifiable in a repo file; otherwise state the outcome plus a generic fallback.
- Skill `compatibility` (`.opencode/instructions/shaping.instructions.md`): `Universal` only when NO file in the skill is harness-specific; otherwise name the scope (`Requires OpenCode`, `Requires DSH`, `Requires GitHub Copilot`, `Requires OpenCode + DSH`), and for toolchain-only constraints use `Requires Python 3.10+`. `Universal` is not mandated.
- Mistake pattern seen: synthesizing harness lists and per-harness mechanisms from indirect mentions; composite names such as Copilot Agents or DSH/Cordis RUG; claiming Conductor supports skills; asserting `Universal` for a skill that is harness-specific or toolchain-bound. Fix: verify or use generic fallbacks.

Source: AGENTS.md; .opencode/instructions/shaping.instructions.md.
