import type { OpencodeClient } from '@opencode-ai/sdk'

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@plugins/helpers/logger')
vi.mock('@plugins/helpers/agent-steps')

import { log } from '@plugins/helpers/logger'

import { getSessionAgent } from '@plugins/helpers/agent-steps'

import { sendMessage } from '@plugins/helpers/session-helpers'

const makeMockClient = (sessionData?: Record<string, unknown>) => {
  const mockSessionGet = vi.fn().mockResolvedValue({ data: sessionData })

  const mockPrompt = vi.fn().mockResolvedValue({})
  return {
    client: {
      app: { log: vi.fn().mockResolvedValue(undefined) },
      session: { get: mockSessionGet, prompt: mockPrompt },
    } as unknown as OpencodeClient,
    mockSessionGet,
    mockPrompt,
  }
}

describe('sendMessage', () => {
  let defaultClient: OpencodeClient
  let defaultPrompt: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(getSessionAgent).mockResolvedValue('build')

    const { client, mockPrompt } = makeMockClient({})

    defaultClient = client
    defaultPrompt = mockPrompt
  })

  it('returns early when client.session is missing', async () => {
    const client = { app: { log: vi.fn() } } as unknown as OpencodeClient

    await sendMessage({ client, sessionId: 'ses_1', message: 'hi' })
    expect(log).toHaveBeenCalledWith(client, 'warn', expect.stringContaining('ses_1'))
    expect(defaultPrompt).not.toHaveBeenCalled()
  })

  it('returns early when session.get returns falsy', async () => {
    const { client, mockSessionGet, mockPrompt } = makeMockClient(undefined)

    mockSessionGet.mockResolvedValue(undefined)
    await sendMessage({ client, sessionId: 'ses_2', message: 'hi' })
    expect(log).toHaveBeenCalledWith(client, 'warn', expect.stringContaining('ses_2'))
    expect(mockPrompt).not.toHaveBeenCalled()
  })

  it('defaults agent when session.data is undefined (optional chain guard)', async () => {
    const { client, mockPrompt } = makeMockClient(undefined)

    await sendMessage({ client, sessionId: 'ses_3', message: 'hi' })
    expect(mockPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ agent: 'build' }) }),
    )
  })

  it('defaults to \'build\' agent when session has no agent', async () => {
    await sendMessage({ client: defaultClient, sessionId: 'ses_4', message: 'hi' })
    expect(defaultPrompt).toHaveBeenCalledWith({
      path: { id: 'ses_4' },
      body: { agent: 'build', noReply: false, parts: [{ type: 'text', text: 'hi' }] },
    })
  })

  it('passes through agent from session data', async () => {
    vi.mocked(getSessionAgent).mockResolvedValue('deploy')

    const { client, mockPrompt } = makeMockClient({ agent: 'deploy' })

    await sendMessage({ client, sessionId: 'ses_5', message: 'hi' })
    expect(mockPrompt).toHaveBeenCalledWith({
      path: { id: 'ses_5' },
      body: { agent: 'deploy', noReply: false, parts: [{ type: 'text', text: 'hi' }] },
    })
  })

  it('passes noReply option through', async () => {
    await sendMessage({ client: defaultClient, sessionId: 'ses_6', message: 'hi', noReply: true })
    expect(defaultPrompt).toHaveBeenCalledWith({
      path: { id: 'ses_6' },
      body: { agent: 'build', noReply: true, parts: [{ type: 'text', text: 'hi' }] },
    })
  })

  it('does not log in happy path', async () => {
    await sendMessage({ client: defaultClient, sessionId: 'ses_7', message: 'hi' })
    expect(log).not.toHaveBeenCalled()
  })

  it('sends message with correct text part structure', async () => {
    await sendMessage({ client: defaultClient, sessionId: 'ses_8', message: 'content' })
    expect(defaultPrompt).toHaveBeenCalledWith({
      path: { id: 'ses_8' },
      body: { agent: 'build', noReply: false, parts: [{ type: 'text', text: 'content' }] },
    })
  })

  it.each([
    { agent: 'deploy' },
    { agent: 'test' },
    { agent: 'custom-agent' },
  ])('passes agent=\'$agent\' through when session data specifies it', async ({ agent }) => {
    vi.mocked(getSessionAgent).mockResolvedValue(agent)

    const { client, mockPrompt } = makeMockClient({ agent })

    await sendMessage({ client, sessionId: `ses_${agent}`, message: 'hi' })
    expect(mockPrompt).toHaveBeenCalledTimes(1)
    expect(mockPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ agent }) }),
    )
  })

  it('propagates rejection from session.get', async () => {
    const { client, mockPrompt } = makeMockClient(undefined)

    client.session.get = vi.fn().mockRejectedValue(new Error('network'))
    await expect(sendMessage({ client, sessionId: 'ses_err', message: 'hi' })).rejects.toThrow('network')
    expect(mockPrompt).not.toHaveBeenCalled()
  })
})
