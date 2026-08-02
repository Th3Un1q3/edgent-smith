import { describe, it, expect, vi, beforeEach } from 'vitest'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/logger')

import { log } from '@plugins/helpers/logger'

import { SessionStorage } from '@plugins/helpers/kv-store'

import { sessionTracker } from '@plugins/session-tracker'

import type { PluginInput } from '@opencode-ai/plugin'

const _mockUpdateState = new SessionStorage().updateState
interface SessionTrackerPlugin {
  'chat.message'?: (input: { sessionID?: string, agent?: string }) => Promise<void>
  'event'?: (input: unknown) => Promise<void>
  'tool.execute.before': (input: { sessionID?: string, tool?: string }) => Promise<void>
  'dispose'?: () => Promise<void>
}

const mkPlugin = async (): Promise<SessionTrackerPlugin> =>
  (await sessionTracker({ client: opencodeClientFactory() } as unknown as PluginInput)) as SessionTrackerPlugin

const getState = (sessionID: string) => new SessionStorage().readState(sessionID, s => s)

describe('sessionTracker', () => {
  let plugin: SessionTrackerPlugin
  beforeEach(async () => {
    resetMockState()
    plugin = await mkPlugin()
  })

  it('initializes with log message and all hooks', () => {
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'session-tracker initialized', 'session-tracker')
    expect(plugin).toMatchObject({ 'chat.message': expect.any(Function), 'tool.execute.before': expect.any(Function), 'event': expect.any(Function), 'dispose': expect.any(Function) })
  })
  it('chat.message persists state and preserves startedAt', async () => {
    await plugin['chat.message']?.({ sessionID: 'ses_A', agent: 'build' })
    await plugin['chat.message']?.({ sessionID: 'ses_A', agent: 'deploy' })
    expect(getState('ses_A')).toMatchObject({ startedAt: expect.any(String), agent: 'deploy', lastMessageSentAt: expect.any(String) })
    resetMockState({ ses_B: { startedAt: '2026-01-01T00:00:00Z', agent: 'old' } })
    await plugin['chat.message']?.({ sessionID: 'ses_B', agent: 'deploy' })
    expect(getState('ses_B')).toMatchObject({ startedAt: '2026-01-01T00:00:00Z', agent: 'deploy', lastMessageSentAt: expect.any(String) })
  })
  it.each([
    { name: 'missing sessionID', input: { sessionID: undefined, agent: 'build' } },
    { name: 'missing agent', input: { sessionID: 'ses_na', agent: undefined } },
    { name: 'empty sessionID', input: { sessionID: '', agent: 'build' } },
    { name: 'empty agent', input: { sessionID: 'ses_ea', agent: '' } },
  ])('chat.message skips state update when $name', async ({ input }) => {
    await plugin['chat.message']?.(input)
    expect(_mockUpdateState).not.toHaveBeenCalled()
  })
  it('tool.execute.before accumulates tool calls with timestamps', async () => {
    resetMockState({ ses_tools: { toolCalls: { edit: '2024-01-01T00:00:00Z' } } })
    await plugin['tool.execute.before']({ sessionID: 'ses_tools', tool: 'read' })
    await plugin['tool.execute.before']({ sessionID: 'ses_tools', tool: 'write' })
    await plugin['tool.execute.before']({ sessionID: 'ses_tools', tool: 'question' })
    expect(getState('ses_tools')).toMatchObject({ toolCalls: { edit: '2024-01-01T00:00:00Z', read: expect.any(String), write: expect.any(String), question: expect.any(String) } })
  })
  it.each([
    { name: 'missing sessionID', input: { tool: 'read' }, expected: 0 },
    { name: 'undefined tool name', input: { sessionID: 'ses_ut', tool: undefined }, expected: 1 },
  ])('tool.execute.before $name', async ({ input, expected }) => {
    await plugin['tool.execute.before'](input)
    expect(_mockUpdateState).toHaveBeenCalledTimes(expected)
  })
  it.each([
    { name: 'non-aborted error', event: { type: 'session.error', properties: { sessionID: 'ses_na', error: { name: 'TimeoutError' } } } },
    { name: 'missing error object', event: { type: 'session.error', properties: { sessionID: 'ses_me', error: undefined } } },
    { name: 'missing sessionID', event: { type: 'session.error', properties: { error: { name: 'MessageAbortedError' } } } },
    { name: 'idle without sessionID', event: { type: 'session.idle', properties: {} } },
    { name: 'unknown event type', event: { type: 'some.other.event', properties: { sessionID: 'ses_unk' } } },
  ])('event ignores $name', async ({ event }) => {
    await plugin['event']?.({ event })
    expect(_mockUpdateState).not.toHaveBeenCalled()
  })
  it('event throws when properties are undefined', async () => {
    await expect(plugin['event']?.({ event: { type: 'session.error' } })).rejects.toThrow(/is not an object/)
  })
  it('persists full lifecycle state to storage', async () => {
    await plugin['chat.message']?.({ sessionID: 'ses_full', agent: 'build' })
    await plugin['tool.execute.before']({ sessionID: 'ses_full', tool: 'read' })
    await plugin['event']?.({ event: { type: 'session.idle', properties: { sessionID: 'ses_full' } } })
    await plugin['event']?.({ event: { type: 'session.error', properties: { sessionID: 'ses_full', error: { name: 'MessageAbortedError' } } } })
    await plugin.dispose?.()
    expect(getState('ses_full')).toMatchObject({ startedAt: expect.any(String), agent: 'build', toolCalls: { read: expect.any(String) }, idleAt: expect.any(String), cancelledAt: expect.any(String) })
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'session-tracker disposed', 'session-tracker')
  })
})
