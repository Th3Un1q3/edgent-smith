# EVALS KNOWLEDGE BASE (Evaluation Infrastructure)

**OVERVIEW**: The testing and benchmarking framework used for running automated model evaluations against baseline scores to detect regressions in agentic performance.

## Two evaluation families

Two evaluation families share this directory name; they answer different questions and must not be mixed.

| Question | Family | Artifacts | Run with |
|---|---|---|---|
| Does a skill's guidance change agent behaviour? | Skill evals | `.agents/skills/<skill>/evals/evals.json` cases, `workflows/skill_eval_workflow.yaml` | `just skill-eval` |
| How does the edge agent or a candidate model score on a dataset? | Edge-agent evals | `evals/runner.py`, datasets (`smoke.py`, `extended.py`, `long_inputs.py`), baselines | `just evals::*` |

Skill-eval design guide: `.agents/skills/skill-creator/references/eval-design.md`.

**Skill evals** measure whether a skill's guidance produces the intended behaviour. Cases use scenario prompts that state a goal and target without procedure, the suite covers a spectrum of situations, fixtures isolate each case, and setup/teardown are deterministic scripts rather than agent calls. `rug-swe` runs scenarios; `evaluation-grader` grades from transcripts. Skill evals are not for model or provider benchmarking.

**Edge-agent evals** measure the edge agent and candidate models on datasets. They switch providers (Ollama vs Copilot), score each dataset case, and compare the result against baseline files. Edge-agent evals are not for per-skill behaviour.

## STRUCTURE
```text
evals/
├── runner.py        # Unified evaluation execution engine (providers, datasets, baselines)
├── smoke.py         # Lightweight dataset for fast regression feedback
├── extended.py      # Wider-coverage dataset for full benchmark runs
├── long_inputs.py   # Long-context dataset
├── config.toml      # Models, datasets, and runner settings
├── justfile         # `just evals::*` recipes
├── AGENTS.md        # This knowledge base
└── assets/          # Fixture documents used by dataset cases
```

## WHERE TO LOOK
- **Runner Core**: `evals/runner.py` handles model selection, provider switching (Ollama vs Copilot), and the primary orchestration loop.
- **Baseline Management**: Look for files like `*.baseline.json` in the project root or subdirs to see historical score thresholds.
- **Skill-eval design**: `.agents/skills/skill-creator/references/eval-design.md` covers scenario prompts, spectrum coverage, assertions, fixtures, and grading roles for skill evals.

## CONVENTIONS
- **Runner Orchestration**: The runner supports both local development (using Ollama/Local LLMs) and remote execution via GitHub Copilot API.
- **Baseline Comparison**: Candidates are compared against established baseline files; successful improvements must be formally promoted through the workflow or CLI command to become the new standard.
- **Dataset Modularity**: Datasets like `smoke` provide a consistent, lightweight set of tasks for fast feedback during CI and local testing.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not hardcode model names within evaluation logic; use the configuration/environment provider settings in `runner.py`.
- Avoid modifying baseline files directly by hand; always go through a formal promotion workflow to ensure score consistency.
