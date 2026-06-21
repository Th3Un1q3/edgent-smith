# EVALS KNOWLEDGE BASE (Evaluation Infrastructure)

**OVERVIEW**: The testing and benchmarking framework used for running automated model evaluations against baseline scores to detect regressions in agentic performance.

## STRUCTURE
```text
evals/
├── runner.py             # Unified evaluation execution engine (orchestrates providers & datasets)
└── smoke.py              # Standard "smoke" dataset for rapid regression detection
```

## WHERE TO LOOK
- **Runner Core**: `evals/runner.py` handles model selection, provider switching (Ollama vs Copilot), and the primary orchestration loop.
- **Baseline Management**: Look for files like `*.baseline.json` in the project root or subdirs to see historical score thresholds.

## CONVENTIONS
- **Runner Orchestration**: The runner supports both local development (using Ollama/Local LLMs) and remote execution via GitHub Copilot API.
- **Baseline Comparison**: Candidates are compared against established baseline files; successful improvements must be formally promoted through the workflow or CLI command to become the new standard.
- **Dataset Modularity**: Datasets like `smoke` provide a consistent, lightweight set of tasks for fast feedback during CI and local testing.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not hardcode model names within evaluation logic; use the configuration/environment provider settings in `runner.py`.
- Avoid modifying baseline files directly by hand; always go through a formal promotion workflow to ensure score consistency.