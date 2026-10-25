---
name: run-skill-evals
description: "Run skill evals via OpenCode CLI"
agent: build
---

# Run Skill Evals

## Orchestrated run (recommended)

```bash
just skill-eval skill=serena-memory cases=1-7
```

Equivalent, without `just`:

```bash
conductor run workflows/skill_eval_workflow.yaml \
  --input skill=serena-memory --input cases=1-7 \
  --input max_turns=4 --input timeout=600
```

Stages: `probe_models` picks the first model answering a probe (free, then paid, then local); `setup` seeds the deterministic fixtures; `validate_evals` validates the eval schema and resolves the case ids; `run_cases` runs each case's scenario and grader; `scorecard` aggregates per-case results into `scorecard.json`; `cleanup` tears the fixtures down.

## Manual run (direct script)

Run the minimal skill eval runner.

## Usage

```bash
python3 scripts/run_skill_evals.py --skill <name-or-path> [options]
```

## Options

- `--skill` skill name or path (required)
- `--eval-set` eval file (default `evals/evals.json`)
- `--cases` range like `1-5,7` or `all` (default `all`)
- `--workers` parallel workers (default 4)
- `--timeout` per-case timeout seconds (default 120)
- `--model` optional model override
- `--grade {auto,none}` (default auto)
- `--dry-run` print prompts and exit
- `--output` results path (default `evals/results/<skill>-<timestamp>.json`)
- `--opencode-bin` opencode binary (default `opencode`)
- `--write-back` update evals.json assertions with grading

## Notes

Progress is printed to stderr; summary table to stdout. Missing opencode or timeouts are recorded per case.
