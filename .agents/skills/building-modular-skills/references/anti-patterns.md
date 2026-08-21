# Reference: Anti-patterns to Avoid

The nine failure patterns this skill guards against, each with the positive practice that replaces it. These patterns come from analyzing the most-adopted public skill libraries; a skill that exhibits one fails its users. The rules in [guidance.md](./guidance.md) prevent them; run the [Shaping Checklist](../workflows/shaping-checklist.md) to verify a skill carries none.

**When to load:** when you review a skill for failure patterns; when a review flags a pattern below; when you want the failure-mode map behind Rules 17-24.

## Anti-pattern map

| Anti-pattern | Positive practice | Preventing rule |
|---|---|---|
| Vague generic advice | Executable, gated instructions | Rule 20 |
| Walls of text | Progressive disclosure + budgets | Rules 1, 19 |
| Theoretical framework-dumping | Operational vocabulary only | Rule 17 |
| Over-engineering | Mandate nothing structural | Rule 17 |
| Negation-only steering | Prompt the positive | Rule 21 |
| Process takeover | Discipline, not monopoly | Rule 17 |
| Inventing or faking knowledge | Verify against trusted sources | Rule 23 |
| Human doing the agent's job | Facts are the agent's job | Rule 23 |
| Duplication | Single source of truth, reference by path | Rule 24 |

## 1. Vague generic advice

What it is: unenforceable filler ("be professional", "use good judgement") that tells the model nothing to do.

Fix: make every instruction executable or gated — a step states its action, its "Done when:" signal, and its hard gate (Rule 20).

## 2. Walls of text

What it is: long always-loaded documents that bury the actionable step.

Fix: disclose progressively — keep always-loaded content minimal; push detail to files loaded on match. Sprawl is the failure mode (Rules 1, 19).

## 3. Theoretical framework-dumping

What it is: pedagogy, bios, book lists, and framework lectures that teach theory instead of the task.

Fix: use operational vocabulary only — framework terms appear as instructions the model can run. A "Rejected framings" section that names what the skill deliberately does not cover is fine (Rule 17).

## 4. Over-engineering

What it is: structure mandated before a failure proves it necessary — AI, checkpoints, schedules, adapters nobody uses.

Fix: mandate nothing structural. A workflow needs no AI, no checkpoint, and no schedule unless the failure mode shows it does. One adapter means a hypothetical seam; two adapters means a real one (Rule 17).

## 5. Negation-only steering

What it is: steering by prohibition — "do not X" — which drags the forbidden behaviour into context and makes it more available.

Fix: prompt the positive. Every negative directive carries a positive reframe beside it: "Never trust parametric memory" becomes "Verify every fact against a trusted source". Prune no-op instructions the model obeys by default (Rule 21).

## 6. Process takeover

What it is: an all-in-one framework that replaces the user's process instead of encoding discipline inside it.

Fix: encode workflow discipline without taking over the whole process; the user keeps control (Rule 17).

## 7. Inventing behavior or faking knowledge

What it is: examples, flags, or behaviors that do not exist, or facts taken from parametric memory without verification.

Fix: never invent new behaviour — resolve, never `--abort`. Verify every example and fact against a trusted source: docs, repo files, this skill's own references. Never trust parametric knowledge for facts a skill depends on (Rule 23).

## 8. Making the human do the agent's job

What it is: steps that ask the user for facts the agent can look up itself.

Fix: finding facts is the agent's job, never the user's. Do not ask the user for anything you could look up yourself (Rule 23).

## 9. Duplication / multiple sources of truth

What it is: the same content restated in two files; the copies drift and readers cannot tell which is canonical.

Fix: keep one source of truth. Do not duplicate content captured in other artifacts — reference it by path or URL instead (Rule 24).
