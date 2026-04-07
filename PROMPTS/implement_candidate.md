# Implement Candidate

Use this prompt when Copilot should implement an experiment that has already been initialized.

---

## Prompt

You are implementing experiment `<EXPERIMENT_NAME>` in the edgent-smith repository.

The experiment manifest is at: `experiments/manifests/<EXPERIMENT_NAME>.json`

Before making any changes:
1. Read `EXPERIMENT_RULES.md` to confirm mutation boundaries
2. Read the manifest to understand the hypothesis and listed mutation surfaces
3. Read the current content of the files you will change

Then make the minimum change necessary to test the hypothesis. Rules:
- Only modify files listed under `mutation_surface` in the manifest
- Do not modify the eval harness, tests, or infrastructure
- Keep the change small and reversible
- Prefer cleaner/simpler code over more complex code

After making the change:
1. Run `python -m pytest tests/ -q` to confirm tests still pass
2. Run `python -m ruff check src/ tests/` to confirm no lint errors
3. Run `python experiments/scripts/run_candidate.py --name <EXPERIMENT_NAME> --suite smoke`
4. Run `python experiments/scripts/compare.py --name <EXPERIMENT_NAME> --suite smoke`

Report what you changed and the smoke eval result.
