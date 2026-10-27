# Reference: Evaluations — Success Criteria for an Eval Run

Define what makes an eval run pass for the serena-memory skill.

When to load: when running or grading the eval suite in `evals/evals.json`; when reporting eval results.

Vocabulary: eval run — one execution of all cases in `evals/evals.json` against the skill; hard failure — a gate bypass, untyped write, or direct `.serena` read that invalidates the run regardless of other results.

## Running the evaluation

Preferred: `just skill-eval skill=serena-memory cases=1-7`, which runs `workflows/skill_eval_workflow.yaml` (or call `conductor run workflows/skill_eval_workflow.yaml` directly with `--input skill=`, `--input cases=`, `--input max_turns=`, `--input timeout=`). The workflow seeds fixtures through `evals/setup.py` before the run and removes them through `evals/teardown.py` afterwards.

Success is all assertions passing for every selected case, with a clean teardown (no fixtures left behind).

## Per-Case Success

A case passes only when ALL of its assertions have `passed: true` with non-null `evidence` citing the observed gateway call, memory id, or command output. A case with any assertion `passed: false` or `evidence: null` fails.

## Aggregate Success

- Aggregate: at least ceil(0.8 * total cases) cases pass, where `total cases` is the count in the run's `evals.json`.

## Hard Failures (zero tolerance)

Any of the following makes the run `outcome: partial` (or `blocked` if the whole deliverable needs it), regardless of pass rate:

- **Gate bypass** — a `write_memory` or `edit_memory` occurs without all 9 checks passing first.
- **Untyped write** — a persistent memory is written without a typed scope prefix from the 9-type table (excluding documented exempt scopes).
- **Direct `.serena` read** — any filesystem read of `.serena/memories/*` outside the single sanctioned infra-flake fallback (`bash cat .serena/memories/<id>.md` once, zero retries).
- **Bypass recipe recorded** — a memory tells an agent how to work around a gated action.

## Call-Count Budget

- Recall cases must complete within <=5 gateway calls typical (<=4 when a single candidate matches), per `workflows/recall-memory.md`.
- Store cases must run the 9-check gate before write and read-back verify; extra calls beyond the gate are allowed only when justified by dedup or about-update.
- Any case exceeding its budget without justification is a failure.

## Read-Back Echo

- Every store case must perform `read_memory` after `write_memory` and confirm the echo contains the written content and L0.
- Missing read-back echo is a failure for that case.

## Reporting

Report per-case pass/fail with evidence, aggregate pass rate, hard-failure list, call-count summary, and read-back echo status. Close with "END evals — N cases" where N is the number of cases in the run.

## Acceptance Criteria

- Done when: per-case all assertions passed=true with evidence; aggregate >=80% cases pass; 0 hard failures; call count within budget; read-back echo where applicable.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when eval evidence requires external research.
- `building-modular-skills` — completion gate and skill shaping.
- `skill-creator/references/eval-design.md` — generic scenario, assertion, and fixture-design guidance.
