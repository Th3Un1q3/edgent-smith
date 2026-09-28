# evals.json and run_loop results.json

## evals.json

Defines the evals for a skill. Located at `evals/evals.json` within the skill directory.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "The output includes X",
        "The skill used script Y"
      ]
    }
  ]
}
```

**Fields:**
- `skill_name`: Name matching the skill's frontmatter
- `evals[].id`: Unique integer identifier
- `evals[].prompt`: The task to execute
- `evals[].expected_output`: Human-readable description of success
- `evals[].files`: Optional list of input file paths (relative to skill root)
- `evals[].expectations`: List of verifiable statements

---

## run_loop results.json

Output of `scripts/run_loop.py`, printed to stdout and written to the results directory. The `history` array is the iteration result schema: one entry per iteration, and each entry holds a `candidates` array with one record per divergent rewrite generated before the description was revised.

```json
{
  "exit_reason": "max_iterations (5)",
  "original_description": "the description the skill shipped with",
  "best_description": "the highest-scoring description found",
  "best_score": "8/10",
  "best_train_score": "27/30",
  "best_test_score": "8/10",
  "iterations_run": 3,
  "history": [
    {
      "iteration": 1,
      "description": "the description evaluated this iteration",
      "train_passed": 25,
      "train_total": 30,
      "test_passed": 7,
      "test_total": 10,
      "candidates": [
        {
          "hypothesis": "the description undersells editing an existing skill, so improve-this-skill queries do not trigger",
          "description": "first divergent rewrite",
          "train_passed": 26,
          "train_total": 30,
          "train_results": [
            {
              "query": "improve this skill",
              "should_trigger": true,
              "pass": true,
              "triggers": 3,
              "runs": 3
            }
          ]
        },
        {
          "hypothesis": "the description lists too many synonyms, so adjacent non-skill tasks false-trigger",
          "description": "second divergent rewrite",
          "train_passed": 24,
          "train_total": 30,
          "train_results": []
        }
      ]
    }
  ]
}
```

**Fields:**
- `history[].candidates[]`: One record per divergent rewrite. `hypothesis` states which query fails and why the rewrite fixes it; `description` is the rewrite; `train_passed`, `train_total`, and `train_results` are its train-only scores. `run_loop.py` writes at least two records per iteration and carries the train-best candidate into the next iteration, where the held-out test set scores it.
- `best_description` / `best_score`: Final selection across iterations by test score (or train score when no test split is configured).

---
