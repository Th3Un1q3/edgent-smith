# Promotion PR

Use this prompt when Copilot should prepare a promotion PR for an accepted experiment.

---

## Prompt

Experiment `<EXPERIMENT_NAME>` has passed all three eval stages (smoke, benchmark, holdout).

Your task is to prepare a promotion pull request.

Steps:
1. Run `python experiments/scripts/promote.py --name <EXPERIMENT_NAME> --dry-run` to generate the PR description
2. Confirm the manifest shows `decision: accept` for all three suites
3. Run `python experiments/scripts/promote.py --name <EXPERIMENT_NAME>` to update the baseline
4. Create a pull request from `experiment/<EXPERIMENT_NAME>` into `main`

The PR title should be:
```
experiment: promote <EXPERIMENT_NAME>
```

The PR description should include (use the output of `promote.py`):
- The hypothesis
- The mutation surface (files changed)
- Eval result table (smoke / benchmark / holdout)
- The decision rationale
- A link to the experiment manifest

After creating the PR:
- Confirm CI passes (lint, type-check, tests, eval smoke)
- Do not merge until CI is green
