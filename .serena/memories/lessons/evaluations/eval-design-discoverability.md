---
id: lessons/evaluations/eval-design-discoverability
type: experiences
L0: "Eval-design discoverability: generic guidance lives in skill-creator/references/eval-design.md; blind-probe a fresh subagent with no hints and iterate routing until it names the spectrum."
---

- Guidance lives in `.agents/skills/skill-creator/references/eval-design.md`: principles, the spectrum table, fixtures, assertions, grading roles, and success criteria.
- Spectrum (one case minimum per dimension): single fact, batch structuring, assembly, maintenance, store conflict, recall conflict, cleanup, judgment, lifecycle, gateway/infra flake, refuse bypass recipe.
- Gateway/infra flake: an empty or errored return takes the single sanctioned fallback once and completes the read; no retry loop, and the case asserts the fallback ran.
- Refuse bypass recipe: a request to work around a denied or gated action is denied, the denial is recorded, and no bypass how-to is stored in memory or guidance.
- Blind-probe method: ask a fresh subagent with no hints "I want to add evaluations to <skill>. What should you consider and what scenarios would you design?".
- Success is the probe naming these dimensions unprompted.
- When the probe is blind, improve the routing and descriptions that lead to the reference, then retry with another fresh subagent.
