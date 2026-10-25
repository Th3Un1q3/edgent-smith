# Run Evals Protocol

## Preferred: conductor workflow

Run `workflows/skill_eval_workflow.yaml` through `just skill-eval skill=<name> cases=<range>` (or `conductor run workflows/skill_eval_workflow.yaml --input skill=... --input cases=...`). Stages: `probe_models` (first model answering a probe, free → paid → local), `setup` (deterministic fixtures), `validate_evals` (schema + case resolution), `run_cases` (per-case scenario and grader), `scorecard` (aggregate), `cleanup` (teardown).

The direct runner below is the manual fallback.

Use `scripts/run_skill_evals.py` to evaluate a skill with OpenCode CLI.

## Steps

1. Resolve skill directory and eval set (`evals/evals.json`).
2. Build case prompts from SKILL.md plus each case prompt.
3. Run cases in parallel with the configured worker count.
4. Grade assertions when `--grade auto`.
5. Write results JSON and print the summary table.

## Conventions

- Progress goes to stderr; summary table to stdout.
- Missing opencode or timeouts are recorded per case, not fatal.
- Use `--dry-run` to inspect prompts without running.
- Use `--write-back` only to persist grading into evals.json.
