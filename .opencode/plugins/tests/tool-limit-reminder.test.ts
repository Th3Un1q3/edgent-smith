import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

// Synchronous mock factories — no dynamic imports to avoid circular dependency issues.
import { defaultCreateClient, makeLoggerMockFactory, makeSessionHelpersMockFactory } from '@tests/helpers/mock-utilities'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

vi.mock('@plugins/helpers/logger', () => makeLoggerMockFactory())
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/session-helpers', () => makeSessionHelpersMockFactory())

import { toolLimitReminder } from '@plugins/tool-limit-reminder'

import { log } from '@plugins/helpers/logger'

import { sendMessage } from '@plugins/helpers/session-helpers'

import { SessionStorage } from '@plugins/helpers/kv-store'

const logMock = vi.mocked(log)

const sendMessageMock = vi.mocked(sendMessage)

// ── Types ────────────────────────────────────────────────────────
// Looser than the SDK Hooks type: runtime handlers accept optional fields
// (e.g. missing sessionID) that the SDK types require.

interface ChatPart {
  id: string
  sessionID: string
  messageID: string
  type: string
  text: string
  synthetic?: boolean
}

interface ChatMessageOutput {
  message: { role: string, content: string }
  parts: ChatPart[]
}

interface ToolLimitReminderHooks {
  'tool.execute.before': (input: { sessionID?: string, tool?: string }) => void | Promise<void>
  'chat.message': (input: { sessionID?: string, agent?: string, messageID?: string }, output: ChatMessageOutput) => void | Promise<void>
  'event': (input: { event: { type: string, properties?: Record<string, unknown> } }) => Promise<void>
  'dispose': () => Promise<void>
}

// ClientMock's nested `client` type omits `app`, but the runtime object includes
// it — that nested shape is what the plugin receives as PluginInput.client.
type TestClient = ClientMock & { client: { app: { agents: ReturnType<typeof vi.fn> } } }

interface PluginFixture {
  hooks: ToolLimitReminderHooks
  client: TestClient
}

// ── Helpers ──────────────────────────────────────────────────────

/** Builds a plugin; the file's only casts live here so test bodies stay cast-free. */
const makePlugin = async (options: {
  agent?: string
  agents?: Array<{ name: string, steps?: number }>
  agentsMock?: ReturnType<typeof vi.fn>
  client?: TestClient | ClientMock
} = {}): Promise<PluginFixture> => {
  const client = (options.client ?? defaultCreateClient({ agent: options.agent }, undefined, options.agents)) as TestClient
  if (options.agentsMock) client.client.app.agents = options.agentsMock

  const hooks = (await toolLimitReminder(client as unknown as PluginInput)) as unknown as ToolLimitReminderHooks
  return { hooks, client }
}

const makeChatOutput = (parts: ChatPart[]): ChatMessageOutput => ({
  message: { role: 'user', content: 'prompt' },
  parts,
})

const getState = (sessionID: string): Record<string, unknown> =>
  new SessionStorage().readState(sessionID, s => s as Record<string, unknown>) ?? {}

const BUDGET_AGENTS = [{ name: 'test-agent', steps: 15 }]

const AGENTS = [
  { agent: 'rug-swe', limit: 20 }, // floor(25 * 0.8)
  { agent: 'rug-mcp', limit: 8 }, // floor(10 * 0.8)
  { agent: 'rug-expert', limit: 15 }, // floor(19 * 0.8)
]

describe('toolLimitReminder', () => {
  let fixture: PluginFixture

  beforeEach(async () => {
    resetMockState({})
    fixture = await makePlugin({ agent: 'rug-swe' })
  })

  it('logs the init message on plugin creation', () => {
    expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', 'init', 'tool-limit-reminder')
  })

  it('warns and returns when sessionID is missing', async () => {
    await fixture.hooks['tool.execute.before']({})
    expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'warn', expect.stringContaining('missing sessionID'), 'tool-limit-reminder')
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  describe('tool.execute.before', () => {
    it.each([
      { name: 'the agent is absent from the list', agent: 'build', agents: undefined },
      { name: 'the agent has no maxSteps', agent: 'unlimited-agent', agents: [{ name: 'unlimited-agent' }] },
      { name: 'the agent list is empty', agent: 'rug-swe', agents: [] },
    ])('skips the limit check when $name', async ({ agent, agents }) => {
      fixture = await makePlugin({ agent, agents })
      await fixture.hooks['tool.execute.before']({ sessionID: 'skip-sess' })
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('not listed in TOOL_LIMITS'), 'tool-limit-reminder')
      expect(sendMessageMock).not.toHaveBeenCalled()
    })

    it('logs the session agent, count, and threshold for limited agents', async () => {
      await fixture.hooks['tool.execute.before']({ sessionID: 'info-sess' })
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('sessionID: info-sess, agent: rug-swe'), 'tool-limit-reminder')
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'warn', expect.stringContaining('reached tool call limit of 20'), 'tool-limit-reminder')
    })

    describe.each(AGENTS)('known agent $agent (limit $limit)', ({ agent, limit }) => {
      beforeEach(async () => {
        fixture = await makePlugin({ agent })
      })

      it('sends reminder steering at the exact threshold', async () => {
        for (let index = 0; index <= limit; index++) {
          await fixture.hooks['tool.execute.before']({ sessionID: 'sess-boundary' })
        }
        expect(sendMessageMock).toHaveBeenCalledTimes(1)
        expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
          sessionId: 'sess-boundary',
          noReply: true,
          message: expect.stringContaining('tool call limit reached'),
        }))
        expect(logMock).not.toHaveBeenCalledWith(expect.anything(), 'info', expect.stringContaining('flagging session'), 'tool-limit-reminder')
      })

      it('flags the session for review above the threshold', async () => {
        for (let index = 0; index <= limit + 1; index++) {
          await fixture.hooks['tool.execute.before']({ sessionID: 'sess-boundary' })
        }
        expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('flagging session'), 'tool-limit-reminder')
        expect(sendMessageMock).toHaveBeenLastCalledWith(expect.objectContaining({
          message: expect.stringContaining('tool call limit exceeded'),
        }))
        expect(getState('sess-boundary')?.needsReview).toBe(true)
      })

      it('throws after calls exceed limit plus padding', async () => {
        // limit + 3 calls resolve; the next call (currentCount = limit + 3)
        // exceeds limit + PADDING_TILL_ERROR(2) and is blocked.
        for (let index = 0; index < limit + 3; index++) {
          await expect(fixture.hooks['tool.execute.before']({ sessionID: 'sess-boundary' })).resolves.toBeUndefined()
        }

        await expect(fixture.hooks['tool.execute.before']({ sessionID: 'sess-boundary' })).rejects.toThrow('STOP YOUR WORK.')
        expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'error', expect.stringContaining('tool call limit exceeded'), 'tool-limit-reminder')
      })
    })

    it.each([
      { maxSteps: 25, expectedLimit: 20 }, // floor(20) — integer result
      { maxSteps: 13, expectedLimit: 10 }, // floor(10.4) — kills ceil mutants
    ])('uses floor(maxSteps * 0.8) = $expectedLimit as the dynamic limit', async ({ maxSteps, expectedLimit }) => {
      fixture = await makePlugin({ agent: 'dyn-agent', agents: [{ name: 'dyn-agent', steps: maxSteps }] })
      for (let index = 0; index <= expectedLimit; index++) {
        await fixture.hooks['tool.execute.before']({ sessionID: 'dyn-sess' })
      }
      expect(sendMessageMock).toHaveBeenCalledTimes(1)
      expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'dyn-sess',
        message: expect.stringContaining('tool call limit reached'),
      }))
    })

    it('applies dynamic limits only to agents with maxSteps', async () => {
      fixture = await makePlugin({
        agent: 'limited-agent',
        agents: [
          { name: 'limited-agent', steps: 30 },
          { name: 'unlimited-agent' },
        ],
      })
      await fixture.hooks['tool.execute.before']({ sessionID: 'mixed-sess' })
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('agent: limited-agent'), 'tool-limit-reminder')
      expect(logMock).not.toHaveBeenCalledWith(expect.anything(), 'info', expect.stringContaining('not listed in TOOL_LIMITS'), 'tool-limit-reminder')
    })

    it('fetches the agent list only once and reuses the cached limits', async () => {
      const hook = fixture.hooks['tool.execute.before']

      await hook({ sessionID: 'cache-1' })
      await hook({ sessionID: 'cache-2' })
      await hook({ sessionID: 'cache-3' })
      expect(vi.mocked(fixture.client.client.app.agents)).toHaveBeenCalledTimes(1)
    })

    it('logs the fetched agent list with exact prefix and mapped shape', async () => {
      fixture = await makePlugin({ agent: 'shape-agent', agents: [{ name: 'shape-agent', steps: 12 }] })
      await fixture.hooks['tool.execute.before']({ sessionID: 'shape-sess' })
      expect(logMock).toHaveBeenCalledWith(
        expect.any(Object),
        'info',
        expect.stringContaining('fetched agent list: [{"name":"shape-agent","maxSteps":12}]'),
        'tool-limit-reminder',
      )
    })

    it('handles an agents() response without a data property', async () => {
      fixture = await makePlugin({ agentsMock: vi.fn().mockResolvedValue({}) })

      await expect(fixture.hooks['tool.execute.before']({ sessionID: 'no-data-sess' })).resolves.toBeUndefined()
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('not listed in TOOL_LIMITS'), 'tool-limit-reminder')
    })

    it('treats an agents() failure as an empty list', async () => {
      fixture = await makePlugin({ agentsMock: vi.fn().mockRejectedValue(new Error('agents down')) })

      await expect(fixture.hooks['tool.execute.before']({ sessionID: 'agents-fail-sess' })).resolves.toBeUndefined()
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('not listed in TOOL_LIMITS'), 'tool-limit-reminder')
    })
  })

  describe('chat.message', () => {
    beforeEach(async () => {
      fixture = await makePlugin({ agents: BUDGET_AGENTS })
    })

    it('prepends the budget tag to the first text part', async () => {
      const output = makeChatOutput([
        { id: 'p1', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'first' },
        { id: 'p2', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'second' },
      ])

      await fixture.hooks['chat.message']({ sessionID: 'budget-sess', agent: 'test-agent' }, output)
      expect(output.parts[0].text).toBe('<task-budget tool-calls="15" />\nfirst')
      expect(output.parts[1].text).toBe('second')
    })

    it('creates a synthetic text part when no text part exists', async () => {
      const output = makeChatOutput([])

      await fixture.hooks['chat.message']({ sessionID: 'budget-sess', agent: 'test-agent' }, output)
      expect(output.parts).toHaveLength(1)
      expect(output.parts[0]).toMatchObject({
        id: 'task-budget',
        sessionID: 'budget-sess',
        messageID: '',
        type: 'text',
        text: '<task-budget tool-calls="15" />',
        synthetic: true,
      })
    })

    it('does not inject when the agent has no steps', async () => {
      fixture = await makePlugin({ agents: [{ name: 'no-steps-agent' }] })

      const output = makeChatOutput([{ id: 'p1', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'original prompt' }])

      await fixture.hooks['chat.message']({ sessionID: 'budget-sess', agent: 'no-steps-agent' }, output)
      expect(output.parts[0].text).toBe('original prompt')
    })

    it.each([
      { name: 'sessionID is missing', input: { agent: 'test-agent' } },
      { name: 'agent is missing', input: { sessionID: 'budget-sess' } },
    ])('does not inject when $name', async ({ input }) => {
      const output = makeChatOutput([{ id: 'p1', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'original prompt' }])

      await fixture.hooks['chat.message'](input, output)
      expect(output.parts[0].text).toBe('original prompt')
    })

    it('injects the tag only once per session', async () => {
      const input = { sessionID: 'budget-sess', agent: 'test-agent' }

      const output = makeChatOutput([{ id: 'p1', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'original prompt' }])

      await fixture.hooks['chat.message'](input, output)
      expect(output.parts[0].text).toBe('<task-budget tool-calls="15" />\noriginal prompt')
      await fixture.hooks['chat.message'](input, output)
      expect(output.parts[0].text).toBe('<task-budget tool-calls="15" />\noriginal prompt')
    })

    it('re-injects the tag after the session goes idle', async () => {
      const input = { sessionID: 'budget-sess', agent: 'test-agent' }

      const output = makeChatOutput([{ id: 'p1', sessionID: 'budget-sess', messageID: 'm1', type: 'text', text: 'original prompt' }])

      await fixture.hooks['chat.message'](input, output)
      await fixture.hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'budget-sess' } } })
      await fixture.hooks['chat.message'](input, output)
      expect(output.parts[0].text).toBe('<task-budget tool-calls="15" />\n<task-budget tool-calls="15" />\noriginal prompt')
    })
  })

  describe('event', () => {
    it.each([
      { name: 'non-session.idle events', event: { type: 'tool.execute.after' } },
      { name: 'session.idle events without a sessionID', event: { type: 'session.idle' } },
    ])('ignores $name', async ({ event }) => {
      await fixture.hooks.event({ event })
      expect(logMock).not.toHaveBeenCalledWith(expect.anything(), 'info', expect.stringContaining('cleared tool call counter'), 'tool-limit-reminder')
    })

    it('resets the tool call counter when the session goes idle', async () => {
      fixture = await makePlugin({ agent: 'rug-mcp' }) // limit = floor(10 * 0.8) = 8

      const hook = fixture.hooks['tool.execute.before']
      for (let index = 0; index <= 8; index++) {
        await hook({ sessionID: 'idle-sess' })
      }
      expect(sendMessageMock).toHaveBeenCalledTimes(1) // steering fired at the exact threshold

      await fixture.hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'idle-sess' } } })
      expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('cleared tool call counter'), 'tool-limit-reminder')

      await hook({ sessionID: 'idle-sess' })
      expect(sendMessageMock).toHaveBeenCalledTimes(1) // counter was cleared — no new steering
    })

    it('does not export sessions without the review flag', async () => {
      const client = defaultCreateClient({ agent: 'rug-swe' })

      const shell = vi.fn()

      client.$ = shell
      fixture = await makePlugin({ client })
      await fixture.hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'plain-sess' } } })
      expect(shell).not.toHaveBeenCalled()
    })

    it('exports flagged sessions and clears the review flag', async () => {
      resetMockState({ 'flagged-sess': { needsReview: true } })

      const client = defaultCreateClient({ agent: 'rug-swe' })

      const shell = vi.fn().mockReturnValue({
        nothrow: () => ({ quiet: () => ({ json: vi.fn().mockResolvedValue({ status: 'ok' }) }) }),
      })

      client.$ = shell
      fixture = await makePlugin({ client })

      await fixture.hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'flagged-sess' } } })

      expect(shell).toHaveBeenCalledWith(['just agent_utils/export-opencode-session ', ''], 'flagged-sess')
      await vi.waitFor(() => expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('export completed'), 'tool-limit-reminder'))
      expect(getState('flagged-sess')?.needsReview).toBeUndefined()
    })

    it('logs an error when the export fails', async () => {
      resetMockState({ 'failed-sess': { needsReview: true } })

      const client = defaultCreateClient({ agent: 'rug-swe' })

      const shell = vi.fn().mockReturnValue({
        nothrow: () => ({ quiet: () => ({ json: vi.fn().mockRejectedValue(new Error('export boom')) }) }),
      })

      client.$ = shell
      fixture = await makePlugin({ client })
      await fixture.hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'failed-sess' } } })
      await vi.waitFor(() => expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'error', expect.stringContaining('failed to trigger export'), 'tool-limit-reminder'))
    })
  })

  it('logs the dispose message on shutdown', async () => {
    await fixture.hooks.dispose()
    expect(logMock).toHaveBeenCalledWith(expect.any(Object), 'info', 'dispose', 'tool-limit-reminder')
  })
})
