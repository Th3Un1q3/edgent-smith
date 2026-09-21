import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'

import {
  BudgetExceededError,
  createSemaphore,
  createSubtask,
  extractOutputText,
  injectSkills,
  loadSkill,
  resolveParentModel,
} from '@plugins/helpers/workflow-subtask'
import { MAX_LOGS, MAX_LOG_CHARS, MAX_MAX_SUBTASKS_CAP, MAX_STEP_OUTPUT_CHARS } from '@plugins/helpers/workflow-types'
// Namespace import so a missing MAX_DESCRIPTION_CHARS export fails this test
// cleanly instead of breaking the whole module at link time.
import * as workflowTypes from '@plugins/helpers/workflow-types'
import type { SubtaskInput, WorkflowContext, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

// ── helpers ──────────────────────────────────────────────────────

const abortError = (): { name: string, message: string } => ({
  name: 'AbortError',
  message: 'aborted',
})

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })

const createClient = (
  options: { create?: any, prompt?: any, abort?: any, messages?: any } = {},
): any => ({
  session: {
    create: options.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: options.prompt ?? vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
    abort: options.abort ?? vi.fn(async () => true),
    ...(options.messages !== undefined && { messages: options.messages }),
  },
})

// Resolves (rather than rejects) with the given turn data only once its abort
// signal fires — mirrors the live `session.prompt` bug in which a timed-out or
// aborted turn comes back as an empty success instead of an AbortError.
const resolveOnAbortPrompt = (data?: unknown): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((resolve) => {
      const finish = (): void => resolve(data ?? { data: { info: {}, parts: [] } })
      if (signal?.aborted === true) {
        finish()
      }
      else {
        signal?.addEventListener('abort', finish, { once: true })
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

const abortablePrompt = (): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((_resolve, reject) => {
      const onAbort = (): void => reject(abortError())
      if (signal?.aborted === true) {
        onAbort()
      }
      else {
        signal?.addEventListener('abort', onAbort, { once: true })
      }
    }),
  )

// ── fixtures ─────────────────────────────────────────────────────

const skillDirectory = await mkdtemp(path.join(tmpdir(), 'workflow-subtask-'))

await mkdir(path.join(skillDirectory, '.agents', 'skills', 'demo'), { recursive: true })
await writeFile(
  path.join(skillDirectory, '.agents', 'skills', 'demo', 'SKILL.md'),
  'DEMO CONTENT',
  'utf8',
)

afterAll(async () => {
  await rm(skillDirectory, { recursive: true, force: true })
})

// ── createSemaphore ──────────────────────────────────────────────

describe('createSemaphore', () => {
  it('bounds concurrent executions to the limit', async () => {
    const semaphore = createSemaphore(2)
    let active = 0
    let highWater = 0
    const run = async (): Promise<void> => {
      active += 1
      highWater = Math.max(highWater, active)
      await delay(10)
      active -= 1
    }

    await Promise.all(Array.from({ length: 6 }, () => semaphore.run(run)))

    expect(highWater).toBeLessThanOrEqual(2)
  })

  it('drains queued work in FIFO order', async () => {
    const semaphore = createSemaphore(1)
    const order: number[] = []
    const run = (value: number) => async (): Promise<void> => {
      await delay(1)
      order.push(value)
    }

    await Promise.all([
      semaphore.run(run(1)),
      semaphore.run(run(2)),
      semaphore.run(run(3)),
    ])

    expect(order).toEqual([1, 2, 3])
  })

  it('throws RangeError when limit is below 1', () => {
    expect(() => createSemaphore(0)).toThrow(RangeError)
  })
})

// ── extractOutputText ────────────────────────────────────────────

describe('extractOutputText', () => {
  it('joins only text parts with newlines', () => {
    const data = {
      parts: [
        { type: 'text', text: 'a' },
        { type: 'reasoning', text: 'skip' },
        { type: 'tool', text: 'skip' },
        { type: 'text', text: 'b' },
      ],
    }

    expect(extractOutputText(data)).toBe('a\nb')
  })

  it('tolerates missing parts and non-string text', () => {
    expect(extractOutputText({})).toBe('')
    expect(extractOutputText(undefined)).toBe('')
    expect(extractOutputText({ parts: [{ type: 'text' }] })).toBe('')
  })
})

// ── skills ───────────────────────────────────────────────────────

describe('loadSkill', () => {
  it('loads SKILL.md for a valid name', async () => {
    await expect(loadSkill(skillDirectory, 'demo')).resolves.toBe('DEMO CONTENT')
  })

  it('returns undefined for a missing skill, invalid name, or no directory', async () => {
    await expect(loadSkill(skillDirectory, 'missing')).resolves.toBeUndefined()
    await expect(loadSkill(skillDirectory, '../secret')).resolves.toBeUndefined()
    await expect(loadSkill(skillDirectory, 'a/b')).resolves.toBeUndefined()
    await expect(loadSkill(undefined, 'demo')).resolves.toBeUndefined()
  })
})

describe('injectSkills', () => {
  it('wraps loaded skills in the task_skills block', async () => {
    const result = await injectSkills('PROMPT', ['demo'], skillDirectory)

    expect(result).toBe(
      '<task_skills>\n<skill name="demo">\nDEMO CONTENT\n</skill>\n</task_skills>\n\nPROMPT',
    )
  })

  it('logs a warning and leaves the prompt unchanged when a skill is missing', async () => {
    const logs: string[] = []
    const log = (message: unknown): void => {
      logs.push(String(message))
    }

    const result = await injectSkills('PROMPT', ['missing'], skillDirectory, log)

    expect(result).toBe('PROMPT')
    expect(logs).toEqual(['skill not found: missing'])
  })

  it('leaves the prompt unchanged when no skills are requested', async () => {
    await expect(injectSkills('PROMPT', undefined, skillDirectory)).resolves.toBe('PROMPT')
    await expect(injectSkills('PROMPT', [], skillDirectory)).resolves.toBe('PROMPT')
  })
})

// ── createSubtask ────────────────────────────────────────────────

describe('createSubtask', () => {
  it('creates a child session with the description as title and the parent id', async () => {
    const client = createClient()
    const result = await createSubtask(makeContext(client))('do work')

    expect(client.session.create).toHaveBeenCalledWith({
      body: { title: 'do work', parentID: 'ses_parent' },
    })
    expect(result.status).toBe('ok')
    expect(result.task_id).toBe('ses_child')
  })

  it('prompts with the default agent and a text part', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: 'ses_child' },
      signal: expect.any(AbortSignal),
      body: {
        agent: 'rug-swe',
        parts: [{ type: 'text', text: 'do work' }],
      },
    })
  })

  it('does not send a tools field', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body).not.toHaveProperty('tools')
  })

  it('honours the agent override', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', agent: 'custom' })

    expect(client.session.prompt.mock.calls[0][0].body.agent).toBe('custom')
  })

  it('resumes an existing task_id without creating a session', async () => {
    const client = createClient()
    const result = await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', task_id: 'ses_existing' })

    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt.mock.calls[0][0].path).toEqual({ id: 'ses_existing' })
    expect(result.task_id).toBe('ses_existing')
  })

  it('returns an error result when the turn reports an error', async () => {
    const prompt = vi.fn(async () => ({ data: { info: { error: new Error('boom') }, parts: [] } }))
    const context = makeContext(createClient({ prompt }))
    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('boom')
    expect(context.steps[0]).toMatchObject({ status: 'error', description: 'do work' })
  })

  it('returns an empty result when the turn has only whitespace text', async () => {
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: ' '.repeat(3) }] } }))
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('empty')
    expect(result.outputText).toBe(' '.repeat(3))
  })

  it('times out when the turn exceeds the per-call timeout', async () => {
    const abort = vi.fn(async () => true)
    const client = createClient({ prompt: abortablePrompt(), abort })
    const result = await createSubtask(makeContext(client))({ prompt: 'slow', description: 'slow work', timeout_seconds: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toContain('0.0s')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
  })

  it('aborts when the parent signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const client = createClient({ prompt: abortablePrompt() })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
  })

  it('aborts the child session server-side when the parent signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const abort = vi.fn(async () => true)
    const client = createClient({ prompt: abortablePrompt(), abort })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
  })

  it('throws BudgetExceededError when the budget is exhausted and increments on success', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 1 })
    const subtask = createSubtask(context)

    await expect(subtask('one')).resolves.toMatchObject({ status: 'ok' })
    expect(context.budget.used).toBe(1)

    await expect(subtask('two')).rejects.toBeInstanceOf(BudgetExceededError)
    await expect(subtask('two')).rejects.toThrow('workflow subtask budget exceeded (1)')
  })

  it('returns aborted without creating a session when the parent is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = createClient()
    const context = makeContext(client, { signal: controller.signal })
    const result = await createSubtask(context)('do work')

    expect(result).toMatchObject({ status: 'aborted', task_id: '', durationMs: 0 })
    expect(result.error).toBe('workflow already aborted')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.steps[0]).toMatchObject({ status: 'aborted' })
  })

  it('records an error step and does not throw for invalid input', async () => {
    const context = makeContext(createClient())
    const result = await createSubtask(context)({ prompt: '' } as unknown as SubtaskInput)

    expect(result.status).toBe('error')
    expect(result.error).toContain('non-empty')
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '' })
  })

  it('returns an error result when the session id is missing', async () => {
    const create = vi.fn(async () => ({ data: {} }))
    const result = await createSubtask(makeContext(createClient({ create })))('do work')

    expect(result.status).toBe('error')
    expect(result.task_id).toBe('')
  })

  it('returns an error result when session creation rejects', async () => {
    const create = vi.fn(async () => {
      throw new Error('no session')
    })
    const result = await createSubtask(makeContext(createClient({ create })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('no session')
  })

  it('returns an error result when the prompt rejects', async () => {
    const prompt = vi.fn(async () => {
      throw new Error('network')
    })
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('network')
  })

  it('injects skills into the prompt body', async () => {
    const client = createClient()
    const context = makeContext(client, { directory: skillDirectory })

    await createSubtask(context)({ prompt: 'PROMPT', description: 'skill work', skills: ['demo'] })

    expect(client.session.prompt.mock.calls[0][0].body.parts[0].text).toBe(
      '<task_skills>\n<skill name="demo">\nDEMO CONTENT\n</skill>\n</task_skills>\n\nPROMPT',
    )
  })

  it('truncates output beyond the shared character limit with a marker', async () => {
    const prompt = vi.fn()
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: 'a'.repeat(MAX_STEP_OUTPUT_CHARS - 1) }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: 'a'.repeat(MAX_STEP_OUTPUT_CHARS) }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: 'a'.repeat(MAX_STEP_OUTPUT_CHARS + 1) }] } })
    const subtask = createSubtask(makeContext(createClient({ prompt })))

    const under = await subtask('under')
    const exact = await subtask('exact')
    const over = await subtask('over')

    expect(under).toMatchObject({ outputText: 'a'.repeat(MAX_STEP_OUTPUT_CHARS - 1), truncated: false })
    expect(exact).toMatchObject({ outputText: 'a'.repeat(MAX_STEP_OUTPUT_CHARS), truncated: false })
    expect(over.outputText).toBe(`${'a'.repeat(MAX_STEP_OUTPUT_CHARS)}\n…[truncated 1 chars]`)
    expect(over.truncated).toBe(true)
  })

  it('bounds Promise.all fan-out to maxConcurrent', async () => {
    let active = 0
    let highWater = 0
    const prompt = vi.fn(async ({ signal }: { signal?: AbortSignal } = {}) => {
      active += 1
      highWater = Math.max(highWater, active)
      try {
        await delay(15, signal)
      }
      finally {
        active -= 1
      }
      return { data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }
    })
    const client = createClient({ prompt })
    const context = makeContext(client, { maxConcurrent: 2 })
    const subtask = createSubtask(context)

    const results = await Promise.all(Array.from({ length: 8 }, () => subtask('work')))

    expect(results.map(result => result.status)).toEqual(Array.from({ length: 8 }, () => 'ok'))
    expect(highWater).toBeLessThanOrEqual(2)
    expect(client.session.create).toHaveBeenCalledTimes(8)
  })

  it('records steps and caps them at MAX_MAX_SUBTASKS_CAP', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 100, maxConcurrent: 1 })
    const subtask = createSubtask(context)

    const results = await Promise.all(
      Array.from({ length: MAX_MAX_SUBTASKS_CAP + 1 }, (_value, index) => subtask(`task ${index}`)),
    )

    expect(results.map(result => result.status)).toEqual(
      Array.from({ length: MAX_MAX_SUBTASKS_CAP + 1 }, () => 'ok'),
    )
    expect(context.steps).toHaveLength(MAX_MAX_SUBTASKS_CAP)
    expect(context.steps[0]).toMatchObject({
      description: 'task 0',
      status: 'ok',
      truncated: false,
    })
  })
})

// ── createSubtask: parent model inheritance ──────────────────────

describe('createSubtask parent model inheritance', () => {
  it('inherits the model from the last assistant message', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
    }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
    })
  })

  it('inherits the model from the user-message info.model shape', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { role: 'user', model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } } }],
    }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
    })
  })

  it('scans messages from the end and skips entries without a model', async () => {
    const messages = vi.fn(async () => ({
      data: [
        { info: { providerID: 'first', modelID: 'old' } },
        { info: { role: 'assistant' } },
      ],
    }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'first',
      modelID: 'old',
    })
  })

  it('prefers the last message model over earlier ones', async () => {
    const messages = vi.fn(async () => ({
      data: [
        { info: { providerID: 'first', modelID: 'old' } },
        { info: { providerID: 'last', modelID: 'new' } },
      ],
    }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'last',
      modelID: 'new',
    })
  })

  it('resolves the parent model at most once across subtasks', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
    }))
    const context = makeContext(createClient({ messages }))
    const subtask = createSubtask(context)

    await Promise.all([subtask('a'), subtask('b'), subtask('c')])

    expect(messages).toHaveBeenCalledTimes(1)
    expect(messages).toHaveBeenCalledWith({ path: { id: 'ses_parent' } })
  })

  it('proceeds without a model and warns when messages is unavailable', async () => {
    const client = createClient()
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model and warns when messages rejects', async () => {
    const messages = vi.fn(async () => {
      throw new Error('no history')
    })
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model when no message carries one', async () => {
    const messages = vi.fn(async () => ({ data: [{ info: { role: 'assistant' } }] }))
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('resolveParentModel returns undefined when messages is missing', async () => {
    await expect(resolveParentModel(createClient(), 'ses_parent')).resolves.toBeUndefined()
  })

  // Regression: the generated SDK methods rely on `this._client`, so a detached
  // `const messages = client.session.messages` throws on every call and silently
  // disables model inheritance. This mock is receiver-sensitive and only resolves
  // when `this` is still the session object.
  it('preserves the session receiver while resolving the parent model', async () => {
    const prompt = vi.fn(async (_input: { body: { model?: unknown } }) => ({
      data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] },
    }))
    const session = {
      create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
      prompt,
      abort: vi.fn(async () => true),
      async messages(this: { __client?: unknown } | undefined) {
        if (this === undefined || this.__client === undefined) {
          throw new TypeError('undefined is not an object (evaluating \'this._client\')')
        }
        return {
          data: [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
        }
      },
    }
    let receiverAccesses = 0
    Object.defineProperty(session, '__client', {
      get() {
        receiverAccesses += 1
        return {}
      },
    })
    const client = { session } as unknown as WorkflowSdkClient
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
    })
    expect(receiverAccesses).toBeGreaterThan(0)
    expect(context.logs.some(line => line.includes('failed to resolve parent model'))).toBe(false)
  })
})

// ── createSubtask: resolved-turn classification ──────────────────

describe('createSubtask resolved-turn classification', () => {
  it('classifies a timeout when the prompt resolves empty after the abort fires', async () => {
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_seconds: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.0s')
    expect(context.steps[0]).toMatchObject({ status: 'timeout', error: 'subtask timed out after 0.0s' })
  })

  it('classifies a timeout ahead of an info error when both are present', async () => {
    const client = createClient({
      prompt: resolveOnAbortPrompt({ data: { info: { error: new Error('boom') }, parts: [] } }),
    })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_seconds: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.0s')
    expect(context.steps[0]).toMatchObject({ status: 'timeout' })
  })

  it('classifies an abort when the parent aborts and the prompt resolves empty', async () => {
    const controller = new AbortController()
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)({ prompt: 'work', description: 'run work', timeout_seconds: 60 })

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
    expect(context.steps[0]).toMatchObject({ status: 'aborted' })
  })

  it('reports empty only when the turn is neither timed out nor aborted', async () => {
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [] } }))
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('empty')
    expect(result.error).toBe('subtask produced no output')
  })
})

// ── createSubtask: error normalization, logging, and options ─────

describe('createSubtask error normalization and options', () => {
  it.each([
    ['a thrown string', 'raw', 'raw'],
    ['a thrown object', { code: 7 }, '{"code":7}'],
  ])('renders %s into the failure message', async (_label, thrown, expected) => {
    const prompt = vi.fn().mockRejectedValue(thrown)
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe(expected)
  })

  it('falls back to String() when the thrown error cannot be serialized', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const prompt = vi.fn().mockRejectedValue(circular)
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('[object Object]')
  })

  it('classifies a thrown AbortError by name as aborted', async () => {
    const prompt = vi.fn().mockRejectedValue(abortError())
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
  })

  it('creates a session when task_id is an empty string', async () => {
    const client = createClient()
    const result = await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', task_id: '' })

    expect(client.session.create).toHaveBeenCalledTimes(1)
    expect(result.task_id).toBe('ses_child')
  })

  it('uses the description as the step description and records it on the step', async () => {
    const context = makeContext(createClient())
    await createSubtask(context)({ prompt: 'do work', description: 'short label' })

    expect(context.steps[0]).toMatchObject({ description: 'short label' })
  })

  it('rejects an object subtask without a description and records an error step', async () => {
    const client = createClient()
    const context = makeContext(client)
    const result = await createSubtask(context)({ prompt: 'do work' } as SubtaskInput)

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/description/)
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '' })
  })

  it('rejects an object subtask with a whitespace-only description', async () => {
    const context = makeContext(createClient())
    const result = await createSubtask(context)({ prompt: 'do work', description: ' '.repeat(3) })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/description/)
    expect(context.steps[0]).toMatchObject({ status: 'error' })
  })

  it('truncates a long description onto the step to MAX_DESCRIPTION_CHARS', async () => {
    const context = makeContext(createClient())
    const description = 'd'.repeat(100)
    await createSubtask(context)({ prompt: 'do work', description })

    expect(context.steps[0].description).toHaveLength(workflowTypes.MAX_DESCRIPTION_CHARS)
    expect(context.steps[0].description).toBe(description.slice(0, workflowTypes.MAX_DESCRIPTION_CHARS))
  })

  it('derives the step description from a string shorthand', async () => {
    const context = makeContext(createClient())
    await createSubtask(context)('do work')

    expect(context.steps[0]).toMatchObject({ description: 'do work' })
  })

  it('JSON-stringifies and truncates long logs with a shared marker', async () => {
    const long = 'x'.repeat(MAX_LOG_CHARS + 500)
    const messages = vi.fn(() => Promise.reject(new Error(long)))
    const context = makeContext(createClient({ messages }))

    await createSubtask(context)('do work')

    expect(context.logs.length).toBeGreaterThan(0)
    expect(context.logs.every(line => line.length <= MAX_LOG_CHARS + '…[truncated]'.length)).toBe(true)
    expect(context.logs.some(line => line.includes('"failed to resolve parent model'))).toBe(true)
  })

  it('caps recorded logs at MAX_LOGS', async () => {
    const skills = Array.from({ length: MAX_LOGS + 5 }, (_value, index) => `missing-${index}`)
    const context = makeContext(createClient(), { directory: skillDirectory })

    await createSubtask(context)({ prompt: 'P', description: 'skill work', skills })

    expect(context.logs).toHaveLength(MAX_LOGS)
  })

  it('injects found skills and warns about missing ones', async () => {
    const logs: string[] = []
    const log = (message: unknown): void => {
      logs.push(String(message))
    }

    const result = await injectSkills('PROMPT', ['demo', 'missing'], skillDirectory, log)

    expect(result).toContain('<skill name="demo">')
    expect(result).not.toContain('missing')
    expect(logs).toEqual(['skill not found: missing'])
  })

  it('reads the nested model shape and tolerates an empty response', async () => {
    const empty = vi.fn(async () => {})
    await expect(resolveParentModel(createClient({ messages: empty }), 'ses_parent')).resolves.toBeUndefined()

    const nested = vi.fn(async () => ({
      data: [{ info: { model: { providerID: 'p', modelID: 'm' } } }],
    }))
    await expect(resolveParentModel(createClient({ messages: nested }), 'ses_parent')).resolves.toEqual({
      providerID: 'p',
      modelID: 'm',
    })
  })

  it('swallows errors from the server-side abort', async () => {
    const controller = new AbortController()
    const abort = vi.fn(() => {
      throw new Error('abort failed')
    })
    const client = createClient({ prompt: abortablePrompt(), abort })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(abort).toHaveBeenCalled()
  })
})
