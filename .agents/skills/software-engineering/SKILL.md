---
name: software-engineering
description: >
  Software method for a worker that edits code, tests, configs, or behaviour:
  test-first discipline, packaging a change into verifiable units, language
  standards, acceptance criteria, proof of done, gap policy, and anti-patterns.
  Load when the deliverable is a feature, bug fix, refactor, test, dependency,
  migration, build or CI config. Not for research reports, prose, or skill
  authoring: those load general-delivery.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: >
    1.0.0 — extracted the software method from the rug-swe.md agent definition when that agent became a general worker and
    generalized the prompt: test-first rules the harness does not own, per-file
    work packaging, technical standards, acceptance and proof-of-done criteria,
    gap policy and anti-patterns. TDD cycle, case design and language tooling
    deferred by name to the skills that own them.
  author: edgent-smith team
---

# Software Engineering

This pack supplies method only. The resident core owns the task contract, the call budget, phases and the report; do not restate them.

Load when the deliverable changes software: a feature, a bug fix, a refactor, a test, a dependency, a migration, a build or CI config. Research, prose, and skill authoring load `general-delivery`.

## Dependencies

Load these instead of restating them; this pack adds only what they do not carry.

| Situation | Load | Boundary |
|---|---|---|
| Writing or changing a test; RED → GREEN → REFACTOR | `test-driven-development` | Owns the cycle, the iron law, and the watched-failure rule. |
| Choosing cases, structuring a suite, mocks, flaky tests | `test-design` | Owns case selection and suite conventions. |
| Python tests and fixtures | `python-testing-patterns` | Language mechanics only. |
| TypeScript or JavaScript tests | `vitest` | Language mechanics only. |
| Refactor with no behaviour change | `refactor`, `refactoring-patterns` | Own the transformations. |
| Multi-file refactor before editing | `refactor-plan` | Owns sequencing and confirmation. |
| Click CLI, pydantic-ai agent, Bun build or test | `click-cli`, `building-pydantic-ai-agents`, `bun` | Framework mechanics. |
| New dependency or tool install | `software-installation` | Owns install guards and pins. |
| Container, compose, devcontainer change | `docker-patterns`, `devcontainers-best-practices` | Own container mechanics. |

## Route by task archetype

Load the skills a matching row names before the first edit; each owns mechanics this pack does not repeat.

| Archetype | Trigger phrases | Load |
|---|---|---|
| Write unit or integration tests | "write tests", "add tests", "test this module", "TDD" | `python-testing-patterns`, `test-design`, `test-driven-development` |
| Refactor or reduce complexity | "refactor", "clean up", "reduce complexity", "extract method", "code smell" | `refactor`, `refactoring-patterns`, `refactor-method-complexity-reduce`, `refactor-plan` |
| Build, test, or run JS/TS with Bun | "run with bun", "bun test", "bun build", "bun install" | `Bun` |
| Write or test Click CLI commands | "add CLI command", "click command", "click option" | `click-cli-skill` |
| Build pydantic-ai agents | "build agent", "pydantic-ai", "agent with tools", "structured output agent" | `building-pydantic-ai-agents` |
| Run or debug conductor workflows | "run workflow", "conductor workflow", "orchestrate agents" | `conductor` |
| Research or gather context | "research", "find docs", "look up", "investigate", "context gathering" | `context-gathering` |
| Explore, inventory, or catalog a directory | "explore directory", "inventory files", "catalog", "read all files", "list and summarize", "systematically read", "bulk explore" | `context-gathering` |
| Configure dev containers | "devcontainer", "dev container", "docker dev", "codespaces" | `devcontainers-best-practices` |
| Configure the Docker MCP Gateway | "mcp gateway", "docker mcp", "mcp server config" | `docker-mcp-gateway` |
| Docker patterns or compose | "docker compose", "dockerfile", "multi-container", "docker networking" | `docker-patterns` |
| Edge architect workflows | "edge architect", "huggingface papers", "edge agent eval" | `edge-architect-workflows`, `hf-cli-papers` |
| Find or install skills | "find skill", "is there a skill", "install skill" | `find-skills` |
| GitHub Copilot infrastructure | "copilot customization", "copilot instructions", "copilot agents" | `github-copilot-infrastructure` |
| HF papers research | "huggingface papers", "hf papers", "latest ML papers" | `hf-cli-papers` |
| Minimal or lazy implementation | "ponytail", "lazy", "simplest", "yagni", "minimal", "do less" | `ponytail` |
| Build Copilot prompts | "copilot prompt", "prompt template", "prompt builder" | `prompt-builder` |
| Pydantic Evals workflows | "pydantic evals", "evaluation suite", "offline eval", "online eval" | `pydantic-evaluations` |
| Create or improve skills | "create skill", "improve skill", "skill eval", "skill performance" | `skill-creator` |
| Delegate to subagents | "delegate", "subagent", "break down task", "orchestrate" | `task-delegation` |
| Agent utilities or notifications | "agent notify", "agent utils", "send notification" | `agent-utils` |
| Build modular Copilot skills | "modular skill", "skill structure", "skill workflow", "skill reference" | `building-modular-skills` |
| Session analysis | "session insights", "analyze session", "session json" | `session-insights` |
| Vitest testing | "vitest", "vite test", "vitest config" | `vitest` |

When no row matches, load `general-delivery` and check whether the task belongs in this pack at all.

## Test-first

`test-driven-development` owns the cycle. Run it one case at a time: RED, a test that fails for the expected reason; GREEN, the minimal code that passes it; REFACTOR, cleanup with the suite green. A bug fix starts with a failing regression test that reproduces the report.

Tests are not optional for a behaviour change. A production diff lands in one of two states:

- a test that failed before the change and passes after it, or
- a stated reason no runnable test path exists, reported as residual risk.

`question` is denied in this harness, so "may I skip the test" is not an available move. Write the test, or name the gap.

Pick the smallest test that pins the behaviour: unit for a function or module, integration for a boundary (database, HTTP, filesystem, CLI), end to end only when the contract spans processes. When the project already has a suite, extend it instead of building a second harness.

## Package the change into work units

Classify the task before the first read:

- **Exploration** — read, trace, report. No edit.
- **Implementation** — code and tests.
- **Mixed** — discover, then write.
- **Analysis** — review, then report findings.

Read the code before changing it: trace the flow end to end, including callers of the function you touch, and never guess at architecture.

Split work into units of one behaviour, one source file or source-plus-test pair, and one checkable outcome. Slice vertically, not by layer: finish "parse the header, with its tests" before starting "render the body". Order units so the tree is green after each one: dependency before dependent, fixture before test, schema before serializer, migration before backfill. A unit you cannot verify alone is too big.

Confirm a path before editing it. List the parent directory or read the file first; with `glob` and `grep` denied, list directories and read candidate files.

Read the neighbours before writing: the module's imports and public surface, the closest existing test, and the project's check command. Match their style rather than importing a new one.

Per unit: change, run its check, read the observed result, then start the next unit. Verification belongs to the unit, not to the end of the task.

`diff-discipline` owns diff scope. This pack owns how many units there are and in what order.

## Standards

| Area | Rule |
|---|---|
| Errors | Fail fast and loud. Propagate with context: what failed, on which input. Never return `null`, `None`, or `false` to mean "error". |
| Naming | Variables name what they hold; functions name what they do; booleans read as predicates (`isReady`, `hasPermission`). |
| Functions | Small and single-purpose. Extract when a second responsibility appears, not in anticipation of one. |
| Comments | State why, not what. Delete restatement, stale claims, edit provenance, commented-out code, and debug prints. A suppression names its rule code and reason (Python: `# type: ignore[code]`). |
| Dependencies | Standard library first. Do not add a package for what twenty lines do. When you add one, choose a maintained, small-footprint package and justify it. |
| Security | Validate input at the boundary, parameterize queries, never log secrets, and check authorization on every entry point. |
| Performance | Correct first. Avoid accidental O(n²) and per-iteration allocation in hot paths; measure before optimizing. |
| Interface | Preserve the public contract unless the task changes it. When it must change, update every call site and the docs in the same change. |

## Acceptance criteria

A software change is acceptable when every line below is true and checked:

- The requested behaviour is pinned by a test that failed before the change.
- The full relevant suite passes, not only the new test.
- Lint and type checks pass for the touched files, through the project's own target.
- The diff stays inside the task scope; adjacent defects are reported, not silently fixed.
- Error paths fail explicitly and are covered by a test or named as untested.
- No debug output, commented-out code, or TODO without a tracked reference remains.
- Behaviour or interface changes update the docs and call sites that describe them.

## Proof of done

A criterion is proven by a command run after the final edit to that unit, with its observed output. "Tests pass" proves nothing; the command and its output do.

```text
criterion: malformed header returns 400
check: cd .opencode && just test -- tests/test_headers.py::test_malformed_header_returns_400
observed: 1 passed (exit 0)
```

Use the project's task-runner target for tests, lint, and type checks. Fall back to the runner's documented command only when no target exists, and say so.

## Stop and interrogate a gap

Gather evidence before declaring a gap: read the code, the tests, the docs, and the callers. The answer usually sits in the tree, not in the requester's head.

Continue on an `assume:` only when the unknown is cosmetic and cannot change acceptance: a private helper's name, log wording, the order of independent steps. Name where the assumption came from.

Stop and report `outcome: blocked` when:

- two readings of the task produce different tests or a different public interface;
- the behaviour change has no runnable check and none can be added inside the stated scope;
- the work needs an edit outside scope or a path the harness denies;
- a destructive or irreversible step (data migration, history rewrite, state deletion) lacks explicit authorization.

A gap report names the missing fact, the candidate readings, and the evidence that would settle it. One paragraph now costs less than a wrong diff.

## Anti-patterns

| Never | Do instead |
|---|---|
| Ship untested behaviour, including a feature "just this once". | Write the failing test first; if no test path exists, block or report residual risk. |
| Reinvent a utility that already exists in the tree or the standard library. | Read the module's exports, sibling helpers, and imports before writing a new function. |
| Leave a TODO, stub, `pass`, or placeholder. | Implement it, or declare a gap. A TODO survives only with a tracked issue reference. |
| Leave `print`, `console.log`, or debug-level logging behind. | Delete it before the unit is verified. |
| Guess a path or an API signature. | List or read first. |
| Silence a failing test by weakening its assertion or skipping it. | Fix the code, or correct a wrong test premise and state which it was. |
| Report results from memory of the last edit. | Quote the command and output observed this turn. |
| Comply with a request that trades quality for speed, such as a feature with no test. | Name the cost, deliver the tested change, and record the trade-off in residual risk. |

`diff-discipline` owns diff shape: style sweeps, renames, reformatting, and other churn that is not part of the behaviour change.
