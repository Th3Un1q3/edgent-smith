import { describe, expect, it, vi } from 'vitest'

import { createSubtask } from '@plugins/helpers/workflow-subtask'
import type { WorkflowContext, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

// Locked progress transport for a subtask: the child session's own title is the
// live signal (`client.session.update({ path: { id }, body: { title } })`), using
// the installed v1 SDK shape where `path.id` is the session id. Titles carry the
// run id and a status marker: `wf#<id> · [running] <description>` ->
// `wf#<id> · [ok]`/`[error]`/`[aborted]`. A failure to update a title must never
// fail the subtask.

interface SessionUpdateArguments {
  path: { id: string }
  body: { title: string }
}

interface FakeSubtaskClient {
  client: WorkflowSdkClient
  create: ReturnType<typeof vi.fn>
  prompt: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

const createClient = (overrides: {
  create?: any
  prompt?: any
  update?: any
  abort?: any
} = {}): FakeSubtaskClient => {
  const create = overrides.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } }))
  const prompt = overrides.prompt
    ?? vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }))
  const update = overrides.update ?? vi.fn(async () => ({ data: {} }))
  const abort = overrides.abort ?? vi.fn(async () => true)
  const client = {
    session: { create, prompt, update, abort },
  } as unknown as WorkflowSdkClient
  return { client, create, prompt, update }
}

// The runner generates the run id once per run and threads it through the
// context; a directly constructed context pins it so titles are deterministic.
const RUN_ID = 'wf#abc123'

const makeContext = (
  client: WorkflowSdkClient,
  partial: Partial<WorkflowContext> = {},
): WorkflowContext => ({
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
  running: new Map(),
  startedAt: Date.now(),
  runId: RUN_ID,
  ...partial,
})

const sessionUpdates = (fake: FakeSubtaskClient): SessionUpdateArguments[] =>
  fake.update.mock.calls.map(([argument]) => argument as SessionUpdateArguments)

const sessionTitles = (fake: FakeSubtaskClient): string[] =>
  sessionUpdates(fake).map(update => update.body.title)

const waitUntil = async (isDone: () => boolean): Promise<void> => {
  for (let index = 0; index < 200 && !isDone(); index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1)
    })
  }
}

// ── createSubtask: child-session title reporting ─────────────────

describe('createSubtask session title reporting', () => {
  it('marks the child session running before prompting and ok once it settles', async () => {
    const order: string[] = []
    const create = vi.fn(async () => {
      order.push('create')
      return { data: { id: 'ses_child' } }
    })
    const update = vi.fn(async (argument: SessionUpdateArguments) => {
      order.push(`update:${argument.body.title}`)
      return { data: {} }
    })
    const prompt = vi.fn(async () => {
      order.push('prompt')
      return { data: { parts: [{ type: 'text', text: 'OUT' }] } }
    })
    const fake = createClient({ create, update, prompt })
    const context = makeContext(fake.client)

    const result = await createSubtask(context)({ prompt: 'do work', description: 'run work' })

    expect(result.status).toBe('ok')
    expect(order).toEqual([
      'create',
      `update:${RUN_ID} · [running] run work`,
      'prompt',
      `update:${RUN_ID} · [ok] run work`,
    ])
    expect(sessionUpdates(fake)).toEqual([
      { path: { id: 'ses_child' }, body: { title: `${RUN_ID} · [running] run work` } },
      { path: { id: 'ses_child' }, body: { title: `${RUN_ID} · [ok] run work` } },
    ])
  })

  it('marks the child session error when the turn fails', async () => {
    const fake = createClient({
      prompt: vi.fn(async () => ({ data: { info: { error: 'boom' }, parts: [] } })),
    })
    const context = makeContext(fake.client)

    const result = await createSubtask(context)({ prompt: 'do work', description: 'work' })

    expect(result.status).toBe('error')
    expect(sessionTitles(fake)).toEqual([
      `${RUN_ID} · [running] work`,
      `${RUN_ID} · [error] work`,
    ])
  })

  it('truncates the running title to the 80-char description convention', async () => {
    const fake = createClient()
    const context = makeContext(fake.client)
    const description = 'y'.repeat(120)

    const result = await createSubtask(context)({ prompt: 'do work', description })

    expect(result.status).toBe('ok')
    expect(sessionTitles(fake)[0]).toBe(`${RUN_ID} · [running] ${'y'.repeat(80)}`)
    expect(sessionTitles(fake)[1]).toBe(`${RUN_ID} · [ok] ${'y'.repeat(80)}`)
  })

  it('marks the child session aborted when the parent signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const prompt = vi.fn((input: { signal?: AbortSignal } = {}) =>
      new Promise((_resolve, reject) => {
        const onAbort = (): void => {
          reject({ name: 'AbortError', message: 'aborted' })
        }
        if (input.signal?.aborted === true) {
          onAbort()
        }
        else {
          input.signal?.addEventListener('abort', onAbort, { once: true })
        }
      }),
    )
    const fake = createClient({ prompt })
    const context = makeContext(fake.client, { signal: controller.signal })

    const run = createSubtask(context)({ prompt: 'do work', description: 'work', timeout_seconds: 5 })
    await waitUntil(() => fake.prompt.mock.calls.length === 1)
    controller.abort()

    const result = await run

    expect(result.status).toBe('aborted')
    expect(sessionTitles(fake)).toEqual([
      `${RUN_ID} · [running] work`,
      `${RUN_ID} · [aborted] work`,
    ])
  })

  it('remains successful when session.update rejects', async () => {
    const update = vi.fn(async () => {
      throw new Error('update down')
    })
    const fake = createClient({ update })
    const context = makeContext(fake.client)

    const result = await createSubtask(context)({ prompt: 'do work', description: 'work' })

    expect(result.status).toBe('ok')
    expect(result.outputText).toBe('OUT')
    // The rejected update must be swallowed, not silently skip reporting: the
    // session title is still moved through running to ok.
    expect(update).toHaveBeenCalled()
    expect(sessionTitles(fake)).toContain(`${RUN_ID} · [ok] work`)
  })

  it('updates the resumed session title when task_id names an existing child', async () => {
    const fake = createClient()
    const context = makeContext(fake.client)

    const result = await createSubtask(context)({
      prompt: 'do work',
      description: 'work',
      task_id: 'ses_existing',
    })

    expect(result.status).toBe('ok')
    expect(sessionUpdates(fake).map(update => update.path.id)).toEqual(['ses_existing', 'ses_existing'])
    expect(sessionTitles(fake)).toEqual([
      `${RUN_ID} · [running] work`,
      `${RUN_ID} · [ok] work`,
    ])
  })

  it('does not stall when the running title update never settles', async () => {
    let calls = 0
    const update = vi.fn(() => {
      calls += 1
      // Only the running-title write hangs; the terminal write resolves.
      return calls === 1 ? new Promise(() => {}) : Promise.resolve({ data: {} })
    })
    const fake = createClient({ update })
    const context = makeContext(fake.client)

    const result = await createSubtask(context)({ prompt: 'do work', description: 'work', timeout_seconds: 5 })

    expect(result.status).toBe('ok')
    expect(result.outputText).toBe('OUT')
    // The bounded write still happens and the subtask advances to its terminal
    // title instead of orphaning the child session behind a hung `session.update`.
    expect(sessionTitles(fake)).toEqual([
      `${RUN_ID} · [running] work`,
      `${RUN_ID} · [ok] work`,
    ])
  }, 10_000)
})
