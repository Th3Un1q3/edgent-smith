import { describe, expect, it, vi } from 'vitest'

import { runWorkflow } from '@plugins/helpers/workflow-runner'
import { createSubtask } from '@plugins/helpers/workflow-subtask'
import type { SubtaskResult, WorkflowContext, WorkflowEnvelope } from '@plugins/helpers/workflow-types'

// Integration-style coverage of the read → parallel forks → synthesis pattern.
// The first block drives the public `subtask()` seam; the second drives the
// documented fork-fanout script through `runWorkflow`, so forked provenance is
// exercised on the same path the workflow tool executes.

// ── helpers ──────────────────────────────────────────────────────

const text = (value: string): any => ({
  data: { info: {}, parts: [{ type: 'text', text: value }] },
})

const tagged = (value: unknown): any =>
  text(`<result_json>${JSON.stringify(value)}</result_json>`)

const makeContext = (client: any, partial: Partial<WorkflowContext> = {}): WorkflowContext => ({
  client,
  parentSessionID: 'ses_parent',
  signal: new AbortController().signal,
  defaultAgent: 'rug-swe',
  maxConcurrent: 4,
  maxSubtasks: 32,
  budget: { used: 0 },
  steps: [],
  logs: [],
  active: new Set(),
  ...partial,
})

interface HarnessOptions {
  createIds?: string[]
  forkIds?: string[]
  // A static response, or a factory that echoes the actual prompt the runner sent
  // so assertions test real data flow instead of the string the test built.
  responses?: Record<string, any | ((input: any) => any)>
}

// Stateful fake of the WorkflowSdkClient surface createSubtask touches. `create`
// and `fork` hand out deterministic, incrementing session ids and `prompt`
// answers from a session-id -> response map so every branch stays observable.
const createHarness = (options: HarnessOptions = {}) => {
  const createIds = options.createIds ?? ['ses_read', 'ses_synth']
  let createIndex = 0
  const create = vi.fn(async () => ({ data: { id: createIds[createIndex++] } }))

  const forkIds = options.forkIds ?? ['ses_fork_1', 'ses_fork_2', 'ses_fork_3']
  let forkIndex = 0
  const fork = vi.fn(async () => ({ data: { id: forkIds[forkIndex++] } }))

  const responses = options.responses ?? {}
  const prompt = vi.fn(async (input: any) => {
    const value = responses[input.path.id]
    return typeof value === 'function' ? value(input) : (value ?? text('OUT'))
  })

  const session: Record<string, unknown> = { create, prompt, fork }
  const client = { session }
  const context = makeContext(client)
  return { client, context, subtask: createSubtask(context), create, fork, prompt, createIds, forkIds }
}

const promptTextFor = (prompt: any, sessionID: string): string | undefined =>
  prompt.mock.calls.find(([input]: [{ path: { id: string } }]) => input.path.id === sessionID)
    ?.[0].body.parts[0].text as string | undefined

// ── fork fanout through the subtask seam ─────────────────────────

describe('fork fanout through the subtask seam', () => {
  it('reads a document, audits it with one distinct question per fork, then synthesizes', async () => {
    const document = 'DOCUMENT BODY'
    const schema = { type: 'object', required: ['answer'] }
    const branches = [
      { question: 'Audit for security flaws', answer: { answer: 'security-ok' } },
      { question: 'Audit for performance issues', answer: { answer: 'perf-ok' } },
      { question: 'Audit for correctness bugs', answer: { answer: 'correctness-ok' } },
    ]

    const harness = createHarness({
      responses: {
        ses_read: text(document),
        ses_fork_1: tagged(branches[0].answer),
        ses_fork_2: tagged(branches[1].answer),
        ses_fork_3: tagged(branches[2].answer),
        // Echo the prompt the runner actually sent, wrapped as the schema requires,
        // so the assertions below inspect real synthesized content.
        ses_synth: (input: any) => tagged({ synthesis: input.body.parts[0].text }),
      },
    })

    // 1. One subtask reads the document on a freshly created session.
    const read: SubtaskResult = await harness.subtask({
      prompt: 'Read the document',
      description: 'read document',
    })
    expect(read.status).toBe('ok')
    expect(read.task_id).toBe('ses_read')
    expect(read.outputText).toBe(document)
    expect(read.forked_from).toBeUndefined()

    // 2. Fan out: one fork per distinct audit question, dispatched in parallel.
    const results = await Promise.all(
      branches.map(branch =>
        harness.subtask({
          fork_from: read.task_id,
          prompt: branch.question,
          description: branch.question,
          schema,
        }),
      ),
    )

    // Every branch forked the SOURCE session and never created a fresh one.
    expect(harness.fork).toHaveBeenCalledTimes(branches.length)
    for (const [input] of harness.fork.mock.calls as unknown as Array<[unknown]>) {
      expect(input).toEqual({ path: { id: read.task_id } })
    }
    expect(harness.create).toHaveBeenCalledTimes(1)

    // Provenance: each result points back at the source and carries its fork id,
    // and the followup prompt sent ON the fork carried that branch's question.
    for (const [index, result] of results.entries()) {
      expect(result.status).toBe('ok')
      expect(result.task_id).toBe(harness.forkIds[index])
      expect(result.forked_from).toBe(read.task_id)
      expect(result.data).toEqual(branches[index].answer)
      expect(promptTextFor(harness.prompt, result.task_id)).toContain(branches[index].question)
    }

    // 3. Synthesize the fork answers in a final, non-forked subtask.
    const synthesisPrompt = `Synthesize the audits:\n${results.map(result => `${result.task_id}: ${result.outputText}`).join('\n')}`
    const synthesis = await harness.subtask({
      prompt: synthesisPrompt,
      description: 'synthesize audits',
      schema: { type: 'object', required: ['synthesis'] },
    })

    expect(synthesis.status).toBe('ok')
    expect(synthesis.task_id).toBe('ses_synth')
    expect(synthesis.forked_from).toBeUndefined()
    expect(harness.create).toHaveBeenCalledTimes(2)

    // The synthesis result is derived from the prompt the runner actually sent,
    // proving every fork's answer and session id reached the synthesis turn.
    const synthesized = (synthesis.data as { synthesis: string }).synthesis
    for (const [index, branch] of branches.entries()) {
      expect(synthesized).toContain(branch.answer.answer)
      expect(synthesized).toContain(harness.forkIds[index])
    }
  })

  it('leaves the non-fork path unchanged when fork_from is absent', async () => {
    const harness = createHarness({ responses: { ses_read: text('PLAIN') } })

    const result = await harness.subtask({ prompt: 'plain work', description: 'plain work' })

    expect(result.status).toBe('ok')
    expect(result.outputText).toBe('PLAIN')
    expect(result.task_id).toBe('ses_read')
    expect(result.forked_from).toBeUndefined()
    expect(harness.fork).not.toHaveBeenCalled()
    expect(harness.create).toHaveBeenCalledTimes(1)
    expect(harness.create).toHaveBeenCalledWith({
      body: { title: 'plain work', parentID: 'ses_parent' },
    })
    // The exact legacy prompt body: no schema block, no model, no fork metadata.
    expect(harness.prompt).toHaveBeenCalledWith({
      path: { id: 'ses_read' },
      signal: expect.any(AbortSignal),
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'plain work' }] },
    })
  })
})

// ── fork fanout through runWorkflow ──────────────────────────────

interface RunnerOptions {
  createIds?: string[]
  forkIds?: string[]
  responses?: Record<string, any | ((input: any) => any)>
  // Held open per prompt so overlapping prompts expose the concurrency peak.
  delayMs?: number
}

// Fake WorkflowSdkClient wired for `runWorkflow`, tracking the peak number of
// prompts in flight so the semaphore can be observed.
const createRunnerClient = (options: RunnerOptions = {}) => {
  const createIds = options.createIds ?? ['ses_read']
  let createIndex = 0
  const create = vi.fn(async () => ({ data: { id: createIds[createIndex++] } }))

  const forkIds = options.forkIds ?? ['ses_fork_1', 'ses_fork_2', 'ses_fork_3', 'ses_fork_4']
  let forkIndex = 0
  const fork = vi.fn(async () => ({ data: { id: forkIds[forkIndex++] } }))

  const responses = options.responses ?? {}
  let active = 0
  let peak = 0
  const prompt = vi.fn(async (input: any) => {
    active += 1
    peak = Math.max(peak, active)
    if (options.delayMs !== undefined) {
      await new Promise((resolve) => {
        setTimeout(resolve, options.delayMs)
      })
    }
    active -= 1
    const value = responses[input.path.id]
    return typeof value === 'function' ? value(input) : (value ?? text('OUT'))
  })

  return {
    client: { session: { create, fork, prompt } },
    create,
    fork,
    prompt,
    peak: () => peak,
  }
}

const runnerOptions = (script: string, overrides: Record<string, unknown> = {}) => ({
  script,
  client: (overrides.client as any) ?? createRunnerClient().client,
  parentSessionID: 'ses_parent',
  timeoutMs: 1000,
  ...overrides,
})

const parseEnvelope = (json: string): WorkflowEnvelope => JSON.parse(json) as WorkflowEnvelope

const READ_THEN_FORK_FANOUT
  = 'const base = await subtask({ prompt: "Read the document", description: "read document" })\n'
    + 'const questions = ["q1", "q2", "q3", "q4"]\n'
    + 'const forks = await Promise.all(questions.map(q => subtask({ fork_from: base.task_id, prompt: q, description: q })))\n'
    + 'return forks.map(r => ({ task_id: r.task_id, forked_from: r.forked_from }))'

describe('fork fanout through runWorkflow', () => {
  it('runs the documented fork-fanout script and surfaces forked_from in the envelope', async () => {
    const runner = createRunnerClient()
    const envelope = parseEnvelope(await runWorkflow(runnerOptions(READ_THEN_FORK_FANOUT, { client: runner.client })))

    expect(envelope.status).toBe('ok')
    // (a) every fork forked the source session id the read subtask returned.
    expect(runner.fork).toHaveBeenCalledTimes(4)
    for (const [input] of runner.fork.mock.calls as unknown as Array<[unknown]>) {
      expect(input).toEqual({ path: { id: 'ses_read' } })
    }
    expect(runner.create).toHaveBeenCalledTimes(1)

    // (b) the script-returned result carries fork provenance for every branch.
    expect(envelope.result).toEqual([
      { task_id: 'ses_fork_1', forked_from: 'ses_read' },
      { task_id: 'ses_fork_2', forked_from: 'ses_read' },
      { task_id: 'ses_fork_3', forked_from: 'ses_read' },
      { task_id: 'ses_fork_4', forked_from: 'ses_read' },
    ])

    // The step records carry the read plus each fork's task id.
    expect(envelope.steps.map(step => step.task_id)).toEqual([
      'ses_read',
      'ses_fork_1',
      'ses_fork_2',
      'ses_fork_3',
      'ses_fork_4',
    ])

    // Stats count every recorded step exactly once and stay finite.
    expect(envelope.stats).toMatchObject({ subtasks: 5, ok: 5, error: 0, empty: 0, timeout: 0, aborted: 0 })
    expect(envelope.stats.ok + envelope.stats.error + envelope.stats.empty
      + envelope.stats.timeout + envelope.stats.aborted).toBe(envelope.steps.length)
    expect(Number.isFinite(envelope.stats.totalMs)).toBe(true)
  })

  it('halts with budget_exceeded and keeps the partial steps when parallel forks overrun the budget', async () => {
    const runner = createRunnerClient()
    const envelope = parseEnvelope(
      await runWorkflow(runnerOptions(READ_THEN_FORK_FANOUT, { client: runner.client, maxSubtasks: 2 })),
    )

    expect(envelope.status).toBe('budget_exceeded')
    expect(envelope.error).toBe('workflow subtask budget exceeded (2)')

    // Only the read completed before the overrun, so its step is the sole one
    // retained. The parallel forks were still in flight when the budget overrun
    // rejected the script, and the failure path serializes the envelope
    // synchronously, so in-flight steps are intentionally not serialized. This
    // assertion is about the completed step, not fork retention: a fork step
    // would require a fork to have finished before the rejection.
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0]).toMatchObject({ task_id: 'ses_read', status: 'ok' })
    // The budget overrun rejects the script, so no script result is produced.
    expect(envelope.result).toBeUndefined()

    // Stats are finite and internally consistent: every recorded step is counted
    // exactly once, the recorded steps can never outnumber the budget consumed,
    // and no per-status count can exceed the subtask total.
    const perStatus = envelope.stats.ok + envelope.stats.error + envelope.stats.empty
      + envelope.stats.timeout + envelope.stats.aborted
    expect(envelope.stats.subtasks).toBe(2)
    expect(perStatus).toBe(envelope.steps.length)
    expect(perStatus).toBeLessThanOrEqual(envelope.stats.subtasks)
    for (const key of ['subtasks', 'ok', 'error', 'empty', 'timeout', 'aborted', 'totalMs'] as const) {
      expect(Number.isFinite(envelope.stats[key] as number)).toBe(true)
    }
    for (const key of ['ok', 'error', 'empty', 'timeout', 'aborted'] as const) {
      expect(envelope.stats[key]).toBeLessThanOrEqual(envelope.stats.subtasks)
    }
    // Forks never create fresh sessions.
    expect(runner.create).toHaveBeenCalledTimes(1)
  })

  it('bounds concurrent forks to max_concurrent', async () => {
    const runner = createRunnerClient({ delayMs: 5 })
    const envelope = parseEnvelope(
      await runWorkflow(runnerOptions(READ_THEN_FORK_FANOUT, { client: runner.client, maxConcurrent: 2 })),
    )

    expect(envelope.status).toBe('ok')
    // Four forks are dispatched together but only two prompts run at once.
    expect(runner.fork).toHaveBeenCalledTimes(4)
    expect(runner.peak()).toBe(2)
  })
})
