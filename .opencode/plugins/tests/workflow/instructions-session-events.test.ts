import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Effect, Fiber } from 'effect'

import { entryClient } from '@tests/workflow/plugin-state'

import { collectLogger, emitSessionEvent, makeHarness, register, resetWorkflowMocks } from '@tests/workflow/harness'

import plugin, { isWorkflowSessionEvent, WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

beforeEach(resetWorkflowMocks)

describe('workflow instruction session events', () => {
  it('writes the entry when a session.created payload names a listed agent', async () => {
    await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_created', agent: 'rug-swe' } })

    expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_created', 'workflow.instructions', 'BLOCK-BODY')
  })

  it('removes the entry for an unlisted agent', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'removed' })

    await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_unlisted', agent: 'build' } })

    expect(entryClient.removeEntry).toHaveBeenCalledWith('ses_unlisted', 'workflow.instructions')
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('logs the removed status when the entry was present', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'removed' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_removed', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_removed', status: 'removed' }),
    ])
  })

  it('logs the absent status without an error when there is no entry to remove', async () => {
    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_absent', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_absent', status: 'absent' }),
    ])
    expect(logs).not.toContainEqual(['workflow.instructions.error', expect.anything()])
  })

  it('logs one skip line when the payload carries no agent', async () => {
    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_no_agent' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_no_agent', agent: 'unknown' }),
    ])
  })

  it('writes the entry when session.agent.selected names a listed agent', async () => {
    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_selected', agent: 'rug' } })

    expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_selected', 'workflow.instructions', 'BLOCK-BODY')
    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_selected', status: 'written' }),
    ])
  })

  it('logs the unchanged status when the entry value is already current', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'unchanged' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_unchanged', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_unchanged', status: 'unchanged' }),
    ])
  })

  it('writes the entry once per subscribed event and ignores other event types', async () => {
    const h = makeHarness([
      { type: 'session.created', data: { sessionID: 'ses_stream_created', agent: 'rug-swe' } },
      { type: 'session.agent.selected', data: { sessionID: 'ses_stream_selected', agent: 'rug' } },
      { type: 'session.idle', data: { sessionID: 'ses_stream_idle', agent: 'rug-swe' } },
    ])

    const log = collectLogger(h.logs)
    const subscribed = Effect.scoped(Effect.flatMap(plugin.effect(h.context), () => Effect.never))

    const fiber = Effect.runFork(Effect.withLogger(log)(subscribed))

    try {
      await vi.waitFor(() => {
        expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_stream_created', 'workflow.instructions', expect.stringContaining(WORKFLOW_INSTRUCTIONS_SENTINEL))
        expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_stream_selected', 'workflow.instructions', expect.stringContaining(WORKFLOW_INSTRUCTIONS_SENTINEL))
      })
    }
    finally {
      await Effect.runPromise(Fiber.interrupt(fiber))
    }

    expect(entryClient.writeEntry).toHaveBeenCalledTimes(2)
    expect(entryClient.writeEntry).not.toHaveBeenCalledWith('ses_stream_idle', expect.anything(), expect.anything())
  })

  it('reports a failed write status as an error', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'failed', error: 'put failed' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_put_error', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_put_error', status: 'failed' }),
    ])
    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('put failed') }),
    ])
  })

  it('reports a failed removal status as an error', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'failed', error: 'remove failed' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_remove_error', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_remove_error', status: 'failed' }),
    ])
    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('remove failed') }),
    ])
  })

  it('names the remove action when the removal fails', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'failed', reason: 'entry missing' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_action_remove', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: 'workflow instructions: remove failed: entry missing' }),
    ])
  })

  it('names the write action when the write fails', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'failed', reason: 'entry refused' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_action_write', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: 'workflow instructions: write failed: entry refused' }),
    ])
  })

  it('reports a rejected write as an error instead of swallowing it', async () => {
    entryClient.writeEntry.mockRejectedValue(new Error('write exploded'))

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_write_reject', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('write exploded') }),
    ])
  })

  it('logs an error when the handler throws', async () => {
    const agentAllowlist = {
      has: () => {
        throw new Error('allowlist exploded')
      },
    } as unknown as ReadonlySet<string>

    const logs = await emitSessionEvent(
      { type: 'session.created', data: { sessionID: 'ses_throw', agent: 'rug-swe' } },
      { agentAllowlist, block: 'BLOCK-BODY' },
    )

    expect(logs).toContainEqual(['workflow.instructions.error', expect.objectContaining({ message: 'allowlist exploded' })])
  })

  it('subscribes to session.created and session.agent.selected', async () => {
    const h = makeHarness()

    await register(h)

    expect(h.subscriptions).toBe(2)
    expect(isWorkflowSessionEvent({ type: 'session.created' }, 'session.created')).toBe(true)
    expect(isWorkflowSessionEvent({ type: 'session.agent.selected' }, 'session.agent.selected')).toBe(true)
    expect(isWorkflowSessionEvent({ type: 'session.idle' }, 'session.created')).toBe(false)
  })
})
