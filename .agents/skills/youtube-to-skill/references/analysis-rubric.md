# Reference: Analysis Rubric — 5-Dimension Skillability Score

When to load: when you score a transcript for skill potential; after fetching transcript, before drafting skill proposals.

Vocabulary: **dimension** — one scored axis 0-2; **evidence** — verbatim quote ≤30 words with timestamp; **direct skill** — automates replayable steps; **meta skill** — applies a mental model to critique work; **aspect** — user-supplied focus that re-weights scoring; **failure mode** — named way a run fails without the skill.

## Evidence Rules

Quote verbatim; cap each quote at 30 words; add timestamp `[MM:SS]` or speaker tag; cite transcript line.

- Quote exactly as spoken; omit filler only with `[...]`.
- One quote per dimension; 10-30 words preferred; fewer than 10 words lacks context.
- If no quote supports the score, score 0 and state `no evidence`.

## Dimensions — Score 0-2 Each

Score each dimension 0, 1, or 2. Attach one evidence quote and one sentence explaining why.

### 1. Teachability — can the transcript become steps?

- **0** — no sequence; abstract discussion only.
- **1** — partial sequence; steps implied but unordered or incomplete.
- **2** — clear sequence; ordered steps a viewer can replay.

> Example (2): "first create a conftest.py, then define a scoped fixture, then inject it into tests" [08:21] — ordered, replayable.

### 2. Toolability — do MCP/tools enable automation?

- **0** — no tool maps; manual judgment only.
- **1** — one tool maps; partial automation, human completes rest.
- **2** — two or more tools map; largely automatable.

> Example (2): "run ruff check --fix and then apply the codemod to every file" [12:04] — maps to filesystem + exec tools.

### 3. Generality — does the lesson transfer beyond this video?

- **0** — single-repo anecdote; tied to one codebase.
- **1** — transfers within one domain (e.g., Python tests).
- **2** — transfers across domains or stacks.

> Example (1): "this fixture pattern works for any pytest suite, not just this repo" [15:33] — domain transfer, not cross-stack.

### 4. Failure-Mode Clarity — can you name the pain the skill fixes?

- **0** — no failure named; vague benefit.
- **1** — failure named but generic ("slow tests").
- **2** — specific, observable failure ("copy-pasted setup drifts, fixtures break on rename").

> Example (2): "every new test copies setup and breaks when you rename a field" [03:11] — specific, observable.

### 5. Evals-ability — can you verify the skill worked?

- **0** — no verifiable output; subjective only.
- **1** — output visible but lacks pass/fail signal.
- **2** — output has binary or scored check (file exists, test passes, rubric score).

> Example (2): "after running, pytest passes and conftest contains three scoped fixtures" [22:47] — binary checks.

## Scoring and Synthesis — Sum 0-10

Sum five dimensions. Use the total to pick the kind.

| Total | Verdict | Action |
|---|---|---|
| 7-10 | Strong Direct | Draft direct skill primary; add meta as secondary |
| 5-6 | Meta stronger | Draft meta skill primary; direct only if Teachability = 2 |
| 0-4 | Not skillable | Do not draft skill; propose a recipe or checklist instead |

> Example synthesis: Teachability 2 + Toolability 2 + Generality 1 + Failure 2 + Evals 2 = 9 → Strong Direct.

## Aspect Weighting

When the user supplies an aspect, double-weight its matching dimension per `workflows/analyze-aspect.md`.

- Map aspect to one dimension (e.g., aspect "automation" → Toolability; "testing strategy" → Generality).
- Multiply that dimension by 2; sum becomes 0-12; divide by 1.2 to renormalize to 0-10, or report raw 0-12 with note.
- Cite the mapping: `Aspect "X" → Dimension Y (2x per workflows/analyze-aspect.md)`.

> Example: aspect "tooling" → Toolability 2 becomes 4; raw total 9 → weighted 11/12 → renormalized 9.2 → still Strong Direct.

## Copy-Pasteable Scoring Template

```markdown
| Dimension | Score 0-2 | Evidence (≤30w, verbatim + [MM:SS]) | Why |
|---|---|---|---|
| Teachability |  | "quote" [MM:SS] |  |
| Toolability |  | "quote" [MM:SS] |  |
| Generality |  | "quote" [MM:SS] |  |
| Failure-mode |  | "quote" [MM:SS] |  |
| Evals-ability |  | "quote" [MM:SS] |  |
| **Total** | **/10** | Verdict: Direct / Meta / Not skillable |  |
```

## Worked Example — Full Block Adjacent to Rules

Scores "Pytest Fixtures Deep Dive" — aspect none.

| Dimension | Score | Evidence | Why |
|---|---|---|---|
| Teachability | 2 | "create conftest, define scoped fixture, inject into tests" [08:21] | Ordered replayable steps |
| Toolability | 1 | "run the codemod to scaffold fixtures" [12:04] | One tool maps, review stays manual |
| Generality | 1 | "works for any pytest suite" [15:33] | Within Python tests only |
| Failure-mode | 2 | "copies setup and breaks on rename" [03:11] | Specific drift failure |
| Evals-ability | 2 | "pytest passes, conftest has three fixtures" [22:47] | Binary check |
| **Total** | **8** | **Strong Direct** | Draft direct primary, meta secondary |
