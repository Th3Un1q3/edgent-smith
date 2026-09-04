---
name: nonviolent-communication
description: >
  Fix violent (Jackal/power-over) messages that smuggle evaluation, faux-feeling, or demand — turn any message into Giraffe (power-with) via Rosenberg's 4-component rewrite. Trigger on "make this nonviolent", "rewrite with NVC", "nonviolent communication", "turn any message to a non violent one".
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: "1.0.0 — initial from l7TONauJGfc (Rosenberg SF Workshop 2015, 49k transcript) — 4 components grounded in video examples"
  author: Th3Un1qu3
---

# Nonviolent Communication

Turn any Jackal (power-over, evaluative) message into Giraffe (power-with, big-hearted) using Rosenberg's 4 components — grounded in l7TONauJGfc (2015 SF Workshop, 49k chars, `cache/youtube-videos/nvc/l7TONauJGfc.txt`).

## When to Use This Skill

Invoke this skill when:
- User asks to make a message nonviolent, rewrite with NVC, or turn Jackal into Giraffe.
- User wants to diagnose violence in a message, separate observation from evaluation, or craft a Giraffe request.
- User asks to practice NVC dialogue, self-empathy, or empathy guessing.

## When Not to Use This Skill

Do not use this skill for:
- Verbatim transcript summary with no rewrite.
- Non-message tasks (research, coding, pure Q&A about the video).
- Requests that explicitly reject NVC framing and want evaluative language preserved.

## Principles

- **Observe without evaluating:** quote exact words or camera-test facts — see [references/nvc-framework.md](./references/nvc-framework.md).
- **Feel without faux-feeling:** name body-based feelings, not judgments disguised as feelings — see [references/violent-patterns.md](./references/violent-patterns.md).
- **Need universally:** root requests in universal needs with no "you" — see [references/nvc-framework.md](./references/nvc-framework.md).
- **Request positively:** state concrete, present, doable, choice-honoring actions — see [references/rewrite-rubric.md](./references/rewrite-rubric.md).

## Workflow Skeleton

Detect Jackal → Observation → Feeling → Need → Request → Verify (rubric ≥10/12, no zero) → Deliver. Detail: [workflows/transform-message.md](./workflows/transform-message.md).

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Turn any message into NVC 4-component Giraffe | [workflows/transform-message.md](./workflows/transform-message.md) |
| Diagnose Jackal patterns and score 0–3 per component | [workflows/analyze-violence.md](./workflows/analyze-violence.md) |
| Practice Giraffe via self-empathy and role-play | [workflows/practice-dialogue.md](./workflows/practice-dialogue.md) |
| Learn the 4 components and Giraffe vs Jackal philosophy | [references/nvc-framework.md](./references/nvc-framework.md) |
| Identify 4 violence traps: evaluation, faux-feeling, need-as-strategy, demand | [references/violent-patterns.md](./references/violent-patterns.md) |
| Score rewrites with the 0–3 rubric and video examples | [references/rewrite-rubric.md](./references/rewrite-rubric.md) |
| Do a 60-second 4-sentence quick rewrite | [recipes/quick-rewrite.md](./recipes/quick-rewrite.md) |

Shared audit tooling lives in `agent_utils/scripts/` — `audit_fences.py` and `validate_md_links.py` — as single source per Rule 24. Do not copy into per-skill `scripts/` (Rule 8 exception).

## Related Skills

- `youtube-to-skill` — cache-first transcript fetch (`cache/youtube-videos/nvc/l7TONauJGfc.txt`) that grounds this skill.
- `building-modular-skills` — lean router and shaping rules this skill follows.
- `context-gathering` — transient cache for external video research.

## Vocabulary

Load-bearing terms defined in [references/nvc-framework.md](./references/nvc-framework.md): Jackal, Giraffe, observation, feeling, faux-feeling, need, strategy, request, demand.
