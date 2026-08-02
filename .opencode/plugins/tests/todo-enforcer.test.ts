import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

import { pluginContextBuilder } from '@tests/__utils/plugin-builder'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

// vi.mock factories come from __utils, avoiding circular dependency with mocked modules
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/logger')
vi.mock('@plugins/helpers/session-helpers')

import { log } from '@plugins/helpers/logger'

import { sendMessage } from '@plugins/helpers/session-helpers'

import { todoEnforcer } from '@plugins/todo-enforcer'

type Todo = { content: string, status: string, priority: string, id: string }

interface TodoEnforcerPlugin {
  'tool.execute.before': (
    input: { sessionID?: string, tool: string },
    output?: { args?: Record<string, unknown> },
  ) => Promise<void>
  'event': (input: { event: { type: string, properties: Record<string, string> } }) => Promise<void>
  'dispose': () => Promise<void>
}

const idleEvent = { event: { type: 'session.idle' as const, properties: { sessionID: 'test_session' } } }

const todoItem = { content: 'content of todo item', status: 'pending', priority: 'medium', id: '1' }

const activeState = { cancelledAt: '2026-01-01T00:00:00Z', lastMessageSentAt: '2026-01-01T01:00:00Z' }

describe('todoEnforcer', () => {
  let client: ReturnType<typeof opencodeClientFactory>
  let plugin: TodoEnforcerPlugin

  const makePlugin = async (agentName = 'rug', todoList: Todo[] = []): Promise<void> => {
    client = opencodeClientFactory({ agentName, todoList })
    plugin = (await todoEnforcer(pluginContextBuilder({ clientFactory: () => client as unknown as ClientMock }) as unknown as PluginInput)) as TodoEnforcerPlugin
  }

  beforeEach(async () => {
    resetMockState()
    await makePlugin()
  })

  it('logs init message with plugin ID and info level', async () => {
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'initialized', 'todo-enforcer')
  })

  describe('tool.execute.before', () => {
    it('blocks task tool for rug agent without recent todowrite', async () => {
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool: 'task' })).rejects.toThrow(/Error calling task\. All tools are suspended until `todowrite` is called/)
      // The enforcement log is emitted before the throw — asserting it kills mutants that reorder or drop it
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('enforcing todo requirement for task tool on session ses_test'), expect.any(String))
    })

    const sampleFields = [
      { field: 'content', value: '#plan express the plan in todos; assignee: @rug' },
      { field: 'status', value: 'pending' },
      { field: 'priority', value: 'high' },
      { field: 'id', value: '1' },
    ]

    it.each(sampleFields)('embeds $field in the sample todo inside the error', async ({ field, value }) => {
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool: 'task' })).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining(`"${field}":"${value}"`) }))
    })
    it('allows non-task tools regardless of agent or todo state', async () => {
      for (const tool of ['question', 'bash', 'write', 'edit']) {
        await expect(plugin['tool.execute.before']({ sessionID: `ses_${tool}`, tool })).resolves.toBeUndefined()
      }
    })
    it('passes todowrite through without enforcement or session reads', async () => {
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool: 'todowrite' })).resolves.toBeUndefined()
      // White-box killer for the `todowrite` string mutant: session.get is only reachable past the early return
      expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('enforcing'), expect.any(String))
      expect(client.session.get).not.toHaveBeenCalled()
    })
    it('skips enforcement when sessionID is missing', async () => {
      await expect(plugin['tool.execute.before']({ tool: 'task' })).resolves.toBeUndefined()
      await expect(plugin['tool.execute.before']({ tool: 'question' })).resolves.toBeUndefined()
    })
    it('bypasses enforcement and logs for command-driven task calls', async () => {
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool: 'task' }, { args: { command: 'some-command' } })).resolves.toBeUndefined()
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('skipping enforcement'), expect.any(String))
    })
    it('handles task calls without output args', async () => {
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool: 'task' }, {})).rejects.toThrow(/Error calling task/)
    })

    const blocksCases = [
      { name: 'blocks when todowrite before last message', state: { toolCalls: { todowrite: '2026-01-01T00:00:00Z' }, lastMessageSentAt: '2026-01-01T01:00:00Z' } },
      { name: 'blocks when todowrite equals last message (strict > boundary)', state: { toolCalls: { todowrite: '2026-01-01T01:00:00Z' }, lastMessageSentAt: '2026-01-01T01:00:00Z' } },
      { name: 'blocks when todowrite key missing from toolCalls', state: { toolCalls: { someOtherTool: '2026-01-01T02:00:00Z' }, lastMessageSentAt: '2026-01-01T01:00:00Z' } },
      { name: 'blocks when todowrite and lastMessageSentAt both absent', state: { toolCalls: { someOtherTool: '2026-01-01T02:00:00Z' } } },
    ]

    it.each(blocksCases)('$name', async ({ state }) => {
      resetMockState({ ses_has_todos_state: state })
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_has_todos_state', tool: 'task' })).rejects.toThrow(/Error calling task/)
    })

    const allowsCases = [
      { name: 'allows when todowrite is after last message', state: { toolCalls: { todowrite: '2026-01-01T02:00:00Z' }, lastMessageSentAt: '2026-01-01T01:00:00Z' } },
      { name: 'allows when todowrite exists but lastMessageSentAt is missing', state: { toolCalls: { todowrite: '2026-01-01T02:00:00Z' } } },
    ]

    it.each(allowsCases)('$name', async ({ state }) => {
      resetMockState({ ses_has_todos_state: state })
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_has_todos_state', tool: 'task' })).resolves.toBeUndefined()
    })

    const agentCases = [
      { agent: 'non-rug', tool: 'write' },
      { agent: 'non-rug', tool: 'task' },
      { agent: 'build', tool: 'task' },
      { agent: '', tool: 'task' },
    ]

    it.each(agentCases)('allows $tool for agent $agent without enforcement', async ({ agent, tool }) => {
      await makePlugin(agent)
      await expect(plugin['tool.execute.before']({ sessionID: 'ses_test', tool })).resolves.toBeUndefined()
    })
  })

  describe('event', () => {
    beforeEach(async () => {
      await makePlugin('rug', [todoItem])
      resetMockState({ test_session: activeState })
      vi.useFakeTimers()
    })
    afterEach(() => vi.useRealTimers())

    it('fetches todos and composes the steering follow-up message', async () => {
      await plugin.event(idleEvent)
      vi.advanceTimersByTime(1001)
      expect(client.session.todo).toHaveBeenCalledWith({ path: { id: 'test_session' } })
      // Single behavior: follow-up composition — the same sendMessage call carries client, session and payload
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ client: expect.any(Object), sessionId: 'test_session', message: expect.stringContaining('<steering priority="high" reason="incomplete todos remain" type="todo">') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('content of todo item') }))
    })

    const skipFollowUpStates = [
      { name: 'skips when cancelled after last message', state: { cancelledAt: '2026-01-01T01:00:00Z', lastMessageSentAt: '2026-01-01T00:00:00Z' } },
      { name: 'skips when cancelledAt equals lastMessageSentAt (strict < boundary)', state: { cancelledAt: '2026-01-01T01:00:00Z', lastMessageSentAt: '2026-01-01T01:00:00Z' } },
    ]

    it.each(skipFollowUpStates)('$name', async ({ state }) => {
      resetMockState({ test_session: state })
      await plugin.event(idleEvent)
      vi.advanceTimersByTime(1001)
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('skipping followup'), expect.any(String))
      expect(sendMessage).not.toHaveBeenCalled()
    })

    const followUpSends = [
      { name: 'sends follow-up when cancelledAt is missing', state: { lastMessageSentAt: '2026-01-01T01:00:00Z' } },
      { name: 'sends follow-up when lastMessageSentAt is missing', state: { cancelledAt: '2026-01-01T00:00:00Z' } },
    ]

    it.each(followUpSends)('$name', async ({ state }) => {
      resetMockState({ test_session: state })
      await plugin.event(idleEvent)
      vi.advanceTimersByTime(1001)
      expect(sendMessage).toHaveBeenCalled()
    })
    it('returns early when no remaining todos', async () => {
      await makePlugin('rug', [])
      await plugin.event(idleEvent)
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing cancellation state.', expect.any(String))
      vi.advanceTimersByTime(1001)
      expect(sendMessage).not.toHaveBeenCalled()
    })

    describe('when session.todo returns null data', () => {
      beforeEach(() => client.session.todo.mockResolvedValue({ data: null }))
      it('falls back to empty todos and skips the follow-up', async () => {
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing cancellation state.', expect.any(String))
        expect(sendMessage).not.toHaveBeenCalled()
      })
    })
    it('ignores events that are not idle or lack a sessionID', async () => {
      await plugin.event({ event: { type: 'session.started' as const, properties: { sessionID: 'test_session' } } })
      await plugin.event({ event: { type: 'session.idle' as const, properties: {} } })
      vi.advanceTimersByTime(1001)
      expect(sendMessage).not.toHaveBeenCalled()
    })
    it('filters out completed and cancelled todos', async () => {
      await makePlugin('rug', [
        { content: 'pending item', status: 'pending', priority: 'medium', id: '1' },
        { content: 'completed item', status: 'completed', priority: 'medium', id: '2' },
        { content: 'cancelled item', status: 'cancelled', priority: 'medium', id: '3' },
        { content: 'in progress item', status: 'in_progress', priority: 'medium', id: '4' },
      ])
      await plugin.event(idleEvent)
      vi.advanceTimersByTime(1001)
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('pending item') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('in progress item') }))
      expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('completed item') }))
      expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cancelled item') }))
    })
    it('composes the message with all status symbols and one line per todo', async () => {
      await makePlugin('rug', [
        { content: 'first todo', status: 'pending', priority: 'medium', id: '1' },
        { content: 'second todo', status: 'pending', priority: 'medium', id: '2' },
        { content: 'third todo', status: 'in_progress', priority: 'medium', id: '3' },
      ])
      await plugin.event(idleEvent)
      vi.advanceTimersByTime(1001)
      // Single behavior: message composition — every <reference> symbol plus one formatted line per todo
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('pending - [ ]') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('in-progress - [•]') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('completed - [✓]') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cancelled - [-]') }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/\[ \] first todo\n\[ \] second todo\n\[•\] third todo/) }))
    })
  })

  describe('dispose', () => {
    it('logs dispose message on cleanup', async () => {
      await plugin.dispose()
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'disposed', expect.any(String))
    })
  })
})
