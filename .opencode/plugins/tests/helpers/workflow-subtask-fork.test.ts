import { describe, expect, it, vi } from 'vitest'

import { createSubtask, normalizeParameters } from '@plugins/helpers/workflow-subtask'
import type { SubtaskInput, WorkflowContext } from '@plugins/helpers/workflow-types'

// ── helpers ──────────────────────────────────────────────────────

const createClient = (
  options: { create?: any, prompt?: any, fork?: any, abort?: any, messages?: any, update?: any } = {},
): any => ({
  session: {
    create: options.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: options.prompt ?? vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
    abort: options.abort ?? vi.fn(async () => true),
    update: options.update ?? vi.fn(async () => ({ data: {} })),
    ...(options.fork !== undefined && { fork: options.fork }),
    ...(options.messages !== undefined && { messages: options.messages }),
  },
})

// Mirrors the live `session.prompt` cancellation surface: an Error whose `name`
// is 'AbortError'. Built via `defineProperty` rather than assigning the built-in
// `name` (unicorn/no-error-property-assignment).
const createAbortError = (): Error => {
  const error = new Error('aborted')
  Object.defineProperty(error, 'name', { value: 'AbortError', configurable: true })
  return error
}

// Never resolves until its abort signal fires, rejecting with an abort error;
// mirrors the live `session.prompt` cancellation surface.
const abortablePrompt = (): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((_resolve, reject) => {
      const onAbort = (): void => reject(createAbortError())
      if (signal?.aborted === true) {
        onAbort()
      }
      else {
        signal?.addEventListener('abort', onAbort, { once: true })
      }
    }),
  )

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

// ── normalizeParameters fork_from edge cases ─────────────────────
// Fork_from normalization is owned here; task_id and the shared object-field
// validators live in workflow-subtask-parameters.test.ts.

describe('normalizeParameters fork_from edge cases', () => {
  it('passes a non-empty source id through', () => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', fork_from: 'ses_source' }).fork_from)
      .toBe('ses_source')
  })

  it('trims surrounding whitespace from a source id', () => {
    const result = normalizeParameters({ prompt: 'p', description: 'd', fork_from: '  ses_source  ' })

    expect(result.fork_from).toBe('ses_source')
  })

  it.each([
    ['empty', ''],
    ['whitespace', ' '.repeat(3)],
  ])('treats a %s fork_from as absent', (_label, forkFrom) => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', fork_from: forkFrom }).fork_from).toBeUndefined()
  })

  it('treats an undefined fork_from as absent', () => {
    const result = normalizeParameters({ prompt: 'p', description: 'd', fork_from: undefined })

    expect(result.fork_from).toBeUndefined()
  })

  it.each([123, true, null, {}])('throws a TypeError naming fork_from for a non-string %#', (forkFrom) => {
    const input = { prompt: 'p', description: 'd', fork_from: forkFrom } as unknown as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(TypeError)
    expect(() => normalizeParameters(input)).toThrow(/fork_from/)
  })
})

// ── createSubtask fork_from ──────────────────────────────────────

describe('createSubtask fork_from', () => {
  it('forks the source session on its receiver and prompts on the fork', async () => {
    // `this.marker` proves the call keeps the session receiver; a detached call
    // would yield `ses_fork_undefined` instead of `ses_fork_bound`.
    const fork = vi.fn(function (this: any, _input: unknown) {
      return Promise.resolve({ data: { id: `ses_fork_${this?.marker}` } })
    })
    const client = createClient({ fork })
    client.session.marker = 'bound'

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(fork).toHaveBeenCalledWith({ path: { id: 'ses_source' } })
    expect(client.session.create).not.toHaveBeenCalled()
    expect(result.status).toBe('ok')
    expect(result.task_id).toBe('ses_fork_bound')
    expect(result.forked_from).toBe('ses_source')
    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ses_fork_bound' } }),
    )
  })

  it('returns an error result and counts the attempt when fork is unsupported', async () => {
    const client = createClient()
    const context = makeContext(client)

    const result = await createSubtask(context)({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/fork/i)
    // The failure names the source session that could not be forked.
    expect(result.error).toContain('ses_source')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.budget.used).toBe(1)
    expect(context.steps).toHaveLength(1)
  })

  it('returns an error result when fork throws', async () => {
    const fork = vi.fn(async () => {
      throw new Error('boom')
    })
    const client = createClient({ fork })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/fork/i)
    // The failure names the source session that could not be forked.
    expect(result.error).toContain('ses_source')
    expect(result.error).toMatch(/boom/)
  })

  it('returns an error result when fork resolves without an id', async () => {
    const fork = vi.fn(async () => ({ data: {} }))
    const client = createClient({ fork })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/fork/i)
    // The failure names the source session that could not be forked.
    expect(result.error).toContain('ses_source')
  })

  it('ignores an empty fork_from and creates a normal session', async () => {
    const fork = vi.fn()
    const client = createClient({ fork })

    const result = await createSubtask(makeContext(client))({
      prompt: 'work',
      description: 'work',
      fork_from: ' '.repeat(3),
    })

    expect(fork).not.toHaveBeenCalled()
    expect(client.session.create).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('ok')
    expect(result.forked_from).toBeUndefined()
  })

  it('forks the trimmed source id when fork_from is padded', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: '  ses_source  ',
    })

    expect(fork).toHaveBeenCalledWith({ path: { id: 'ses_source' } })
    expect(result.forked_from).toBe('ses_source')
  })

  it('resumes via task_id without forking or creating', async () => {
    const fork = vi.fn()
    const client = createClient({ fork })

    const result = await createSubtask(makeContext(client))({
      prompt: 'follow up',
      description: 'follow up',
      task_id: 'ses_existing',
    })

    expect(fork).not.toHaveBeenCalled()
    expect(client.session.create).not.toHaveBeenCalled()
    expect(result.task_id).toBe('ses_existing')
    expect(result.forked_from).toBeUndefined()
  })

  it('returns an error result and counts the attempt when task_id and fork_from conflict', async () => {
    const fork = vi.fn()
    const client = createClient({ fork })
    const context = makeContext(client)

    const result = await createSubtask(context)({
      prompt: 'ambiguous',
      description: 'ambiguous',
      task_id: 'ses_existing',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/mutually exclusive/)
    expect(fork).not.toHaveBeenCalled()
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.budget.used).toBe(1)
    expect(context.steps).toHaveLength(1)
  })

  it('keeps forked_from and the fork id when the fork succeeds but the prompt throws', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const prompt = vi.fn(async () => {
      throw new Error('prompt boom')
    })
    const client = createClient({ fork, prompt })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('error')
    expect(result.task_id).toBe('ses_fork')
    expect(result.forked_from).toBe('ses_source')
    expect(result.error).toMatch(/prompt boom/)
  })

  it('forwards the parent model to the fork prompt exactly as the non-fork path does', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
    }))
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork, messages })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('ok')
    expect(messages).toHaveBeenCalledWith({ path: { id: 'ses_parent' } })
    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'ses_fork' },
        body: expect.objectContaining({
          agent: 'rug-swe',
          model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' },
        }),
      }),
    )
  })

  it('links a parent abort to the fork session id, not a newly created session', async () => {
    const controller = new AbortController()
    const abort = vi.fn(async () => true)
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork, abort, prompt: abortablePrompt() })
    const context = makeContext(client, { signal: controller.signal })

    const pending = createSubtask(context)({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })
    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(result.task_id).toBe('ses_fork')
    expect(result.forked_from).toBe('ses_source')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_fork' } })
    expect(client.session.create).not.toHaveBeenCalled()
  })

  it('forks with exactly the path argument (no messageID body)', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork })

    await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(fork).toHaveBeenCalledTimes(1)
    expect(fork).toHaveBeenCalledWith({ path: { id: 'ses_source' } })
  })

  it('titles the forked child running then terminal, never the source title', async () => {
    const titles: string[] = []
    const update = vi.fn(async (argument: { body: { title: string } }) => {
      titles.push(argument.body.title)
      return { data: {} }
    })
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork, update })

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'forked work',
      fork_from: 'ses_source',
    })

    expect(result.status).toBe('ok')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(titles[0]).toMatch(/^wf#[0-9a-f]{6} · \[running\] forked work$/)
    // Derive the dynamic run id from the first title so both compare against the
    // same id the runner generated rather than a literal.
    const runId = titles[0].slice(0, titles[0].indexOf(' · '))
    expect(titles).toEqual([`${runId} · [running] forked work`, `${runId} · [ok] forked work`])
    expect(titles).not.toContain('ses_source')
  })
})
