---
name: progressive-validation
description: Load when a session enters the validate stage and must judge an artifact by a fresh child's quoted verdict, because the producer's own done is the only evidence and GOAL_ACHIEVED is refused without a quoted PASS.
---

# Progressive Validation

You are in `validate`: the only verdict this stage accepts is a fresh child's, quoted from its own report.

Verdict: call signal_send with type GOAL_ACHIEVED when the goal is met, or GOAL_INCOMPLETE when it is not.

## Validate the artifact

4. Validate every artifact in a fresh subtask that never received the producer's `task_id` or `fork_from`, then report the outcome with the evidence or escalate under Failure Modes.

### Fresh judge

**Intent**: a fresh subtask that never received the producer's `task_id` reads the artifact and the criteria and answers `PASS`, `FAIL`, or `UNVERIFIABLE` alone on line 1 with evidence; `UNVERIFIABLE` names the evidence that is absent, and a verdict counts as `PASS` only when line 1 reads `PASS` and no criterion line in its validation block is marked `FAIL` or `UNVERIFIABLE`. The judge also checks the criteria against the request: an uncovered user requirement or a substituted technology is a `FAIL`. The verdict goes back to the producer, and the judge is never the producer. **When**: a producer returned an artifact and its own "done" is the only evidence, with written criteria to check it against. **Combine**: with While loop to feed each `FAIL` report back for another round; with execute first, summarize later when a criterion turns on a fact only the child can confirm.

```js
// body for the envelope: it supplies run, settle, ok, parse and skillsSeen, and holds the only try/catch
console.log('producing the change')
const build = await run({ description: 'build the change', skills: ['test-driven-development'], prompt: 'The user asked: "<request>". Acceptance: <criteria>.' })
if (!ok(build)) return { stage: 'build', status: build.status, error: build.error }
console.log('judging the build in a fresh session')
const judge = await run({ description: 'judge the build', prompt: `A producer built: ${build.outputText.trim()}\nCriteria: <criteria>. Output PASS, FAIL, or UNVERIFIABLE (missing evidence) alone on line 1, then one line per criterion as <criterion as stated> — PASS|FAIL|UNVERIFIABLE — <evidence>, then END verdict — last: <the last criterion as stated>.` })
if (!ok(judge)) return { stage: 'judge', status: judge.status, error: judge.error }
const lines = judge.outputText.trim().split('\n')
const closed = /^END verdict — last: \S/.test(lines[lines.length - 1])
if (!closed) return { stage: 'judge', status: 'incomplete', report: judge.outputText }
const verdict = (lines[0].match(/\b(PASS|FAIL|UNVERIFIABLE)\b/) || [])[1]
const flagged = lines.slice(1).some((l) => / — (FAIL|UNVERIFIABLE)( |$)/.test(l))
if (verdict === 'PASS' && !flagged) return { status: 'passed' }
console.log('pushing the judge findings back to the producer')
const fixed = await run({ task_id: build.task_id, description: 'fix what the judge found', prompt: `A fresh judge returned:\n${judge.outputText.trim()}\nFix exactly what it names and report each criterion again.` })
if (!ok(fixed)) return { stage: 'fix', status: fixed.status, error: fixed.error }
const result = { stage: 'judge', status: 'fixed', report: fixed.outputText.trim() }
```

## Judge prompt shape

Write the validator's prompt to this shape:

```text
A previous agent was asked to: <request>"Add a --config <path> flag to the CLI."</request>
Artifact: cli/main.py, cli/commands/validate.py, tests/test_cli_validate.py
Criteria:
- --config path loads values into the validate command
- a missing path exits non-zero and names the path
- a test covers both cases
Output PASS, FAIL, or UNVERIFIABLE alone on line 1. Then, per criterion: PASS or FAIL with file:line evidence or gate output; UNVERIFIABLE names the evidence that is missing.
Check the criteria against the request: name any user requirement they do not cover; an uncovered requirement or a substituted technology is an automatic FAIL.
Run the tests, name every bug or unconfirmed criterion, and do not restate the implementation or trust the producer's report; a claim without output is a FAIL.
End with: END verdict — last: <the last criterion as the prompt states it>
```

### While loop (Ralph loop)

**Intent**: produce, judge fresh, feed the `FAIL` report back, and repeat; cap at 3 rounds and escalate past the cap. A broken judge is not failed work: it gets one fresh re-judge inside the same round, and two broken judges in one round end the loop with the blocker. **When**: one artifact must pass a judge, each fix is a rerun carrying the `FAIL` report, and the criteria hold across rounds. **Combine**: with Fresh judge for every round's verdict; with rollback and revisit once the cap hits with failed changes still in the tree.

```js
// body for the envelope: it supplies run, settle, ok, parse and skillsSeen, and holds the only try/catch
const INTENT = 'The user asked: "<request>". Acceptance: <criteria>.'
let feedback = ''
let lastReport = ''
let broken = 0
for (let round = 1; round <= 3; round += 1) {
  const fix = feedback ? `\nA fresh judge returned this failure report; fix exactly what it names:\n${feedback}` : ''
  console.log(`round ${round}: produce`)
  const producer = await run({ description: `produce attempt ${round}`, skills: ['test-driven-development'], prompt: INTENT + fix })
  if (!ok(producer)) {
    broken += 1
    console.log(`producer broke in round ${round}: ${producer.status}`)
    if (broken >= 2) return { status: 'blocked', round, reason: `no usable artifact after ${broken} attempts: ${producer.status}` }
    feedback = `Your previous attempt returned no usable report (${producer.status}). Produce the artifact and report it.`
    continue
  }
  broken = 0
  lastReport = producer.outputText.trim()
  console.log(`round ${round}: judge`)
  const ask = INTENT + ' PASS, FAIL, or UNVERIFIABLE (missing evidence) alone on line 1; then one line per criterion as <criterion as stated> — PASS|FAIL|UNVERIFIABLE — <evidence>; end with END verdict — last: <the last criterion as stated>.'
  let judge = await run({ description: `judge attempt ${round}`, prompt: `${ask}\nArtifact report:\n${lastReport}` })
  if (!ok(judge)) judge = await run({ description: `re-judge attempt ${round}`, prompt: `${ask}\nArtifact report:\n${lastReport}` })
  if (!ok(judge)) return { status: 'blocked', round, reason: `judge unavailable twice: ${judge.status}`, report: lastReport }
  const lines = judge.outputText.trim().split('\n')
  const closed = /^END verdict — last: \S/.test(lines[lines.length - 1])
  const verdict = (lines[0].match(/\b(PASS|FAIL|UNVERIFIABLE)\b/) || [])[1]
  const flagged = lines.slice(1).some((l) => / — (FAIL|UNVERIFIABLE)( |$)/.test(l))
  if (closed && verdict === 'PASS' && !flagged) return { status: 'passed', round }
  feedback = judge.outputText.trim()
}
console.log('round cap reached; escalating instead of looping')
if (!lastReport) return { status: 'blocked', rounds: 3, reason: 'no round produced a report' }
const result = { status: 'capped', rounds: 3, last_report: lastReport, feedback }
```

## Verdict intake

- **Verdict overflow.** When the verdict exceeds the output cap, forward the section that holds the failing criteria, named by its `##` heading, and list the criteria not forwarded.
- **Partial input.** A child whose input lacks its expected sentinel stops and names the gap; that refusal is the correct outcome.
- **Empty result.** An `ok` result with empty `outputText` is recovered inside the envelope's `settle`: it reads the child's session outputs and substitutes the last one that carries text.

| Event | Mandated follow-up | Extension point |
|---|---|---|
| `subtask_failed` | read `error`; retry once narrower or canonically; then escalate | a row here plus one Failure Modes rule |
| `validation_failed` | fresh producer carrying the `FAIL` report; re-validate; stop at the cap | [While loop](#while-loop-ralph-loop) body |
| `cap_hit` | shrink scope or split, then resume the same `task_id`; ask | [Rollback and revisit](../progressive-panic/SKILL.md#rollback-and-revisit) |
| `objective_complete` | retrospective stage, then return | [Retrospective: Prompt the Command](../task-delegation/workflows/task-delegation-workflow.md#retrospective-prompt-the-command) |
| `objective_blocked` | `question` with evidence and options | Failure Modes → stop triggers |

## Close the task

- [ ] Every criterion has a `PASS` from a fresh validator, quoted.
- [ ] Multi-subtask work passed a fresh integration validator over the combined artifact, its `PASS` quoted; single-subtask work records that integration was skipped.
- [ ] A dispatched child ran `just ci` and it passed — `just ci-fast` when only docs, YAML, or justfiles changed — and the output is quoted.
- [ ] No contributing result is `truncated`, none has a status other than `ok`, and none is still empty after `settle`; every path sits inside scope.
- [ ] Docs were updated where behavior changed, and the retrospective stage ran through its command and closed on `RETROSPECTIVE_COMPLETE`; the report names anything left undone.
- [ ] Every tool fact (parameter, status, cap, default) matches the Tooling table; every `js` body but the envelope is statement-level with no `try`, and the envelope holds the only `try`/`catch`.
- [ ] Every scouting pass is logged with each skill chosen or rejected and its reason, or the report says why none ran.
