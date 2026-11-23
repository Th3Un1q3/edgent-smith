import { describe, expect, it, vi } from 'vitest'

import { createSubtask } from '@plugins/workflow/subtask'
import { createClient, makeContext, resolveOnAbortPrompt } from '@tests/workflow/subtask-fixtures'

// ── createSubtask: resolved-turn classification ──────────────────

describe('createSubtask resolved-turn classification', () => {
  it('classifies a timeout when the prompt resolves empty after the abort fires', async () => {
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.02 minutes')
    expect(context.steps[0]).toMatchObject({ status: 'timeout', error: 'subtask timed out after 0.02 minutes' })
  })

  it('classifies a timeout ahead of an info error when both are present', async () => {
    const client = createClient({
      prompt: resolveOnAbortPrompt({ data: { info: { error: new Error('boom') }, parts: [] } }),
    })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.02 minutes')
    expect(context.steps[0]).toMatchObject({ status: 'timeout' })
  })

  it('classifies an abort when the parent aborts and the prompt resolves empty', async () => {
    const controller = new AbortController()
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)({ prompt: 'work', description: 'run work', timeout_minutes: 60 })

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
