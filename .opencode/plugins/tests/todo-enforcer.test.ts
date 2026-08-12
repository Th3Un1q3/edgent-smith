import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState, mockState } from '@tests/__utils/kv-store.mock'

import { pluginContextBuilder } from '@tests/__utils/plugin-builder'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

// vi.mock factories come from __utils, avoiding circular dependency with mocked modules
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/logger')
vi.mock('@plugins/helpers/session-helpers')

import { log } from '@plugins/helpers/logger'

import { SessionStorage, SESSION_FIELDS } from '@plugins/helpers/kv-store'

import { sendMessage } from '@plugins/helpers/session-helpers'

import { todoEnforcer } from '@plugins/todo-enforcer'

import { harnessConfig } from '@plugins/config/harness.config'

// Live-config read (mirrors skill-usage-tracker.test.ts) — keeps the threshold in
// sync with what the plugin reads from harness.config.ts.
const TODO_FOLLOWUP_MAX_ERRORS = harnessConfig.plugins['todo-enforcer'].maxConsecutiveErrors

type Todo = { content: string, status: string, priority: string, id: string }

interface TodoEnforcerPlugin {
  'tool.execute.before': (
    input: { sessionID?: string, tool: string },
    output?: { args?: Record<string, unknown> },
  ) => Promise<void>
  'event': (input: { event: { type: string, properties?: Record<string, unknown> } }) => Promise<void>
  'dispose': () => Promise<void>
  'chat.message'?: (
    input: { sessionID?: string, agent?: string },
    output?: { message?: { role?: string, time?: { created?: number } }, parts?: unknown[] },
  ) => Promise<void>
}

const idleEvent = { event: { type: 'session.idle' as const, properties: { sessionID: 'test_session' } } }

const todoItem = { content: 'content of todo item', status: 'pending', priority: 'medium', id: '1' }

const activeState = { cancelledAt: '2026-01-01T00:00:00Z', lastMessageSentAt: '2026-01-01T01:00:00Z' }

// Breaker-recovery timing (epoch ms): BROKEN_AT = 2026-01-01T01:00:00.000Z = 1767229200000
const BROKEN_AT = '2026-01-01T01:00:00.000Z'
const POST = 1_767_229_260_000 // > brokenAt
const PRE = 1_767_229_140_000 // < brokenAt
const AT = 1_767_229_200_000 // == brokenAt (strict > comparison must NOT recover)

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

    const errorEvent = (errorName: string) => ({ event: { type: 'session.error' as const, properties: { sessionID: 'test_session', error: { name: errorName } } } })
    const getState = (sessionID: string) => new SessionStorage().readState(sessionID, s => s)

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
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing follow-up error state.', expect.any(String))
      vi.advanceTimersByTime(1001)
      expect(sendMessage).not.toHaveBeenCalled()
    })

    describe('when session.todo returns null data', () => {
      beforeEach(() => client.session.todo.mockResolvedValue({ data: null }))
      it('falls back to empty todos and skips the follow-up', async () => {
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing follow-up error state.', expect.any(String))
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

    describe('loop breaking', () => {
      it('increments error count on non-cancellation session.error', async () => {
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(1)
      })

      it('does not increment on MessageAbortedError', async () => {
        await plugin.event(errorEvent('MessageAbortedError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBeUndefined()
      })

      it('does not increment when sessionID is missing', async () => {
        await plugin.event({ event: { type: 'session.error' as const, properties: { error: { name: 'TimeoutError' } } } })
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBeUndefined()
      })

      it('still sends follow-up below threshold', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 1 } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).toHaveBeenCalled()
      })

      it('skips follow-up at threshold', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('skipping followup'), 'todo-enforcer')
      })

      it('logs breaking message exactly at threshold crossing', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 2 } })
        await plugin.event(errorEvent('TimeoutError'))
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'error', expect.stringContaining('Breaking todo follow-up loop'), 'todo-enforcer')
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)
      })

      it('accumulates error count across repeated errors', async () => {
        await plugin.event(errorEvent('TimeoutError'))
        await plugin.event(errorEvent('TimeoutError'))
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)
      })

      it('resets count to 0 on no remaining todos when count > 0', async () => {
        await makePlugin('rug', [])
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 2 } })
        await plugin.event(idleEvent)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(0)
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing follow-up error state.', 'todo-enforcer')
      })

      it('does not write state when no error count exists', async () => {
        await makePlugin('rug', [])
        await plugin.event(idleEvent)
        expect(mockState.updateState).not.toHaveBeenCalled()
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing follow-up error state.', 'todo-enforcer')
      })

      it('break persists across repeated idle events', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)
      })

      it('does not increment or crash when session.error has no properties', async () => {
        await plugin.event({ event: { type: 'session.error' as const } })
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBeUndefined()
      })

      it('counts errors with missing error object as technical', async () => {
        await plugin.event({ event: { type: 'session.error' as const, properties: { sessionID: 'test_session', error: undefined } } })
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(1)
      })

      it('logs breaking message only once across threshold', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS - 1 } })
        await plugin.event(errorEvent('TimeoutError'))
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS + 1)

        const breakingLogCalls = vi.mocked(log).mock.calls.filter(call => call[1] === 'error' && String(call[2]).includes('Breaking todo follow-up loop'))

        expect(breakingLogCalls).toHaveLength(1)
      })
    })

    describe('breaker recovery', () => {
      const chatMessage = (sessionID: string, created?: number, hasOutput = true) =>
        plugin['chat.message']?.(
          { sessionID },
          hasOutput ? { message: { role: 'user', time: { created } }, parts: [] } : undefined,
        )

      it('trip sets brokenAt at threshold crossing', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 2 } })
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)

        const brokenAt = getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]

        expect(brokenAt).toBeDefined()
        expect(!Number.isNaN(new Date(brokenAt as string).getTime())).toBe(true)
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'error', expect.stringContaining('Breaking todo follow-up loop'), 'todo-enforcer')
      })

      it('does not set brokenAt below threshold', async () => {
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(1)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
      })

      it('backfill sets brokenAt at silent skip when missing', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()

        const brokenAt = getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]

        expect(brokenAt).toBeDefined()
        expect(!Number.isNaN(new Date(brokenAt as string).getTime())).toBe(true)
      })

      it('backfill does not overwrite existing brokenAt', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: BROKEN_AT } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBe(BROKEN_AT)
      })

      it('recovers on post-break message and resumes follow-up', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: BROKEN_AT } })
        await chatMessage('test_session', POST)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(0)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'Recovered todo follow-up loop for session test_session after message.', 'todo-enforcer')
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).toHaveBeenCalled()
      })

      it('does NOT recover on pre-break or boundary message', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: BROKEN_AT } })
        await chatMessage('test_session', PRE)
        await chatMessage('test_session', AT)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBe(BROKEN_AT)
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Recovered todo follow-up loop'), 'todo-enforcer')
        expect(mockState.updateState).not.toHaveBeenCalled()
      })

      it('no-op when no brokenAt', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 0 } })
        await chatMessage('test_session', POST)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(0)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Recovered todo follow-up loop'), 'todo-enforcer')
        expect(mockState.updateState).not.toHaveBeenCalled()
      })

      it('no-op when sessionID missing', async () => {
        await plugin['chat.message']?.({ agent: 'rug' }, { message: { role: 'user', time: { created: POST } }, parts: [] })
        expect(mockState.updateState).not.toHaveBeenCalled()
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Recovered todo follow-up loop'), 'todo-enforcer')
      })

      it('recovers via Date.now() fallback when time.created missing', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: BROKEN_AT } })
        vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
        await chatMessage('test_session', undefined)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(0)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'Recovered todo follow-up loop for session test_session after message.', 'todo-enforcer')
      })

      it('no-op on corrupt brokenAt', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: 'not-a-date' } })
        await chatMessage('test_session', POST)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBe('not-a-date')
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Recovered todo follow-up loop'), 'todo-enforcer')
      })

      it('no-todos reset clears brokenAt', async () => {
        await makePlugin('rug', [])
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 2, todoFollowupBrokenAt: BROKEN_AT } })
        await plugin.event(idleEvent)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(0)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]).toBeUndefined()
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'No remaining todos — clearing follow-up error state.', 'todo-enforcer')
      })

      it('re-trips after recovery', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: 0 } })
        await plugin.event(errorEvent('TimeoutError'))
        await plugin.event(errorEvent('TimeoutError'))
        await plugin.event(errorEvent('TimeoutError'))
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(TODO_FOLLOWUP_MAX_ERRORS)

        const brokenAt = getState('test_session')?.[SESSION_FIELDS.todoFollowupBrokenAt]

        expect(brokenAt).toBeDefined()
        expect(!Number.isNaN(new Date(brokenAt as string).getTime())).toBe(true)

        const breakingLogCalls = vi.mocked(log).mock.calls.filter(call => call[1] === 'error' && String(call[2]).includes('Breaking todo follow-up loop'))

        expect(breakingLogCalls).toHaveLength(1)
      })

      it('regression: silent skip while broken with no recovery message', async () => {
        resetMockState({ test_session: { ...activeState, todoFollowupErrorCount: TODO_FOLLOWUP_MAX_ERRORS, todoFollowupBrokenAt: BROKEN_AT } })
        await plugin.event(idleEvent)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('skipping followup'), 'todo-enforcer')
      })
    })

    describe('when sendMessage rejects', () => {
      beforeEach(() => {
        vi.mocked(sendMessage).mockRejectedValueOnce(new Error('api down'))
      })
      it('sendMessage rejection increments count and logs failure', async () => {
        await plugin.event(idleEvent)
        await vi.advanceTimersByTimeAsync(1001)
        expect(getState('test_session')?.[SESSION_FIELDS.todoFollowupErrorCount]).toBe(1)
        expect(log).toHaveBeenCalledWith(expect.any(Object), 'error', expect.stringContaining('Todo follow-up failed'), 'todo-enforcer')
      })
    })
  })

  describe('dispose', () => {
    it('logs dispose message on cleanup', async () => {
      await plugin.dispose()
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'disposed', expect.any(String))
    })
  })
})
