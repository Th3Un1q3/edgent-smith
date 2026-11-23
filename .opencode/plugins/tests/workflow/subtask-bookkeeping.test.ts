import { afterEach, describe, expect, it, vi } from 'vitest'

import { BudgetExceededError, createSubtask } from '@plugins/workflow/subtask'
import type { SubtaskResult } from '@plugins/workflow/contracts'
import { createClient, makeContext } from '@tests/workflow/subtask-fixtures'

// ── createSubtask: duration, cleanup, and bookkeeping ────────────

describe('createSubtask duration, cleanup, and bookkeeping', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const runAt = async (advanceMs: number): Promise<SubtaskResult> => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_700_000_000_000))
    const prompt = vi.fn(async () => {
      vi.setSystemTime(new Date(1_700_000_000_000 + advanceMs))
      return { data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }
    })
    return createSubtask(makeContext(createClient({ prompt })))('do work')
  }

  it.each([1500, 0])('reports durationMs %i from the clock delta', async (advanceMs) => {
    const result = await runAt(advanceMs)

    expect(result).toMatchObject({ status: 'ok', durationMs: advanceMs })
  })

  it('clears the timer and the parent listener once the attempt settles', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const abort = vi.fn(async () => true)
    const result = await createSubtask(makeContext(createClient({ abort }), { signal: controller.signal }))({
      prompt: 'work',
      description: 'run work',
      timeout_minutes: 1,
    })

    controller.abort()
    await vi.advanceTimersByTimeAsync(2 * 60_000)

    expect(result.status).toBe('ok')
    expect(abort).not.toHaveBeenCalled()
  })

  it('backfills startedAt from the clock at creation time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_700_000_000_000))
    const context = makeContext(createClient())

    createSubtask(context)

    expect(context.startedAt).toBe(1_700_000_000_000)
  })

  it('rethrows a BudgetExceededError raised mid-attempt without recording a step', async () => {
    const prompt = vi.fn(async () => {
      throw new BudgetExceededError('child budget exceeded')
    })
    const context = makeContext(createClient({ prompt }))

    await expect(createSubtask(context)('do work')).rejects.toBeInstanceOf(BudgetExceededError)
    await expect(createSubtask(context)('do work')).rejects.toThrow('child budget exceeded')
    expect(context.steps).toHaveLength(0)
  })
})
