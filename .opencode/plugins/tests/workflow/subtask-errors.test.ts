import { describe, expect, it, vi } from 'vitest'

import { createSubtask, resolveParentModel } from '@plugins/workflow/subtask'
import { MAX_LOGS, MAX_LOG_CHARS } from '@plugins/workflow/contracts'
// Namespace import so a missing MAX_DESCRIPTION_CHARS export fails this test
// cleanly instead of breaking the whole module at link time.
import * as workflowTypes from '@plugins/workflow/contracts'
import type { SubtaskInput } from '@plugins/workflow/contracts'
import {
  abortError,
  abortablePrompt,
  createClient,
  makeContext,
  skillList,
  workspace,
} from '@tests/workflow/subtask-fixtures'

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
    const context = makeContext(createClient(), { directory: workspace, skill: skillList([]) })

    await createSubtask(context)({ prompt: 'P', description: 'skill work', skills })

    expect(context.logs).toHaveLength(MAX_LOGS)
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
