---
description: "Create and submit one experiment from docs/ideas.md"
agent: "edge-architect"
---

# Create One Experiment From Ideas

Task:

1. Read `docs/ideas.md` first.
2. Inspect only the nearby agent and eval surfaces needed to ground the choice.
3. Choose exactly one high-impact, low-cost experiment.
4. Return one Markdown experiment spec with these headings: `Hypothesis`, `Motivation`, `Type`, `Mutation surface`, `Implementation Instructions`, `Validation(code, prompts, tasks)`, `Anticipated missteps and fallbacks`, `Sources`, and `Notes`.
5. Submit it exactly once with `just autoresearch experiment create`.

Do not brainstorm multiple options. Do not use queue-replenishment YAML unless the caller explicitly asks for that mode.