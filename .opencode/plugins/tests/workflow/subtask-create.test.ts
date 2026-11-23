import { describe, expect, it, vi } from 'vitest'

import { BudgetExceededError, createSubtask } from '@plugins/workflow/subtask'
import { MAX_MAX_SUBTASKS_CAP } from '@plugins/workflow/contracts'
import type { SubtaskInput } from '@plugins/workflow/contracts'
import {
  abortablePrompt,
  createClient,
  demoSkill,
  makeContext,
  skillList,
  workspace,
} from '@tests/workflow/subtask-fixtures'

// ── createSubtask: session lifecycle ─────────────────────────────

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject({ name: 'AbortError', message: 'aborted' })
    }, { once: true })
  })

describe('createSubtask', () => {
  it('creates a child session with the description as title and the parent id', async () => {
    const client = createClient()
    const context = makeContext(client)
    const result = await createSubtask(context)('do work')

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
    const result = await createSubtask(makeContext(client))({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toContain('0.02 minutes')
    expect(result.outputText).toBe('')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
  })

  it('applies the 15-minute subtask default when no timeout is given', async () => {
    vi.useFakeTimers()
    try {
      const context = makeContext(createClient({ prompt: abortablePrompt() }))

      const pending = createSubtask(context)({ prompt: 'slow', description: 'slow work' })

      await vi.advanceTimersByTimeAsync(15 * 60_000)
      const result = await pending

      expect(result.status).toBe('timeout')
      expect(result.error).toBe('subtask timed out after 15 minutes')
    }
    finally {
      vi.useRealTimers()
    }
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
    expect(result).toMatchObject({ durationMs: 0, outputText: '' })
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '', description: 'invalid subtask input' })
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
    const context = makeContext(client, { directory: workspace, skill: skillList([demoSkill()]) })

    await createSubtask(context)({ prompt: 'PROMPT', description: 'skill work', skills: ['demo'] })

    expect(client.session.prompt.mock.calls[0][0].body.parts[0].text).toBe(
      '<task_skills>\n'
      + '<skill name="demo">\ndescription: Demo skill\npath: .agents/skills/demo/SKILL.md\n'
      + 'DEMO BODY\n\n---\n\nlater rule\n</skill>\n'
      + '</task_skills>\n\nPROMPT',
    )
  })

  it('returns a long output whole without a truncation marker', async () => {
    const long = 'a'.repeat(10_000)
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: long }] } }))
    const subtask = createSubtask(makeContext(createClient({ prompt })))

    const result = await subtask('long')

    expect(result.outputText).toBe(long)
    expect(Object.hasOwn(result, 'truncated')).toBe(false)
  })

  it('runs every subtask in a Promise.all fan-out', async () => {
    const prompt = vi.fn(async ({ signal }: { signal?: AbortSignal } = {}) => {
      await delay(15, signal)
      return { data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }
    })
    const client = createClient({ prompt })
    const context = makeContext(client)
    const subtask = createSubtask(context)

    const results = await Promise.all(Array.from({ length: 8 }, () => subtask('work')))

    expect(results.map(result => result.status)).toEqual(Array.from({ length: 8 }, () => 'ok'))
    expect(client.session.create).toHaveBeenCalledTimes(8)
  })

  it('records steps and caps them at MAX_MAX_SUBTASKS_CAP', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 100 })
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
    })
  })
})
