# Dispatch Envelope

When to load: before writing an `execute({ code })` body for a work-stage dispatch. Copy the envelope, replace the `// orchestration` comment with the body from [../SKILL.md](../SKILL.md), and keep the failure handling where it is.

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

A throw is the one path that reports nothing else, so it carries the audit of live children: resume each `task_id` that audit lists before starting anything new.
