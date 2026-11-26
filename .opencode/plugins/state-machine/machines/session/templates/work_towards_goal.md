Work towards: {{goal}}. Memories: {{memories}}. Preferences: {{preferences}}

You are in the work stage: every effect is a dispatch, so this text is the shape of each body you write. Scout before the stage's first producer, put every body inside the envelope, then pick the pattern that matches the dispatch you are about to send.

## Scout the stage before its first producer (step 3)

3. Scout skills at the first subtask of every new stage, again every 8 dispatches, whenever the task changes domain, and after a failure caused by a missing method; log the pass with each skill chosen or rejected and its reason. A pass that names no fit is not evidence that no skill fits: dispatch one reader subtask over the candidate names and have it report each description's match verdict.

### Skill exploration

**Intent**: map 0-3 skills per stage before that stage starts; zero is valid when no skill fits, and a combination needs a stated reason. **When**: at every scouting trigger in step 3, before the stage's first producer. **Combine**: with any pattern; it runs once per stage, not per child.

```js
// body for the envelope above
const STAGES = ['research the flag seam', 'implement the flag']
console.log('asking a fresh subtask to map skills to stages')
const rec = await run({ description: 'recommend 0-3 skills per stage', skills: ['find-skills'], prompt: `Stages: ${STAGES.join('; ')}. For each stage return 0-3 skills as an array (empty when none fits), a reason per skill tying it to that stage, and, when you return more than one, why the combination is needed. Combine only complementary capabilities (implementation plus its test discipline), never near-duplicates.`, schema: { type: 'object', properties: { recommendations: { type: 'array', items: { type: 'object', properties: { stage: { type: 'string' }, skills: { type: 'array', maxItems: 3, items: { type: 'string' } }, reason: { type: 'string' } }, required: ['stage', 'skills', 'reason'] } } }, required: ['recommendations'] } })
if (!ok(rec) || !rec.data) return { stage: 'explore', status: rec.status, error: rec.error }
const kept = rec.data.recommendations.filter((r) => STAGES.includes(r.stage) && Array.isArray(r.skills) && r.skills.length <= 3)
console.log(`kept ${kept.length} of ${rec.data.recommendations.length} recommendations`)
const skillsFor = (stage) => kept.find((r) => r.stage === stage)?.skills ?? []
const research = await run({ description: 'research the flag seam', skills: skillsFor(STAGES[0]), prompt: 'The user asked: "<request>". Report the seam the flag must thread through.' })
if (!ok(research)) return { stage: 'research', status: research.status, error: research.error }
const implement = await run({ description: 'implement the flag', skills: skillsFor(STAGES[1]), prompt: `The user asked: "<request>". Implement the flag through this seam:\n${research.outputText.trim()}` })
if (!ok(implement)) return { stage: 'implement', status: implement.status, error: implement.error }
const result = { stage: 'explore', artifact: implement.outputText.trim() }
```

- **A stage run without scouting** — a stage run with no scouting pass is failed; return to step 3.

## Put every body inside the envelope

`execute({ code })` binds `tools` and returns the body's value. Failure handling lives only here, so each body below omits it and starts at statement level. A throw ends the run with a serialised message carrying an audit of the children that were live plus the error; read that `audit` and resume each id it lists instead of losing the run. `console.log` lines report progress: their output returns to the caller under `Logs:` and survives a throw.

```js
try {
  console.log('<progress message>')
  const skillsSeen = {}
  const parse = (r) => JSON.parse(typeof r === 'string' ? r : JSON.stringify(r))
  const ok = (r) => r.status === 'ok' && !r.truncated && Boolean(r.outputText?.trim())
  // an ok child can finish with its report missing from the result; its session still holds it
  const settle = async (r) => {
    if (r.status !== 'ok' || r.outputText?.trim() || !r.task_id) return r
    const raw = await tools.subtask_outputs({ task_id: r.task_id, count: 3 })
    const entries = typeof raw === 'string' ? JSON.parse(raw) : raw
    const landed = (Array.isArray(entries) ? entries : [])
      .filter((e) => e && e.status === 'ok' && String(e.outputText || '').trim())
      .pop()
    return landed ? { ...r, outputText: landed.outputText.trim() } : r
  }
  const pick = (id, names = []) => (id ? names.filter((n) => !(skillsSeen[id] ?? []).includes(n)) : names)
  const note = (r, names = [], id) => {
    const key = r?.task_id ?? id
    if (key && names.length) skillsSeen[key] = [...new Set([...(skillsSeen[key] ?? []), ...names])]
  }
  const run = async (args) => {
    const first = await settle(parse(await tools.subtask_run({ ...args, skills: pick(args.task_id, args.skills) })))
    note(first, args.skills, args.task_id)
    if (ok(first)) return first
    // a failure that already reported output is not an interruption
    if (args.task_id || !first.task_id || first.outputText?.trim()) return first
    // fork_from cannot travel with task_id: the runner rejects both
    const resumed = await settle(parse(await tools.subtask_run({ task_id: first.task_id, description: args.description, agent: args.agent, schema: args.schema, prompt: `${args.prompt}\nYou were interrupted; continue and return your result.` })))
    return ok(resumed) ? resumed : first
  }
  // orchestration: a body below replaces this comment
  return result
} catch (e) {
  const updatedMessage = JSON.stringify({
    audit: await tools.subtask_ls({ count: 10 }),
    error: String(e)
  })
  throw updatedMessage
}
```

## Set the dispatch before you send it

- **`timeout_minutes` is omitted, not chosen.** Dispatch with no value and the child gets the 15-minute default. Set it only when the task is expected to outrun those 15 minutes (a full suite, a CI or gate run, a large enumeration); never shorten it, never size it per dispatch, and **never set it "just in case" or as a safety margin** — setting it on a task that finishes inside 15 minutes is a defect, not caution. Timeout governs wall-clock; it is unrelated to the 24-call budget, and a large task does not need more time, it needs a narrower scope or a discovery subtask first. When a child does expire, do not guess a bigger value: `subtask_outputs` returns that child's last outputs. `skills` takes skill names, not paths. The runner resolves each name to its skill id and attaches it to the child prompt, and the host renders that skill itself: it skips a name no installed skill matches and logs `skill not found`, drops a name that is not a valid skill name, and passes valid names through unchanged when the skill list cannot be read. `[]` attaches nothing.

### When to label

Label when the same child will be needed again later in the session and its identifier may be lost: the usual case is a role you keep returning to (a reviewer, a researcher, a memory writer, a builder you revisit), or a child whose accumulated context is the point. Do not label a one-off dispatch — discard its id instead — and do not relabel to start fresh: a label never rebinds, so a fresh child takes a new label.

```js
// body for the envelope above
const review = await run({ label: 'reviewer', description: 'review the change', prompt: 'The user asked: "<request>". Review the artifact and report each criterion.' })
if (!ok(review)) return { stage: 'review', status: review.status, error: review.error }
const recheck = await run({ label: 'reviewer', description: 'recheck the review', prompt: `The producer pushed the fixes; recheck the same criteria.\n${review.outputText.trim()}` })
```

## Pick the shape of the dispatch

### Fan-out

**Intent**: independent steps whose answers stay separate — parallel `run` calls with distinct scopes and per-branch results. **When**: the branches are known before the first call, each writes to its own scope, and no branch needs another's answer. **Fragility**: keep a fan-out to 2-3 branches, one `execute` call each, each report under the cap; a child expected to outrun the cap gets its own `execute` call. A child that comes back `error` with empty output produced nothing — relaunch it sequentially before judging its work. **Combine**: with Map-reduce when the branch answers must become one merged report; with skill exploration to choose each branch's skills before the split.

```js
// body for the envelope above
const branches = [
  { description: 'audit the CLI parser', scope: 'cli/commands/', skills: ['test-design'] },
  { description: 'audit the service layer', scope: 'cli/services/', skills: ['test-design'] }
]
console.log(`fanning out ${branches.length} independent audits`)
const runs = await Promise.all(branches.map((b) => run({ description: b.description, skills: b.skills, prompt: `The user asked: "<request>". Audit only ${b.scope} and report findings for that scope alone, ending with a sentinel that names the unit and its last identifier.` })))
const broken = runs.filter((r) => !ok(r))
if (broken.length) return { stage: 'fan-out', failed: broken.map((r) => r.status) }
console.log('keeping each branch answer separate')
const result = { stage: 'fan-out', branches: branches.map((b, i) => ({ scope: b.scope, findings: runs[i].outputText.trim() })) }
```

### Map-reduce

**Intent**: many items of one shape with one merged answer — map with a `schema`, keep the usable results, rerun only the missing ids once, then one reducer that returns ids and statuses, never payloads. **When**: the same prompt applies to every item in a list of one shape and the caller needs one merged answer, not each payload. **Combine**: with Fan-out when the items differ in shape and each answer stands alone; with fresh judge to rule on the reduced report.

```js
// body for the envelope above
const items = ['<id-a>', '<id-b>', '<id-c>']
const schema = { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } }, required: ['id', 'status'] }
console.log(`mapping ${items.length} items of one shape`)
const first = await Promise.all(items.map((id) => run({ description: `map ${id}`, prompt: `Handle item ${id}. Set id and status.`, schema })))
const usable = first.filter((r) => ok(r) && r.data)
const missing = items.filter((id) => !usable.some((r) => r.data.id === id))
if (missing.length) {
  console.log(`rerunning ${missing.length} missing ids once`)
  const again = await Promise.all(missing.map((id) => run({ description: `remap ${id}`, prompt: `Handle item ${id}. Set id and status.`, schema })))
  again.filter((r) => ok(r) && r.data).forEach((r) => usable.push(r))
}
console.log(`reducing ${usable.length} mapped results`)
const merged = await run({ description: 'reduce the mapped results', prompt: `Return ids and statuses only, never payloads.\n${JSON.stringify(usable.map((r) => r.data))}` })
if (!ok(merged)) return { stage: 'reduce', status: merged.status, error: merged.error }
const result = { stage: 'map-reduce', report: merged.outputText.trim() }
```

### Execute first, summarize later

**Intent**: two phases on two threads — the first call only executes, told to report status, paths, and decisions rather than prose; a fresh child then carries that extracted report and writes the summary, extraction, or formatted answer, so execution and summarization never compete for one context. **When**: the execution result is needed, but the prose or formatting would blunt the executing child's focus, or the summary must be shaped for a different consumer — a report, a commit message, a hand-off. **Combine**: with Fresh judge for the verdict on the artifact the executor produced, so the summarizer never rules on its own work; with fan-out when several executed children each need their own summary.

```js
// body for the envelope above
console.log('executing without asking for prose')
const exec = await run({ description: 'apply the migration', prompt: 'The user asked: "<request>". Do the work; report only status, changed paths, and decisions, no prose.' })
if (!ok(exec)) return { stage: 'execute', status: exec.status, error: exec.error }
console.log('starting a fresh child to write the summary from the extracted report')
const summary = await run({ description: 'summarize the executed work', prompt: `The executed report follows. Turn it into exactly three bullets for a hand-off: what changed, why, and what the reader must check.\n${exec.outputText.trim()}` })
if (!ok(summary)) return { stage: 'summarize', status: summary.status, error: summary.error }
const result = { stage: 'execute-first', status: exec.status, executed: exec.outputText.trim(), summary: summary.outputText.trim() }
```

## Hand over to the next child

Apply this ladder in order and stop at the first rung that fits; a fresh child is allowed only when the prior context is wrong, the work needs a different specialist, or the result needs fresh judgement.

1. **Reuse the session** — the default. The child keeps its context, working state, and injected skills; nothing crosses the boundary and the prompt carries only the delta. Cost: its context keeps growing.
2. **Memory** — one subtask stores a finding through the serena gateway (`skills: ['serena-memory']`), and later subtasks read it by name. Right choice: several children need the same data, or the value must outlive the session. Cost: two extra calls (write, read) and a schema-free read, so never for a single hand-off.
3. **Explicit output text** — the default when the next step must be a fresh child. Take `outputText` from the call result in the same execution, or from `subtask_outputs` in a later one, extract only the needed parts in code, and interpolate them into the next prompt. Right choice: a fresh session is required (validator, different specialist, summariser) and an existing output already holds what it needs. Cost: the carried span spends prompt tokens and is a snapshot, not live context.
4. **Orchestrator-composed payload** — last resort only, after rungs 1-3 were tried and each came up short: the prompt says why the resume, the pointer, and the existing `outputText` cannot carry it. Right choice: the next prompt needs a shape no existing output has — a rewritten brief over several sources — so no child could have said it itself. It never licences composing a decision, verdict, ranking, or comparison: those belong to the child that judges, resumed at rung 1 or dispatched as a [Fresh judge](validation_self_report.md#fresh-judge), and the orchestrator forwards its ruling. Cost: an extra orchestrator turn, retyped text that can drift, and provenance you must attribute to the source child.

A fresh judge is a subtask that never received the producer's `task_id`.

```js
// body for the envelope above
const id = '<task_id an earlier execution returned>'
console.log('continuing the implementer in its own session')
const built = await run({ task_id: id, description: 'finish the implementation', prompt: 'Continue the same task and end the report with a "## Handoff" section naming the changed files and the decision the next child needs.' })
if (!ok(built)) return { stage: 'resume', status: built.status, error: built.error }
// the handoff comes from the report we already hold; read the session outputs only when the report has no such section
let source = built.outputText.trim()
if (!source.includes('## Handoff')) {
  console.log(`reading the session outputs of ${id} for the handoff span`)
  const raw = await tools.subtask_outputs({ task_id: id, count: 3 })
  const last = (typeof raw === 'string' ? JSON.parse(raw) : raw).filter((r) => r && r.status === 'ok' && String(r.outputText || '').trim()).pop()
  if (!last) return { stage: 'outputs', task_id: id, error: 'no output with text in that session' }
  source = last.outputText
}
const marker = '## Handoff'
const at = source.indexOf(marker)
if (at === -1) return { stage: 'extract', task_id: id, error: 'output has no "## Handoff" section' }
const span = source.slice(at + marker.length).trim()
if (!span) return { stage: 'extract', task_id: id, error: 'handoff section is empty' }
const reviewer = await run({ description: 'review the handoff span', prompt: `Review only this reported change against the criteria the work was dispatched with.\nCriteria: <criteria>\nChange:\n${span}` })
if (!ok(reviewer)) return { stage: 'review', status: reviewer.status, error: reviewer.error }
const result = { status: 'reviewed', from: id, verdict: reviewer.outputText.trim() }
```
