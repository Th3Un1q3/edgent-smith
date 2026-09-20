import { describe, expect, it, vi } from 'vitest'

import { createSubtask } from '@plugins/helpers/workflow-subtask'
import type { WorkflowContext } from '@plugins/helpers/workflow-types'

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
  onProgress: vi.fn(),
  ...partial,
})

// ── createSubtask: progress reporting ────────────────────────────

describe('createSubtask progress reporting', () => {
  it('emits a start event before the child session is created and a finish event after settling', async () => {
    const order: string[] = []
    const create = vi.fn(async () => {
      order.push('create')
      return { data: { id: 'ses_child' } }
    })
    const onProgress = vi.fn((progress: { title: string, metadata?: Record<string, unknown> }) => {
      order.push(String(progress.metadata?.event))
    })
    const context = makeContext(createClient({ create }), { onProgress })

    const result = await createSubtask(context)({ prompt: 'do work', description: 'run work' })

    expect(result.status).toBe('ok')
    expect(order).toEqual(['start', 'create', 'finish'])
    expect(onProgress).toHaveBeenNthCalledWith(1, { title: 'run work', metadata: { event: 'start' } })
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      title: 'run work',
      metadata: {
        event: 'finish',
        status: 'ok',
        task_id: 'ses_child',
        durationMs: expect.any(Number),
      },
    })
  })
})
