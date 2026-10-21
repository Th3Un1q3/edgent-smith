import { describe, expect, it, vi } from 'vitest'

import { runStandaloneSubtask } from '@plugins/helpers/subtask-run'

const createClient = (overrides: Record<string, unknown> = {}): any => ({
  session: {
    create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
    ...(overrides as object),
  },
})

describe('subtask_run standalone helper', () => {
  it('runs a description+prompt pair and returns status/output', async () => {
    const client = createClient()

    const result = await runStandaloneSubtask(
      { client, parentSessionID: 'ses_parent' },
      { prompt: 'do work', description: 'do work' },
    )

    expect(result.status).toBe('ok')
    expect(result.outputText).toBe('OUT')
    expect(result.task_id).toBe('ses_child')
    expect(client.session.create).toHaveBeenCalledTimes(1)
  })

  it('passes task_id through without creating a session', async () => {
    const client = createClient()

    const result = await runStandaloneSubtask(
      { client, parentSessionID: 'ses_parent' },
      { prompt: 'resume work', description: 'resume work', task_id: 'ses_existing' },
    )

    expect(result.task_id).toBe('ses_existing')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ses_existing' } }),
    )
  })

  it('passes fork_from through and reports provenance', async () => {
    const fork = vi.fn(async () => ({ data: { id: 'ses_fork' } }))
    const client = createClient({ fork })

    const result = await runStandaloneSubtask(
      { client, parentSessionID: 'ses_parent' },
      { prompt: 'forked work', description: 'forked work', fork_from: 'ses_source' },
    )

    expect(fork).toHaveBeenCalledWith({ path: { id: 'ses_source' } })
    expect(result.task_id).toBe('ses_fork')
    expect(result.forked_from).toBe('ses_source')
  })

  it('returns an error result for invalid input instead of throwing', async () => {
    const client = createClient()

    const result = await runStandaloneSubtask(
      { client, parentSessionID: 'ses_parent' },
      { prompt: '', description: '' },
    )

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/prompt/i)
  })
})
