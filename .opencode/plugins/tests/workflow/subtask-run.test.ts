import { describe, expect, it, vi } from 'vitest'

import { createSubtask } from '@plugins/workflow/subtask'
import { DEFAULT_MAX_SUBTASKS, DEFAULT_SUBTASK_AGENT } from '@plugins/workflow/contracts'
import type { SubtaskInput, SubtaskResult } from '@plugins/workflow/contracts'

const createClient = (overrides: Record<string, unknown> = {}): any => ({
  session: {
    create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
    ...(overrides as object),
  },
})

// Mirrors the context the subtask_run registration builds.
const runSubtask = (client: ReturnType<typeof createClient>, input: SubtaskInput): Promise<SubtaskResult> =>
  createSubtask({
    client,
    parentSessionID: 'ses_parent',
    signal: new AbortController().signal,
    defaultAgent: DEFAULT_SUBTASK_AGENT,
    maxSubtasks: DEFAULT_MAX_SUBTASKS,
    budget: { used: 0 },
    steps: [],
    logs: [],
    active: new Set<AbortController>(),
  })(input)

describe('subtask_run inline seam', () => {
  it('runs a description+prompt pair and returns status/output', async () => {
    const client = createClient()

    const result = await runSubtask(client, { prompt: 'do work', description: 'do work' })

    expect(result.status).toBe('ok')
    expect(result.outputText).toBe('OUT')
    expect(result.task_id).toBe('ses_child')
    expect(client.session.create).toHaveBeenCalledTimes(1)
  })

  it('passes task_id through without creating a session', async () => {
    const client = createClient()

    const result = await runSubtask(client, { prompt: 'resume work', description: 'resume work', task_id: 'ses_existing' })

    expect(result.task_id).toBe('ses_existing')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ses_existing' } }),
    )
  })

  it('passes fork_from through and reports provenance', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork })

    const result = await runSubtask(client, { prompt: 'forked work', description: 'forked work', fork_from: 'ses_source' })

    expect(fork).toHaveBeenCalledWith({ sessionID: 'ses_source' })
    expect(result.task_id).toBe('ses_fork')
    expect(result.forked_from).toBe('ses_source')
  })

  it('returns an error result for invalid input instead of throwing', async () => {
    const client = createClient()

    const result = await runSubtask(client, { prompt: '', description: '' })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/prompt/i)
  })
})
