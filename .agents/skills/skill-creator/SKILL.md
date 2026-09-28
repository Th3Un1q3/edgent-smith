---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
license: MIT
compatibility: Universal
metadata:
  version: "2.1.0"
  delta: |
    2.1.0 — added a scope/boundary line: structure and shaping rules live in `building-modular-skills`, placement in `harness-management`; this skill owns the create → evaluate → iterate → benchmark lifecycle and description/trigger optimization.
    2.0.1 — field definition realigned in workflows/create-skill.md (no label change).
    2.0.0 (harness-portability pass): divergent candidate generation behind a provider seam, a portable completion gate with documented fallbacks, iteration records as JSON primary with Serena optional, the schema reference split into per-topic files, and content routing driven by the reference index.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

Scope: structure and shaping rules live in `building-modular-skills`; where a harness change belongs lives in `harness-management`. This skill owns the create → evaluate → iterate → benchmark lifecycle and description/trigger optimization.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run the skill using the target harness with access to the skill content on them
- Help the user evaluate the results both qualitatively and quantitatively
  - While the runs happen in the background, draft some quantitative evals if there aren't any (if there are some, you can either use as is or modify if you feel something needs to change about them). Then explain them to the user (or if they already existed, explain the ones that already exist)
  - Use the `eval-viewer/generate_review.py` script to show the user the results for them to look at, and also let them look at the quantitative metrics
- Rewrite the skill based on feedback from the user's evaluation of the results (and also if there are any glaring flaws that become apparent from the quantitative benchmarks)
- Repeat until you're satisfied
- Expand the test set and try again at larger scale

Your job when using this skill is to figure out where the user is in this process and then jump in and help them progress through these stages. So for instance, maybe they're like "I want to make a skill for X". You can help narrow down what they mean, write a draft, write the test cases, figure out how they want to evaluate, run all the prompts, and repeat.

On the other hand, maybe they already have a draft of the skill. In this case you can go straight to the eval/iterate part of the loop.

Of course, you should always be flexible. If the user says "I don't need to run a bunch of evaluations, just vibe with me", take that as a waiver, not a silent skip: write `<skill-name>-workspace/waiver.md` with the user's reason and which stages you skipped, then continue. A waiver nobody wrote down is indistinguishable from a gate the run dodged.

Then after the skill is done (but again, the order is flexible), you can also run the skill description improver, which we have a whole separate script for, to optimize the triggering of the skill.

Cool? Cool.

## Task routing

Load a file only when its row matches the task.

| I want to... | File |
|---|---|
| Capture intent, draft the skill, design test cases | [workflows/create-skill.md](workflows/create-skill.md) |
| Run and evaluate test cases | [workflows/run-evals.md](workflows/run-evals.md) |
| Improve from feedback and iterate | [workflows/improve-skill.md](workflows/improve-skill.md) |
| Optimize the description for triggering | [workflows/optimize-description.md](workflows/optimize-description.md) |
| Adapt when reviewers, a browser, or packaging are unavailable | [references/capability-fallbacks.md](references/capability-fallbacks.md) |
| Look up JSON schemas (index) | [references/schemas.md](references/schemas.md) |
| Read the evals and run_loop results schema | [references/schemas-evals.md](references/schemas-evals.md) |
| Read the iteration history schema | [references/schemas-history.md](references/schemas-history.md) |
| Read the grading and metrics schema | [references/schemas-grading.md](references/schemas-grading.md) |
| Read the benchmark and timing schema | [references/schemas-benchmark.md](references/schemas-benchmark.md) |
| Read the comparison schema | [references/schemas-comparison.md](references/schemas-comparison.md) |
| Read the analysis schema | [references/schemas-analysis.md](references/schemas-analysis.md) |
| Grade assertions against outputs | [agents/grader.md](agents/grader.md) |
| Blind A/B compare two outputs | [agents/comparator.md](agents/comparator.md) |
| Analyze why one version beat another | [agents/analyzer.md](agents/analyzer.md) |
| Review the eval set in a browser | [assets/eval_review.html](assets/eval_review.html) |
| Generate the human review viewer | [eval-viewer/generate_review.py](eval-viewer/generate_review.py) |
| Render the viewer UI | [eval-viewer/viewer.html](eval-viewer/viewer.html) |
| Aggregate runs into a benchmark | [scripts/aggregate_benchmark.py](scripts/aggregate_benchmark.py) |
| Build the HTML report | [scripts/generate_report.py](scripts/generate_report.py) |
| Propose an improved description | [scripts/improve_description.py](scripts/improve_description.py) |
| Package the skill as `.skill` | [scripts/package_skill.py](scripts/package_skill.py) |
| Validate frontmatter and name | [scripts/quick_validate.py](scripts/quick_validate.py) |
| Measure trigger rates | [scripts/run_eval.py](scripts/run_eval.py) |
| Run the divergence + eval + improve loop | [scripts/run_loop.py](scripts/run_loop.py) |
| Parse SKILL.md frontmatter | [scripts/utils.py](scripts/utils.py) |
| Initialize the scripts package | [scripts/__init__.py](scripts/__init__.py) |
| Read the license | [LICENSE.txt](LICENSE.txt) |

## Completion gate

A gate counts only if the weakest model tier the harness offers, with access to the skill, can run it end to end without a human. Where no weakest-tier selection is available, use the lowest-cost model that can process the skill content (typically the default/cheapest tier). Where skills cannot load at all, use manual review of deterministic check outputs as the primary gate. A step that needs a careful human to judge "looks fine" is self-attestation, and a weak model talks past it. Run the deterministic checks from the repo root with `uv run` and treat a nonzero exit as blocked:

```bash
just agent_utils::validate-skill <skill-name>   # budgets + markdown links + fences
uv run python .agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/<skill-name>
```

The first command runs `validate_md_links.py` and `audit_fences.py`; the second checks frontmatter, name, and description limits. A harness with a shell but no `just` runs `quick_validate.py` directly. Where no shell exists, a human or CI runs them and the run records that verifier. Do not override a failure with prose. Checks that genuinely need human judgment (writing style, taste) stay advisory and say so.

---

Repeating one more time the core loop here for emphasis:

- Figure out what the skill is about
- Draft or edit the skill
- Run the harness with access to the skill on test prompts
- With the user, evaluate the outputs:
  - Create benchmark.json and run `eval-viewer/generate_review.py` to help the user review them
  - Run quantitative evals
- Repeat until you and the user are satisfied
- Package the final skill and return it to the user.

Please add steps to your TodoList, if you have such a thing, to make sure you don't forget. Specifically put "Create evals JSON and run `eval-viewer/generate_review.py` so human can review test cases" in your TodoList to make sure it happens.

Good luck!
