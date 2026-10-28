import { afterEach, describe, expect, it, vi } from 'vitest'

import { BudgetExceededError, createSubtask, parseStructured, pushLog } from '@plugins/helpers/workflow-subtask'
import { MAX_LOG_CHARS } from '@plugins/helpers/workflow-types'
import type { WorkflowContext } from '@plugins/helpers/workflow-types'

const FIXED_TIME = 1_700_000_000_000

const text = (value: string): any => ({
  data: { info: {}, parts: [{ type: 'text', text: value }] },
})

const assistant = (providerID: string, modelID: string): { info: Record<string, unknown> } => ({
  info: { role: 'assistant', providerID, modelID },
})

const createClient = (
  options: { create?: any, prompt?: any, messages?: any, fork?: any } = {},
): any => ({
  session: {
    create: options.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: options.prompt ?? vi.fn(async () => text('OUT')),
    abort: vi.fn(async () => true),
    ...(options.messages !== undefined && { messages: options.messages }),
    ...(options.fork !== undefined && { fork: options.fork }),
  },
})

const makeContext = (client: any, partial: Partial<WorkflowContext> = {}): WorkflowContext => ({
  client,
  parentSessionID: 'ses_parent',
  signal: new AbortController().signal,
  defaultAgent: 'rug-swe',
  maxSubtasks: 32,
  budget: { used: 0 },
  steps: [],
  logs: [],
  active: new Set(),
  ...partial,
})

// Rejects with an AbortError when the turn's signal fires, so the timer path
// reaches classifyError rather than a resolved response.
const abortablePrompt = (): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((_resolve, reject) => {
      const onAbort = (): void => reject({ name: 'AbortError', message: 'aborted' })
      if (signal?.aborted === true) {
        onAbort()
      }
      else {
        signal?.addEventListener('abort', onAbort, { once: true })
      }
    }),
  )

afterEach(() => {
  vi.useRealTimers()
})

describe('parseStructured fence anchoring', () => {
  const cases: Array<{ name: string, body: string, expected: unknown }> = [
    {
      name: 'unwraps a clean fenced object',
      body: '```json\n{"a":1}\n```',
      expected: { usable: true, value: { a: 1 } },
    },
    {
      name: 'unwraps a fenced body holding whitespace',
      body: '```json\n{"a": 1}\n```',
      expected: { usable: true, value: { a: 1 } },
    },
    {
      name: 'does not unwrap a fence followed by trailing prose',
      body: '```json\n{"a":1}\n```\nHere is my explanation.',
      expected: { usable: false },
    },
    {
      name: 'does not unwrap a fence preceded by leading prose',
      body: 'Here is my answer:\n```json\n{"a":1}\n```',
      expected: { usable: false },
    },
  ]

  it.each(cases)('$name', ({ body, expected }) => {
    expect(parseStructured(body, {})).toEqual(expected)
  })
})

describe('parseStructured required-key guard', () => {
  const cases: Array<{
    name: string
    value: Record<string, unknown>
    required: unknown[]
    expected: unknown
  }> = [
    {
      name: 'ignores a required list holding a non-string entry',
      value: { answer: 1 },
      required: ['answer', 7],
      expected: { usable: true, value: { answer: 1 } },
    },
    {
      name: 'accepts a value carrying a duplicated required key',
      value: { answer: 1 },
      required: ['answer', 'answer'],
      expected: { usable: true, value: { answer: 1 } },
    },
    {
      name: 'rejects a value missing a duplicated required key',
      value: { other: 1 },
      required: ['answer', 'answer'],
      expected: { usable: false },
    },
    {
      name: 'rejects a value carrying only some of the required keys',
      value: { answer: 1 },
      required: ['answer', 'b'],
      expected: { usable: false },
    },
  ]

  it.each(cases)('$name', ({ value, required, expected }) => {
    expect(parseStructured(JSON.stringify(value), { required })).toEqual(expected)
  })
})

describe('createSubtask model inheritance index', () => {
  const cases: Array<{ name: string, data: unknown[], expected: { providerID: string, modelID: string } }> = [
    {
      name: 'inherits the model of the assistant above a trailing user message',
      data: [assistant('opencode-go', 'model-a'), { info: { role: 'user' } }],
      expected: { providerID: 'opencode-go', modelID: 'model-a' },
    },
    {
      name: 'inherits the newest assistant model when a user message trails it',
      data: [assistant('opencode-go', 'model-a'), assistant('opencode-go', 'model-b'), { info: { role: 'user' } }],
      expected: { providerID: 'opencode-go', modelID: 'model-b' },
    },
    {
      name: 'tolerates a missing history entry above the newest assistant',
      data: [assistant('opencode-go', 'model-a'), undefined],
      expected: { providerID: 'opencode-go', modelID: 'model-a' },
    },
  ]

  it.each(cases)('$name', async ({ data, expected }) => {
    const messages = vi.fn(async () => ({ data }))
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual(expected)
    expect(context.logs.some(line => line.includes('parent model'))).toBe(false)
  })
})

describe('createSubtask error-path duration', () => {
  const errorAfter
    = (advanceMs: number): any =>
      vi.fn(async () => {
        vi.setSystemTime(new Date(FIXED_TIME + advanceMs))
        throw new Error('network')
      })

  it.each([2500, 37])('reports the exact %ims clock delta on a rejected turn', async (advanceMs) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TIME))
    const context = makeContext(createClient({ prompt: errorAfter(advanceMs) }))

    const result = await createSubtask(context)('do work')

    expect(result).toMatchObject({ status: 'error', error: 'network', durationMs: advanceMs })
    expect(context.steps[0]).toMatchObject({ status: 'error', durationMs: advanceMs })
  })
})

describe('createSubtask forked provenance on failure', () => {
  it('keeps forked_from when the turn fails after a successful fork', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_forked' } }))
    const prompt = vi.fn(async () => {
      throw new Error('network')
    })
    const client = createClient({ fork, prompt })

    const result = await createSubtask(makeContext(client))({
      prompt: 'continue',
      description: 'fork work',
      fork_from: 'ses_source',
    })

    expect(fork).toHaveBeenCalledWith({ sessionID: 'ses_source' })
    expect(result).toMatchObject({
      status: 'error',
      error: 'network',
      task_id: 'ses_forked',
      forked_from: 'ses_source',
    })
  })

  it('adds no forked_from when the turn fails without forking', async () => {
    const prompt = vi.fn(async () => {
      throw new Error('network')
    })
    const client = createClient({ prompt })

    const result = await createSubtask(makeContext(client))('do work')

    expect(result.status).toBe('error')
    expect(Object.hasOwn(result, 'forked_from')).toBe(false)
  })
})

describe('createSubtask timeout wording', () => {
  const cases: Array<{ minutes: number, message: string }> = [
    { minutes: 1, message: 'subtask timed out after 1 minute' },
    { minutes: 2, message: 'subtask timed out after 2 minutes' },
  ]

  it.each(cases)('reports "$message" for timeout_minutes $minutes', async ({ minutes, message }) => {
    vi.useFakeTimers()
    const context = makeContext(createClient({ prompt: abortablePrompt() }))

    const pending = createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_minutes: minutes })
    await vi.advanceTimersByTimeAsync(minutes * 60_000)
    const result = await pending

    expect(result).toMatchObject({ status: 'timeout', error: message })
  })
})

describe('createSubtask session-create duration', () => {
  const createRejectingAfter = (advanceMs: number): any =>
    vi.fn(async () => {
      vi.setSystemTime(new Date(FIXED_TIME + advanceMs))
      throw new Error('network')
    })

  it.each([2500, 37])('reports the exact %ims clock delta when session.create rejects', async (advanceMs) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TIME))
    const context = makeContext(createClient({ create: createRejectingAfter(advanceMs) }))

    const result = await createSubtask(context)('do work')

    expect(result).toMatchObject({ status: 'error', error: 'network', task_id: '', durationMs: advanceMs })
    expect(context.steps[0]).toMatchObject({ status: 'error', durationMs: advanceMs })
  })
})

describe('createSubtask budget exhaustion', () => {
  it('throws a BudgetExceededError whose name and message are exact', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 32, budget: { used: 32 } })

    let thrown: BudgetExceededError | undefined
    try {
      await createSubtask(context)('do work')
    }
    catch (error) {
      thrown = error as BudgetExceededError
    }

    expect(thrown).toBeInstanceOf(BudgetExceededError)
    expect(thrown?.name).toBe('BudgetExceededError')
    expect(thrown?.message).toBe('workflow subtask budget exceeded (32)')
  })
})

describe('pushLog truncation', () => {
  const MARKER = '…[truncated]'

  it('cuts an over-length message to exactly MAX_LOG_CHARS plus the marker', () => {
    const logs: string[] = []
    const message = 'x'.repeat(MAX_LOG_CHARS + 50)
    const encoded = JSON.stringify(message)

    pushLog(logs, message)

    expect(logs[0]).toBe(`${encoded.slice(0, MAX_LOG_CHARS)}${MARKER}`)
    expect(logs[0]).toHaveLength(MAX_LOG_CHARS + MARKER.length)
  })

  it('stores a message at or under the limit unchanged', () => {
    const logs: string[] = []
    const message = 'short message'

    pushLog(logs, message)

    expect(logs[0]).toBe(JSON.stringify(message))
  })
})

describe('createSubtask session.create without an id', () => {
  it('reports the exact failure message and clock delta under fake time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TIME))
    const create = vi.fn(async () => {
      vi.setSystemTime(new Date(FIXED_TIME + 640))
      return { data: {} }
    })
    const context = makeContext(createClient({ create }))

    const result = await createSubtask(context)('do work')

    expect(result).toEqual({
      outputText: '',
      task_id: '',
      status: 'error',
      error: 'failed to create subtask session',
      durationMs: 640,
    })
    expect(context.steps[0]).toMatchObject({ status: 'error', durationMs: 640 })
  })
})

describe('createSubtask pre-aborted parent signal', () => {
  it('records the aborted step label and leaves the client untouched', async () => {
    const parent = new AbortController()
    parent.abort()
    const client = createClient()
    const context = makeContext(client, { signal: parent.signal })

    const result = await createSubtask(context)('do work')

    expect(result).toEqual({
      outputText: '',
      task_id: '',
      status: 'aborted',
      error: 'workflow already aborted',
      durationMs: 0,
    })
    expect(context.steps[0]).toMatchObject({ description: 'aborted', status: 'aborted' })
    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt).not.toHaveBeenCalled()
  })
})
