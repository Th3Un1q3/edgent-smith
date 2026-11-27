---
name: progressive-panic
description: Load when the loop is blocked or the round cap of 3 is hit with failed changes in the tree, because the session must park, ask the user before any destructive step, and revert only the paths the failed child named.
---

# Progressive Panic

The loop is blocked. Report what stopped it, revert nothing without the user's own line, and ask before any destructive step.

## Rollback and revisit

**Intent**: a task or loop stops making progress — at the while-loop cap of 3 rounds — so the orchestrator interviews the child that made the changes, asks the user before anything destructive, reverts from the interview's own path list, and re-executes from the clean state. **When**: the round cap is hit with failed changes in the tree. **Combine**: with While loop when the clean-state retry must survive repeated judging; with skill exploration when the re-plan needs a capability the first attempt lacked.

## The escalation body

Write it inside the execution envelope: `run`, `ok` and the `catch` that carries a failure belong to the envelope, and this body adds only the escalation.

```js
// body for the envelope above
// default denies. Set to the user's own line; it must open with APPROVED: to admit the revert (Failure Modes → Denials)
const userApproval = ''
console.log('attempting the change')
const attempt = await run({ description: 'apply the change', prompt: 'The user asked: "<request>". Apply the change and report every file path you touched.' })
if (ok(attempt)) return { status: 'applied', artifact: attempt.outputText.trim() }
if (!attempt.task_id) return { stage: 'revisit', status: attempt.status, error: attempt.error ?? 'no child to interview' }
console.log('the attempt failed; interrogating the child that made the changes')
const blocked = await run({ task_id: attempt.task_id, description: 'interview the failed child', prompt: 'Answer in three lines: the exact file paths you changed, what blocked you, and what you would change next time.' })
if (!ok(blocked)) return { stage: 'revisit', status: blocked.status, error: blocked.error }
const approvalText = userApproval.trim()
// a shape check only: read the quoted line and refuse when it contradicts itself, e.g. "APPROVED: do not revert"
if (!/^APPROVED:/i.test(approvalText)) return { stage: 'revisit', status: 'needs_authorization', seen: approvalText || 'none', paths: blocked.outputText.trim(), next: 'ask with question; re-run this body with userApproval set to the user line, opening with APPROVED:' }
console.log('rolling back exactly the paths the interview named')
const revert = await run({ description: 'roll back the failed change', prompt: `The user asked: "<request>". A previous child changed the paths below and failed. Revert exactly those paths so the tree is clean again, touch nothing else, and report what you reverted.\n${blocked.outputText.trim()}` })
if (!ok(revert)) return { stage: 'rollback', status: revert.status, error: revert.error }
console.log('re-planning with the lesson and re-executing from the clean state')
const retry = await run({ description: 're-execute with the lesson', prompt: `The user asked: "<request>". A previous attempt was rolled back. Its lesson: ${blocked.outputText.trim()}. Plan around it and apply the change.` })
if (!ok(retry)) return { stage: 'retry', status: retry.status, error: retry.error }
const result = { stage: 'revisit', status: 'retried', rolled_back_child: attempt.task_id, report: retry.outputText.trim() }
```
