# Reference: Evaluation Design

When to load: when designing, reviewing, or extending a skill's `evals/evals.json` or its eval cases.

Vocabulary: scenario prompt — the task text given to the eval agent, naming a goal and a target but no steps; spectrum — the set of distinct situations a suite must cover; run-scoped namespace — subject names unique to one eval run.

## Scope

This guide covers skill evaluations: per-skill `evals/evals.json` cases run by `workflows/skill_eval_workflow.yaml` via `just skill-eval`. For edge-agent and model evaluations (`evals/runner.py`, datasets, baselines, provider switching), see `evals/AGENTS.md`.

Not for: datasets, provider benchmarks, baseline promotion.

## Principles

### Write scenario prompts, never how-to prompts

A prompt names the skill, the goal, and the target, and carries zero procedure: the eval measures whether the skill supplies the steps.

```text
Follow the guidance in serena-memory and collect the open questions from
this planning thread into memories.
```

A prompt that spells out "call write_memory after the nine checks" measures the prompt, not the skill.

### Cover a spectrum, not one happy path

Ship at least one case per dimension:

| Dimension | Case |
|---|---|
| Single fact | Find one stored fact and return it. |
| Batch structuring | Turn a long unstructured dump into structured memories. |
| Assembly | Build one report from three sources. |
| Maintenance | Update references and links when a fact changes. |
| Store conflict | Two writes disagree; resolve before the second lands. |
| Recall conflict | Two memories disagree, carry no cross-references, and were written on different dates: find both, judge trust, explain the choice, write cross-references. |
| Cleanup | Retire a stale memory: mark retired, never delete, leave an audit record. |
| Judgment | Ambiguous input or an untrusted source; ask or flag instead of guessing. |
| Lifecycle | Deterministic setup and teardown around the case. |
| Gateway/infra flake | A gateway call returns empty or errors: take the single sanctioned fallback once and complete the read; no retry loop. |
| Refuse bypass recipe | A request to work around a denied or gated action is denied, reported, and never stored as a memory. |

### Isolate every case's data

Each skill with evals ships `evals/setup.py`, `evals/teardown.py`, and `evals/fixtures.json`. Setup and teardown are deterministic scripts, never agentic: an agent that "cleans up" deletes the wrong subject.

```python
# evals/setup.py — ids come from fixtures.json, never from an agent's judgment
fixture = json.loads((HERE / "fixtures.json").read_text())["eval_3"]
write_subject(f"{fixture['namespace']}-{fixture['slug']}", fixture["body"])
```

Never touch production memory. A run that writes outside its test namespace is a hard failure, not a degraded pass.

### Keep subjects disjoint

Give each case its own subject, or prefix every subject with a run-scoped namespace.

```json
{"case": 3, "namespace": "eval-run-2026-10-25", "subjects": ["conflict-a", "conflict-b"]}
```

Two cases sharing one subject mutate each other, and the second result is noise.

### Assert outcomes you can observe

An assertion names the artifact, field, or transcript event that a grader can read.

```json
{"text": "Both conflicting memories are cited by id", "passed": true, "evidence": "recall returned mem:abc and mem:def"}
```

Do not assert internal call order, a trigger the harness cannot emit, or one narrow policy where the skill allows alternatives. Where the skill permits supersede or a symmetric dispute, accept either.

```json
{"text": "The second write is superseded or recorded as a dispute", "passed": true, "evidence": "grading.md: dispute note with both ids"}
```

### Grade from transcripts

Point the grader at the raw transcript files; never inline the whole transcript into the grading prompt. The transcript carries the tool calls and their outputs, which is the evidence each assertion cites.

### Assign roles

| Role | Agent |
|---|---|
| Scenario | `rug-swe` |
| Grader | `evaluation-grader` |
| Probe models | priority order: free, then paid, then local |

### Prove one case before scaling

Run one case end to end, then scale to the suite. Fix a breakage at the first layer that can hold the fix: command, then script, then eval.

### Keep the run cheap and repeatable

`workers=1`; no short timeouts; deterministic titles; token-conscious prompts and outputs.

## Success criteria

- Every assertion in every selected case passes with non-null evidence.
- Teardown removes every fixture; a leftover subject fails the run.
- `just ci-fast` exits 0.
- The suite has at least one case per spectrum dimension.

## Discoverability check

Ask a fresh subagent with no hints: "I want to add evaluations to <skill>. What should I consider, and what evaluation scenarios would you design?" A passing answer names the whole spectrum: single-fact, batch, assembly, maintenance, store conflict, recall conflict, cleanup, ambiguity/judgment, infra flake, bypass-recipe refusal, fixtures/setup/teardown, observable assertions, transcript grading. If the probe does not surface these, sharpen the skill description and routing, then probe again.

## Anti-patterns

- How-to prompts that encode the steps under measurement.
- Assertions that are impossible, unobservable, or narrower than the skill's allowed policy.
- Cases that write to production memory or share one subject.
- Fixtures named in assertions but absent from `fixtures.json`.
- Scaling to a full suite before one case passes end to end.
- Counting an ungraded case as failed instead of running the grader.
- Agentic setup or teardown.
- Asserting call traces instead of outcomes.
