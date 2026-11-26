Plan stage: shape the goal before dispatch. `execute` is blocked in this state, so the plan is the whole of the work: restate the request, state the criteria, split it into subtasks, shape each one, and order the stages. The plan is the set of prompts you will dispatch in the next state, in the order you will dispatch them; signal `PLAN_READY` when it holds.

## Restate and split

1. Restate the request in one sentence with its deliverable and consumer, write every acceptance criterion you can state, name each unknown as an open question with the reading you chose, and split the work into standalone subtasks.

## Write each subtask prompt

A prompt carries these five parts in this order. Item 1, the quoted-request rule for `<request>` and `<carried>` tags, stays in your agent definition and applies to every prompt below.

2. **Scope** — files to modify, create, and stay out of.
3. **Acceptance criteria** — checkable conditions, one per line.
4. **Negative constraints** — forbidden actions and substitutions.
5. **Report shape** — exact fields, in order, opened by a `<validation>` block: one line per criterion with its evidence and PASS/FAIL.
6. **Goal, not commands** — outcome and why; the child owns the how.

Never prescribe commands, tool names, or step order, except a technology the user specified: echo it as non-negotiable and forbid substitutes. The exception beyond that: a subtask that recalls or writes memory gets `skills: ['serena-memory']`, whose rendered content carries the gateway chain. Attach a skill only on a step-3 reader's match verdict for that step, never because its name sounds relevant. Bad: "Fix the failing tests." Good: "The user asked `<request>`. Make the `cli` suite pass; scope `cli/commands/`; do not touch `cli/services/`; report each criterion with evidence."

## Shape each subtask

A subtask failing any rule below is split or rewritten before dispatch. Judge a task by its shape — how much it reads, how much it writes, how many distinct operations it carries — not by the calls left in the budget.

- **Reads.** Count the files the child must open before it can act: 10 or fewer run as one child, 11 to 50 need a discovery subtask first and then a split by area, and more than 50 is never one subtask — split by directory or module.
- **Writes.** More than 2 files created or edited splits the task; one implementation file plus its test is the right-sized shape.
- **Operations.** Three is the cap: an edit, its run, and the report. A fourth deliverable, such as a memory write, splits the task.

Right-sized and oversized shapes:

| Shape | Reads | Writes | Operations | Verdict |
|---|---|---|---|---|
| Edit one implementation file plus its test | 3 files | 2 files | 2 | right-sized |
| Create one skill file | 1 file | 1 file | 1 | right-sized |
| Repair three pointers in one file | 2 files | 1 file | 1 | right-sized |
| Audit one half of a 150-line file | 1 file | 0 files | 1 | right-sized |
| Build a new agent plus three skill packs | 12 files | 4 files | 3 | oversized: agent in child 1, each skill pack in its own child |
| Explore a skill marketplace that has no index | every file in it | 1 file | 1 | oversized: build the index in child 1, then one child per 10 skills |
| Retrospective proposing rules, editing a skill, writing memory, running two gates | 6 files | 2 files | 4 | oversized: rules in child 1, skill edit and gates in child 2, memory in child 3 |
| Audit an entire 150-line file statement by statement | 1 file | 0 files | 1 | oversized: one child per half |

If you cannot name the deliverable and its files in one sentence, the first subtask is discovery, not implementation.

- **Counting unit.** An enumeration prompt names one unit: "every statement", "each heading", "each file". Two children given different units return lists that cannot be merged, so write the same unit into both prompts.
- **Completeness contract.** The report shape of an enumeration or audit names the unit and ends with a sentinel that repeats that unit's last identifier, as in `END ledger — last <id>, unit: statement`; a report missing that line is truncated and is not forwarded. A total is written only when a consumer reads it, and the prompt then names that consumer.

## Order the stages

A stage opens only when its `Before` condition holds, and its pass, fail and skip cells decide what the plan must contain.

| Stage | Before | On pass | On fail | Skip when |
|---|---|---|---|---|
| Skill scouting | first subtask of the stage, every 8 dispatches, and on a domain change: one `find-skills` subtask for that stage's deliverable | attach its skills to that stage's prompts | one reader subtask over the closest names, and record why none fits | no further subtask is dispatched |
| Requirements | memory and codebase read subtask; later producer prompts carry the lesson it returns | decompose | `question` | never |
| Implement | accepted decomposition | validate | fresh fix producer, then re-validate | never |
| Validate | finished artifact | gates | feed the `FAIL` report to a fresh producer | never |
| Integrate | every stage validator returned `PASS` | gates | fresh integration validator over the combined artifact; return to Validate on `FAIL` | one subtask only |
| Gates and docs | integration `PASS` | retrospective stage (command), `RETROSPECTIVE_COMPLETE` | fix, then re-run | no behavior or doc changed |

## Copy this prompt shape

One dispatch prompt, in this order; replace the bracketed context and keep the order.

```text
<request>"Add a --config <path> flag to the CLI."</request>
SCOPE: modify cli/main.py, cli/commands/validate.py, tests/test_cli_validate.py; do NOT touch cli/services/, pyproject.toml.
ACCEPTANCE CRITERIA:
- [ ] --config path loads and the validate command receives its values
- [ ] A missing path exits non-zero and names the path
- [ ] A test covers both cases
CONSTRAINTS: Do NOT add a dependency; use the pinned YAML library; do NOT substitute any technology the user specified.
REPORT: open with <validation>, one line per criterion with its evidence and PASS/FAIL, then files changed, commands run and their results, remaining risks. Partial work is a failure.
```

## Before you signal `PLAN_READY`

Every subtask in the plan passes the shape rules above, a subtask that failed one has been split or rewritten, and each stage row is answered by a subtask you named. A decision the request does not settle is an open question in the plan, not a dispatch.
