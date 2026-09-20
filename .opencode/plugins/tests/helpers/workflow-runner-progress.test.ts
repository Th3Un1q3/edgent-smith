import { describe, expect, it, vi } from 'vitest'

import { runWorkflow } from '@plugins/helpers/workflow-runner'
import type { RunWorkflowOptions } from '@plugins/helpers/workflow-runner'
import type { WorkflowEnvelope, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

const abortablePrompt = (): unknown =>
  vi.fn((input: { signal?: AbortSignal } = {}) =>
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

const makeClient = (overrides: Record<string, unknown> = {}): WorkflowSdkClient =>
  ({
    session: {
      create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
      prompt: vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
      abort: vi.fn(async () => true),
      ...overrides,
    },
  }) as unknown as WorkflowSdkClient

const options = (script: string, overrides: Partial<RunWorkflowOptions> = {}): RunWorkflowOptions => ({
  script,
  client: makeClient(),
  parentSessionID: 'ses_parent',
  timeoutMs: 1000,
  onProgress: undefined,
  ...overrides,
})

interface ProgressCall {
  title: string
  metadata?: Record<string, unknown>
}

const progressCalls = (mock: { mock: { calls: unknown[][] } }): ProgressCall[] =>
  mock.mock.calls.map(([progress]) => progress as ProgressCall)

const parse = (json: string): WorkflowEnvelope => JSON.parse(json) as WorkflowEnvelope

describe('runWorkflow progress reporting', () => {
  it('emits start and finish progress events for each subtask', async () => {
    const onProgress = vi.fn()
    const script = [
      'await subtask({ prompt: "a", description: "first" })',
      'await subtask({ prompt: "b", description: "second" })',
      'return "done"',
    ].join('\n')

    const envelope = parse(await runWorkflow(options(script, { onProgress })))

    expect(envelope.status).toBe('ok')
    const calls = progressCalls(onProgress)
    expect(calls.map(call => call.metadata?.event)).toEqual(['start', 'finish', 'start', 'finish'])
    expect(calls.map(call => call.title)).toEqual(['first', 'first', 'second', 'second'])

    const finishes = calls.filter(call => call.metadata?.event === 'finish')
    expect(finishes).toHaveLength(2)
    for (const finish of finishes) {
      expect(finish.metadata).toMatchObject({ event: 'finish', status: 'ok', task_id: 'ses_child' })
      expect(typeof finish.metadata?.durationMs).toBe('number')
    }
  })

  it('keeps a run successful when onProgress throws', async () => {
    const onProgress = (): void => {
      throw new Error('boom')
    }

    const envelope = parse(await runWorkflow(options('return await subtask("x")', { onProgress })))

    expect(envelope.status).toBe('ok')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0]).toMatchObject({ status: 'ok', task_id: 'ses_child' })
  })

  it('keeps a run successful when an explicit progress call throws', async () => {
    const onProgress = (): void => {
      throw new Error('boom')
    }

    const envelope = parse(await runWorkflow(options('progress({ title: "x" }); return "done"', { onProgress })))

    expect(envelope.status).toBe('ok')
    expect(envelope.result).toBe('done')
    expect(envelope.logs.some(entry => entry.includes('progress callback threw'))).toBe(true)
  })

  it('emits a finish progress event carrying the failing status', async () => {
    const onProgress = vi.fn()
    const prompt = vi.fn(async () => ({ data: { info: { error: 'boom' }, parts: [] } }))
    const client = makeClient({ prompt })
    const script = 'await subtask({ prompt: "x", description: "work" }); return "done"'

    const envelope = parse(await runWorkflow(options(script, { client, onProgress })))

    expect(envelope.status).toBe('ok')
    const finishes = progressCalls(onProgress).filter(call => call.metadata?.event === 'finish')
    expect(finishes).toHaveLength(1)
    expect(finishes[0].metadata).toMatchObject({ event: 'finish', status: 'error', task_id: 'ses_child' })
  })

  it('aborts the run when the external signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const client = makeClient({ prompt: abortablePrompt() })
    const pending = runWorkflow(options('return await subtask("x")', {
      client,
      timeoutMs: 5000,
      abort: controller.signal,
    }))

    await new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
    controller.abort()

    const envelope = parse(await pending)

    expect(envelope.status).toBe('aborted')
    expect(envelope.error?.toLowerCase()).toContain('abort')
  }, 1000)
})
